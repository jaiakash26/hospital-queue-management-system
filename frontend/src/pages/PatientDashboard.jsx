// File: frontend/src/pages/PatientDashboard.jsx
// Patient home: live token cards + my appointments (cancel / reschedule).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import LiveTokenCard from '../components/LiveTokenCard';
import SlotPicker from '../components/SlotPicker';
import { btn, btnRed, btnGray, card } from '../components/ui';

export default function PatientDashboard() {
  const [tokens, setTokens] = useState([]);
  const [appts, setAppts] = useState([]);
  const [resched, setResched] = useState(null); // appointment being rescheduled
  const [picked, setPicked] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get('/queue/my').then((r) => setTokens(r.data));
    api.get('/appointments/my').then((r) => setAppts(r.data));
  };
  useEffect(load, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this appointment?')) return;
    try { await api.patch(`/appointments/${id}/cancel`); load(); } catch (e) { setMsg(errMsg(e)); }
  };

  const confirmResched = async () => {
    try {
      await api.put(`/appointments/${resched.id}/reschedule`, picked);
      setResched(null); setMsg(''); load();
    } catch (e) { setMsg(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold mb-3">Today's live queue</h2>
        {tokens.length === 0 && <p className="text-gray-500">No active token today.</p>}
        <div className="grid sm:grid-cols-2 gap-4">
          {tokens.map((t) => <LiveTokenCard key={t.token_number + '-' + t.doctor_id} token={t} />)}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold">My appointments</h2>
          <Link to="/patient/book" className={btn}>+ Book new</Link>
        </div>
        {msg && <p className="text-red-600 mb-2">{msg}</p>}
        <div className="space-y-3">
          {appts.map((a) => (
            <div key={a.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
              <div>
                <p className="font-semibold">{a.doctor_name} <span className="text-gray-500 font-normal">· {a.department}</span></p>
                <p className="text-sm">{a.appointment_date} {a.slot_start ? 'at ' + a.slot_start.slice(0, 5) : ''}
                  {a.token_number && ` · Token ${a.token_number}`}</p>
                <p className="text-sm text-gray-500">Status: <b>{a.status}</b></p>
              </div>
              {a.status === 'booked' && (
                <div className="flex gap-2">
                  <button className={btnGray} onClick={() => { setResched(a); setPicked(null); }}>Reschedule</button>
                  <button className={btnRed} onClick={() => cancel(a.id)}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Reschedule popup */}
      {resched && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-xl space-y-3">
            <h3 className="font-bold">Reschedule with {resched.doctor_name}</h3>
            <SlotPicker doctorId={resched.doctor_id} picked={picked} onPick={setPicked} />
            <div className="flex gap-2 justify-end">
              <button className={btnGray} onClick={() => setResched(null)}>Close</button>
              <button className={btn} disabled={!picked} onClick={confirmResched}>Confirm new slot</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}