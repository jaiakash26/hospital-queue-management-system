// File: frontend/src/pages/DoctorSchedule.jsx
// Doctor sets weekly working hours and leave days.
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { btn, btnRed, input, card } from '../components/ui';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// One editable row per weekday
const emptyRows = () => DAYS.map((_, i) => ({ day_of_week: i, enabled: false, start_time: '09:00', end_time: '13:00', slot_minutes: 10 }));

export default function DoctorSchedule() {
  const [rows, setRows] = useState(emptyRows());
  const [leaves, setLeaves] = useState([]);
  const [leave, setLeave] = useState({ leave_date: '', reason: '' });
  const [msg, setMsg] = useState('');

  const loadLeaves = () => api.get('/doctor/leaves').then((r) => setLeaves(r.data));

  useEffect(() => {
    // Fill the rows with the saved schedule
    api.get('/doctor/schedule').then((r) => {
      const base = emptyRows();
      r.data.forEach((s) => {
        base[s.day_of_week] = { day_of_week: s.day_of_week, enabled: true,
          start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), slot_minutes: s.slot_minutes };
      });
      setRows(base);
    });
    loadLeaves();
  }, []);

  const setRow = (i, key, value) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  const saveSchedule = async () => {
    try {
      const schedules = rows.filter((r) => r.enabled)
        .map(({ enabled, ...rest }) => ({ ...rest, slot_minutes: Number(rest.slot_minutes) }));
      await api.put('/doctor/schedule', { schedules });
      setMsg('Schedule saved ✔');
    } catch (e) { setMsg(errMsg(e)); }
  };

  const addLeave = async () => {
    try {
      const { data } = await api.post('/doctor/leaves', leave);
      setMsg(`Leave added. ${data.cancelled_appointments} appointment(s) cancelled and patients informed.`);
      setLeave({ leave_date: '', reason: '' });
      loadLeaves();
    } catch (e) { setMsg(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      {msg && <p className="text-blue-700">{msg}</p>}

      <div className={card}>
        <h2 className="font-bold mb-3">Weekly availability</h2>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 mb-2">
            <label className="w-32 flex items-center gap-2">
              <input type="checkbox" checked={r.enabled} onChange={(e) => setRow(i, 'enabled', e.target.checked)} />
              {DAYS[i]}
            </label>
            <input type="time" disabled={!r.enabled} className="border rounded px-2 py-1" value={r.start_time} onChange={(e) => setRow(i, 'start_time', e.target.value)} />
            <span>to</span>
            <input type="time" disabled={!r.enabled} className="border rounded px-2 py-1" value={r.end_time} onChange={(e) => setRow(i, 'end_time', e.target.value)} />
            <input type="number" min="5" disabled={!r.enabled} className="border rounded px-2 py-1 w-20" value={r.slot_minutes} onChange={(e) => setRow(i, 'slot_minutes', e.target.value)} />
            <span className="text-sm text-gray-500">min/slot</span>
          </div>
        ))}
        <button className={`${btn} mt-2`} onClick={saveSchedule}>Save schedule</button>
      </div>

      <div className={card}>
        <h2 className="font-bold mb-3">Leave days</h2>
        <div className="flex gap-2 mb-3">
          <input type="date" className={input} value={leave.leave_date} onChange={(e) => setLeave({ ...leave, leave_date: e.target.value })} />
          <input className={input} placeholder="Reason" value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} />
          <button className={btn} disabled={!leave.leave_date} onClick={addLeave}>Add</button>
        </div>
        {leaves.map((l) => (
          <div key={l.id} className="flex justify-between border-b py-2">
            <span>{l.leave_date} {l.reason && `· ${l.reason}`}</span>
            <button className={btnRed} onClick={async () => { await api.delete(`/doctor/leaves/${l.id}`); loadLeaves(); }}>Remove</button>
          </div>
        ))}
        {leaves.length === 0 && <p className="text-gray-500">No upcoming leave.</p>}
      </div>
    </div>
  );
}