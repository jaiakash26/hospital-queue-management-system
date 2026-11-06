// File: frontend/src/context/AuthContext.jsx
// Keeps "who is logged in" available to every page.
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Which page each role lands on after login
export const homeFor = (role) =>
  role === 'patient' ? '/patient' : role === 'doctor' ? '/doctor' : '/admin';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };
  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);