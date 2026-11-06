// File: frontend/src/pages/Prescriptions.jsx
// Patient sees prescriptions and downloads them as PDF.
import { useEffect, useState } from 'react';
import api from '../api';
import { btn, card } from '../components/ui';

export default function Prescriptions() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get('/prescriptions/my').then((r) => setList(r.data)); }, []);

  // The PDF needs the login token, so we fetch it ourselves and save it
  const download = async (id) => {
    const res = await api.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prescription-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">My prescriptions</h2>
      {list.length === 0 && <p className="text-gray-500">No prescriptions yet.</p>}
      {list.map((p) => (
        <div key={p.id} className={card}>
          <div className="flex justify-between">
            <div>
              <p className="font-semibold">{p.doctor_name} · {p.appointment_date}</p>
              <p>Diagnosis: {p.diagnosis || '-'}</p>
            </div>
            <button className={btn} onClick={() => download(p.id)}>Download PDF</button>
          </div>
          <ul className="list-disc ml-6 mt-2 text-sm">
            {p.medicines.map((m, i) => <li key={i}>{m.name} - {m.dosage}, {m.frequency}, {m.days} day(s)</li>)}
          </ul>
          {p.notes && <p className="text-sm mt-2 text-gray-600">Notes: {p.notes}</p>}
        </div>
      ))}
    </div>
  );
}