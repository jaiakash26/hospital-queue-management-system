// File: frontend/src/pages/BookAppointment.jsx
// Search doctors by department/name, pick a slot, confirm.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import SlotPicker from '../components/SlotPicker';
import { btn, input, card } from '../components/ui';

export default function BookAppointment() {
  const nav = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [deptId, setDeptId] = useState('');
  const [search, setSearch] = useState('');
  const [doctor, setDoctor] = useState(null);  // chosen doctor
  const [picked, setPicked] = useState(null);  // chosen { date, slot_start }
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.get('/departments').then((r) => setDepartments(r.data)); }, []);

  // Reload the doctor list when department or search text changes
  useEffect(() => {
    api.get('/doctors', { params: { department_id: deptId || undefined, search: search || undefined } })
      .then((r) => setDoctors(r.data));
  }, [deptId, search]);

  const book = async () => {
    try {
      await api.post('/appointments', { doctor_id: doctor.id, ...picked, reason });
      nav('/patient');
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Book an appointment</h2>
      <div className="flex gap-3">
        <select className={input} value={deptId} onChange={(e) => { setDeptId(e.target.value); setDoctor(null); }}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input className={input} placeholder="Search doctor name" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {doctors.map((d) => (
          <div key={d.id} className={`${card} ${doctor?.id === d.id ? 'ring-2 ring-blue-600' : ''}`}>
            <p className="font-semibold">{d.name}</p>
            <p className="text-sm text-gray-500">{d.department} · {d.specialization}</p>
            <p className="text-sm">{d.qualification} · {d.experience_years} yrs · ₹{d.consultation_fee}</p>
            <button className={`${btn} mt-2`} onClick={() => { setDoctor(d); setPicked(null); }}>Select</button>
          </div>
        ))}
      </div>

      {doctor && (
        <div className={`${card} space-y-3`}>
          <h3 className="font-bold">Choose a slot with {doctor.name}</h3>
          <SlotPicker doctorId={doctor.id} picked={picked} onPick={setPicked} />
          <textarea className={input} placeholder="Reason for visit (optional)" value={reason}
                    onChange={(e) => setReason(e.target.value)} />
          {error && <p className="text-red-600">{error}</p>}
          <button className={btn} disabled={!picked} onClick={book}>
            {picked ? `Confirm ${picked.date} at ${picked.slot_start}` : 'Pick a slot first'}
          </button>
        </div>
      )}
    </div>
  );
}