// File: frontend/src/pages/DoctorDashboard.jsx
// Doctor: today's list, call next, complete, skip, write prescription.
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import useLiveQueue from '../hooks/useLiveQueue';
import { btn, btnRed, btnGray, input, card } from '../components/ui';

// ---------- Popup form to write a prescription ----------
function PrescriptionModal({ appt, onClose }) {
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [meds, setMeds] = useState([{ name: '', dosage: '', frequency: '', days: 3 }]);
  const [error, setError] = useState('');

  // Change one field of one medicine row
  const setMed = (i, key, value) => setMeds(meds.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)));

  const save = async () => {
    try {
      await api.post('/prescriptions', {
        appointment_id: appt.id, diagnosis, notes,
        follow_up_date: followUp || null,
        medicines: meds.filter((m) => m.name.trim()), // ignore empty rows
      });
      onClose();
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-xl p-5 w-full max-w-2xl space-y-3">
        <h3 className="font-bold text-lg">Prescription for {appt.patient_name}</h3>
        <input className={input} placeholder="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        {meds.map((m, i) => (
          <div key={i} className="grid grid-cols-4 gap-2">
            <input className={input} placeholder="Medicine" value={m.name} onChange={(e) => setMed(i, 'name', e.target.value)} />
            <input className={input} placeholder="Dosage" value={m.dosage} onChange={(e) => setMed(i, 'dosage', e.target.value)} />
            <input className={input} placeholder="Frequency" value={m.frequency} onChange={(e) => setMed(i, 'frequency', e.target.value)} />
            <input className={input} type="number" min="1" placeholder="Days" value={m.days} onChange={(e) => setMed(i, 'days', e.target.value)} />
          </div>
        ))}
        <button className={btnGray} onClick={() => setMeds([...meds, { name: '', dosage: '', frequency: '', days: 3 }])}>+ Add medicine</button>
        <textarea className={input} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label className="block text-sm">Follow-up date
          <input type="date" className={input} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </label>
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button className={btnGray} onClick={onClose}>Cancel</button>
          <button className={btn} onClick={save}>Save prescription</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default function DoctorDashboard() {
  const [doctor, setDoctor] = useState(null);
  const [list, setList] = useState([]);
  const [rxFor, setRxFor] = useState(null);
  const [msg, setMsg] = useState('');
  const queue = useLiveQueue(doctor?.id); // live updates

  const load = () => api.get('/appointments/today').then((r) => setList(r.data));

  useEffect(() => { api.get('/doctor/me').then((r) => setDoctor(r.data)); }, []);
  useEffect(() => { load(); }, [queue]); // reload the list whenever the queue changes

  // Run a queue action (call next / complete / skip)
  const act = async (url) => {
    try { await api.post(url); setMsg(''); } catch (e) { setMsg(errMsg(e)); }
    load();
  };

  return (
    <div className="space-y-4">
      <div className={`${card} flex items-center justify-between`}>
        <div>
          <p className="text-gray-500">Now serving</p>
          <p className="text-5xl font-bold text-blue-600">{queue?.now_serving ?? '-'}</p>
          <p className="text-sm text-gray-500">Waiting: {queue ? queue.queue.filter((q) => q.status === 'waiting').length : 0}
            {queue && ` · avg ${queue.avg_minutes} min/patient`}</p>
        </div>
        <button className={`${btn} text-lg`} onClick={() => act('/queue/call-next')}>Call next patient ▶</button>
      </div>
      {msg && <p className="text-red-600">{msg}</p>}

      <div className={`${card} overflow-x-auto`}>
        <h2 className="font-bold mb-2">Today's patients</h2>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-gray-500">
            <th className="py-2">Token</th><th>Patient</th><th>Slot</th><th>Reason</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2 font-bold">{a.token_number}</td>
                <td>{a.patient_name} {a.type === 'walk_in' && <span className="text-xs bg-yellow-100 px-1 rounded">walk-in</span>}</td>
                <td>{a.slot_start ? a.slot_start.slice(0, 5) : '-'}</td>
                <td>{a.reason || '-'}</td>
                <td>{a.status}</td>
                <td className="space-x-2 text-right">
                  {a.token_status === 'called' && <button className={btn} onClick={() => act(`/queue/${a.token_id}/complete`)}>Complete</button>}
                  {['called', 'waiting'].includes(a.token_status) && <button className={btnRed} onClick={() => act(`/queue/${a.token_id}/skip`)}>Skip</button>}
                  {a.patient_id && ['in_progress', 'completed'].includes(a.status) &&
                    <button className={btnGray} onClick={() => setRxFor(a)}>{a.has_prescription ? 'Edit Rx' : 'Prescription'}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-gray-500 py-4">No appointments today.</p>}
      </div>

      {rxFor && <PrescriptionModal appt={rxFor} onClose={() => { setRxFor(null); load(); }} />}
    </div>
  );
}