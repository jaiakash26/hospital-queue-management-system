// File: frontend/src/App.jsx
// All pages and which roles may open them.
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, homeFor } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import BookAppointment from './pages/BookAppointment';
import Prescriptions from './pages/Prescriptions';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorSchedule from './pages/DoctorSchedule';
import AdminDashboard from './pages/AdminDashboard';
import ManageDoctors from './pages/ManageDoctors';
import Reports from './pages/Reports';

// Navbar + centered content area, protected by role
const Page = ({ roles, children }) => (
  <ProtectedRoute roles={roles}>
    <Navbar />
    <main className="max-w-5xl mx-auto p-4">{children}</main>
  </ProtectedRoute>
);

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/patient" element={<Page roles={['patient']}><PatientDashboard /></Page>} />
      <Route path="/patient/book" element={<Page roles={['patient']}><BookAppointment /></Page>} />
      <Route path="/patient/prescriptions" element={<Page roles={['patient']}><Prescriptions /></Page>} />

      <Route path="/doctor" element={<Page roles={['doctor']}><DoctorDashboard /></Page>} />
      <Route path="/doctor/schedule" element={<Page roles={['doctor']}><DoctorSchedule /></Page>} />

      <Route path="/admin" element={<Page roles={['admin', 'receptionist']}><AdminDashboard /></Page>} />
      <Route path="/admin/manage" element={<Page roles={['admin']}><ManageDoctors /></Page>} />
      <Route path="/admin/reports" element={<Page roles={['admin']}><Reports /></Page>} />
    </Routes>
  );
}