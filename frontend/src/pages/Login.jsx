// File: frontend/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth, homeFor } from '../context/AuthContext';
import { btn, input, card } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); // stop the page from reloading
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
      nav(homeFor(data.user.role)); // go to the right dashboard
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm space-y-3`}>
        <h1 className="text-2xl font-bold text-blue-700">⏳ Hospital Queue Management System</h1>
        <p className="text-gray-500">Log in to continue</p>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input className={input} type="email" placeholder="Email" required
               onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={input} type="password" placeholder="Password" required
               onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className={`${btn} w-full`}>Log in</button>
        <p className="text-sm text-center">New patient? <Link to="/register" className="text-blue-600">Register</Link></p>
      </form>
    </div>
  );
}