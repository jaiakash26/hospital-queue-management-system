// File: frontend/src/components/Navbar.jsx
// Top bar. The links change depending on the user's role.
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const links = {
  patient: [['/patient', 'My Queue'], ['/patient/book', 'Book'], ['/patient/prescriptions', 'Prescriptions']],
  doctor: [['/doctor', 'Today'], ['/doctor/schedule', 'My Schedule']],
  receptionist: [['/admin', 'Front Desk']],
  admin: [['/admin', 'Front Desk'], ['/admin/manage', 'Doctors'], ['/admin/reports', 'Reports']],
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <nav className="bg-blue-700 text-white px-4 py-3 flex items-center gap-5">
      <span className="font-bold text-lg">⏳ HQMS</span>
      {(links[user.role] || []).map(([to, label]) => (
        <Link key={to} to={to} className="hover:underline">{label}</Link>
      ))}
      <div className="ml-auto flex items-center gap-4">
        <span className="text-sm">{user.name} ({user.role})</span>
        <NotificationBell />
        <button onClick={() => { logout(); nav('/login'); }} className="bg-white text-blue-700 px-3 py-1 rounded-lg text-sm">
          Logout
        </button>
      </div>
    </nav>
  );
}