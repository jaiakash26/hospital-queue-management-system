// File: frontend/src/pages/Reports.jsx
// Admin reports: daily patients, busiest hours, doctor workload.
import { useEffect, useState } from 'react';
import api from '../api';
import { btn, card } from '../components/ui';

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA');

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [data, setData] = useState(null);

  const load = () => api.get('/admin/reports', { params: { from, to } }).then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  if (!data) return <p>Loading...</p>;
  // The longest bar = 100% width
  const maxPatients = Math.max(...data.busiest_hours.map((h) => h.patients), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input type="date" className="border rounded-lg px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span>to</span>
        <input type="date" className="border rounded-lg px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className={btn} onClick={load}>Show report</button>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <h2 className="font-bold mb-2">Daily patients</h2>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-gray-500"><th className="py-2">Date</th><th>Total</th><th>Completed</th><th>Cancelled</th><th>No-show</th></tr></thead>
          <tbody>
            {data.daily.map((d) => (
              <tr key={d.date} className="border-b"><td className="py-2">{d.date}</td><td>{d.total}</td><td>{d.completed}</td><td>{d.cancelled}</td><td>{d.no_show}</td></tr>
            ))}
          </tbody>
        </table>
        {data.daily.length === 0 && <p className="text-gray-500">No data in this range.</p>}
      </div>

      <div className={card}>
        <h2 className="font-bold mb-3">Busiest hours</h2>
        {data.busiest_hours.map((h) => (
          <div key={h.hour} className="flex items-center gap-3 mb-1">
            <span className="w-16 text-sm">{String(h.hour).padStart(2, '0')}:00</span>
            <div className="bg-blue-500 h-5 rounded" style={{ width: `${(h.patients / maxPatients) * 100}%` }} />
            <span className="text-sm">{h.patients}</span>
          </div>
        ))}
      </div>

      <div className={`${card} overflow-x-auto`}>
        <h2 className="font-bold mb-2">Doctor workload</h2>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-gray-500"><th className="py-2">Doctor</th><th>Department</th><th>Patients</th><th>Completed</th><th>Avg min</th></tr></thead>
          <tbody>
            {data.doctor_workload.map((d) => (
              <tr key={d.name} className="border-b"><td className="py-2">{d.name}</td><td>{d.department}</td><td>{d.total}</td><td>{d.completed}</td><td>{d.avg_minutes ?? '-'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}