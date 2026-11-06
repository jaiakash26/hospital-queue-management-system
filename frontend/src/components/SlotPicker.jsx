// File: frontend/src/components/SlotPicker.jsx
// Choose a date, then see the doctor's free slots. Used for booking AND rescheduling.
import { useEffect, useState } from 'react';
import api from '../api';

export default function SlotPicker({ doctorId, picked, onPick }) {
  const today = new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD"
  const [date, setDate] = useState(today);
  const [data, setData] = useState({ onLeave: false, slots: [] });

  // Reload slots whenever the doctor or date changes
  useEffect(() => {
    onPick(null);
    api.get(`/doctors/${doctorId}/slots`, { params: { date } }).then((r) => setData(r.data));
  }, [doctorId, date]);

  return (
    <div>
      <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)}
             className="border rounded-lg px-3 py-2 mb-3" />
      {data.onLeave && <p className="text-red-600">Doctor is on leave on this day.</p>}
      {!data.onLeave && data.slots.length === 0 && <p className="text-gray-500">Doctor does not work on this day.</p>}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {data.slots.map((s) => {
          const selected = picked?.date === date && picked?.slot_start === s.start;
          return (
            <button key={s.start} disabled={!s.available}
              onClick={() => onPick({ date, slot_start: s.start })}
              className={`py-2 rounded-lg text-sm border
                ${selected ? 'bg-blue-600 text-white' : s.available ? 'bg-white hover:bg-blue-50' : 'bg-gray-100 text-gray-400 line-through'}`}>
              {s.start}
            </button>
          );
        })}
      </div>
    </div>
  );
}