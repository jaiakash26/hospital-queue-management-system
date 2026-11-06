// File: frontend/src/api.js
// One Axios instance: adds the login token to every request.
import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: API_URL + '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

// Get a readable message from a failed request
export const errMsg = (e) => e.response?.data?.message || 'Something went wrong';

export default api;