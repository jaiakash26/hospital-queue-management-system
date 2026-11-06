// File: frontend/src/socket.js
import { io } from 'socket.io-client';
import { API_URL } from './api';

// Open a live connection. The token lets the server send us private notifications.
export function createSocket() {
  return io(API_URL, { auth: { token: localStorage.getItem('token') } });
}