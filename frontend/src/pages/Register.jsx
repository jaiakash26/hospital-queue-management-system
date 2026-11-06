// File: frontend/src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth, homeFor } from '../context/AuthContext';
import { btn, input, card } from '../components/ui';

export default function Register() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value }); // update one field

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.token, data.user); // log in straight after registering
      nav(homeFor(data.user.role));
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm space-y-3`}>
        <h1 className="text-2xl font-bold text-blue-700">Create patient account</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input className={input} placeholder="Full name" required onChange={set('name')} />
        <input className={input} type="email" placeholder="Email" required onChange={set('email')} />
        <input className={input} placeholder="Phone (for SMS alerts)" onChange={set('phone')} />
        <input className={input} type="password" placeholder="Password (min 6 characters)" required onChange={set('password')} />
        <button className={`${btn} w-full`}>Register</button>
        <p className="text-sm text-center">Already have an account? <Link to="/login" className="text-blue-600">Log in</Link></p>
      </form>
    </div>
  );
}