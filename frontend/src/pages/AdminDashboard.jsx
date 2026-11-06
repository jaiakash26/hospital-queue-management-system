// File: frontend/src/pages/AdminDashboard.jsx
// Front desk: register walk-ins, see today's list and a doctor's live queue.
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import useLiveQueue from '../hooks/useLiveQueue';
import { btn, input, card } from '../components/ui';

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ doctor_id: '', name: '', phone: '', reason: '' });
  const [issued, setIssued] = useState(null); // token just given to a walk-in
  const [error, setError] = useState('');
  const queue = useLiveQueue(form.doctor_id); // live queue of the selected doctor

  const loadList = () => api.get('/admin/appointments').then((r) => setList(r.data));

  useEffect(() => {
    api.get('/admin/doctors').then((r) => setDoctors(r.data.filter((d) => d.is_active)));
    loadList();
    const timer = setInterval(loadList, 10000); // refresh the table every 10 seconds
    return () => clearInterval(timer);
  }, []);

  const addWalkIn = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/admin/walk-in', form);
      setIssued(data); setError('');
      setForm({ ...form, name: '', phone: '', reason: '' });
      loadList();
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={addWalkIn} className={`${card} space-y-3`}>
        <h2 className="font-bold">Register walk-in patient</h2>
        <select className={input} required value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
          <option value="">Select doctor</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.department})</option>)}
        </select>
        <input className={input} placeholder="Patient name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={input} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className={input} placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        {error && <p className="text-red-600">{error}</p>}
        <button className={`${btn} w-full`}>Issue token</button>
        {issued && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-center">
            <p className="text-sm">Token number</p>
            <p className="text-5xl font-bold text-green-700">{issued.token_number}</p>
            <p className="text-sm">{issued.patients_ahead} ahead · wait ~{issued.estimated_wait_minutes} min</p>
          </div>
        )}
      </form>

      <div className={card}>
        <h2 className="font-bold mb-2">Live queue {queue && `· ${queue.doctor_name}`}</h2>
        {!queue ? <p className="text-gray-500">Select a doctor to watch their queue.</p> : (
          <>
            <p>Now serving: <b className="text-2xl">{queue.now_serving ?? '-'}</b></p>
            <p className="text-sm text-gray-500 mb-2">{queue.queue.length} active token(s) · avg {queue.avg_minutes} min</p>
            <div className="flex flex-wrap gap-2">
              {queue.queue.map((q) => (
                <span key={q.token_number} className={`px-3 py-1 rounded-full text-sm ${q.status === 'called' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                  {q.token_number}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={`${card} md:col-span-2 overflow-x-auto`}>
        <h2 className="font-bold mb-2">Today's appointments</h2>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-gray-500"><th className="py-2">Doctor</th><th>Token</th><th>Patient</th><th>Type</th><th>Slot</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2">{a.doctor_name}</td><td className="font-bold">{a.token_number}</td>
                <td>{a.patient_name}</td><td>{a.type}</td>
                <td>{a.slot_start ? a.slot_start.slice(0, 5) : '-'}</td><td>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-gray-500 py-3">Nothing today.</p>}
      </div>
    </div>
  );
}