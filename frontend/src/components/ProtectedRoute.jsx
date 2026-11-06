// File: frontend/src/components/ProtectedRoute.jsx
// Blocks a page unless the user is logged in AND has an allowed role.
import { Navigate } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';

export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;                                            // not logged in
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />; // wrong role
  return children;
}