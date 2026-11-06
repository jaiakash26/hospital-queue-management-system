// File: frontend/src/pages/ManageDoctors.jsx
// Admin adds departments and doctors, and activates/deactivates doctors.
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { btn, btnGray, input, card } from '../components/ui';

const emptyDoctor = { name: '', email: '', phone: '', password: '', department_id: '',
  specialization: '', qualification: '', consultation_fee: 300, avg_consult_minutes: 10 };

export default function ManageDoctors() {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [dept, setDept] = useState({ name: '', description: '' });
  const [form, setForm] = useState(emptyDoctor);
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get('/departments').then((r) => setDepartments(r.data));
    api.get('/admin/doctors').then((r) => setDoctors(r.data));
  };
  useEffect(load, []);

  const addDept = async (e) => {
    e.preventDefault();
    try { await api.post('/admin/departments', dept); setDept({ name: '', description: '' }); setMsg('Department added'); load(); }
    catch (err) { setMsg(errMsg(err)); }
  };

  const addDoctor = async (e) => {
    e.preventDefault();
    try { await api.post('/admin/doctors', form); setForm(emptyDoctor); setMsg('Doctor added (default timetable Mon-Fri 9-1)'); load(); }
    catch (err) { setMsg(errMsg(err)); }
  };

  const toggle = async (d) => { await api.put(`/admin/doctors/${d.id}`, { is_active: !d.is_active }); load(); };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="space-y-6">
      {msg && <p className="text-blue-700">{msg}</p>}

      <form onSubmit={addDept} className={`${card} flex gap-2 items-end`}>
        <div className="flex-1"><label className="text-sm">Department name</label>
          <input className={input} required value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} /></div>
        <div className="flex-1"><label className="text-sm">Description</label>
          <input className={input} value={dept.description} onChange={(e) => setDept({ ...dept, description: e.target.value })} /></div>
        <button className={btn}>Add department</button>
      </form>
      <p className="text-sm text-gray-600">Departments: {departments.map((d) => d.name).join(', ')}</p>

      <form onSubmit={addDoctor} className={`${card} grid grid-cols-2 gap-3`}>
        <h2 className="font-bold col-span-2">Add doctor</h2>
        <input className={input} placeholder="Name (e.g. Dr. Ravi)" required value={form.name} onChange={set('name')} />
        <input className={input} type="email" placeholder="Login email" required value={form.email} onChange={set('email')} />
        <input className={input} placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <input className={input} type="password" placeholder="Temporary password" required value={form.password} onChange={set('password')} />
        <select className={input} required value={form.department_id} onChange={set('department_id')}>
          <option value="">Department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input className={input} placeholder="Specialization" value={form.specialization} onChange={set('specialization')} />
        <input className={input} placeholder="Qualification" value={form.qualification} onChange={set('qualification')} />
        <input className={input} type="number" placeholder="Fee ₹" value={form.consultation_fee} onChange={set('consultation_fee')} />
        <input className={input} type="number" placeholder="Avg minutes per patient" value={form.avg_consult_minutes} onChange={set('avg_consult_minutes')} />
        <button className={`${btn} col-span-2`}>Add doctor</button>
      </form>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-gray-500"><th className="py-2">Name</th><th>Department</th><th>Fee</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id} className="border-b">
                <td className="py-2">{d.name}<br /><span className="text-xs text-gray-500">{d.email}</span></td>
                <td>{d.department}</td><td>₹{d.consultation_fee}</td>
                <td>{d.is_active ? 'Active' : 'Inactive'}</td>
                <td><button className={btnGray} onClick={() => toggle(d)}>{d.is_active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}