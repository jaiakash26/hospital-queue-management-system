// File: frontend/src/hooks/useLiveQueue.js
// Custom hook: returns one doctor's live queue, updating by itself.
import { useEffect, useState } from 'react';
import api from '../api';
import { createSocket } from '../socket';

export default function useLiveQueue(doctorId) {
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    setQueue(null);
    if (!doctorId) return;

    // 1) load the current queue once
    api.get(`/queue/doctor/${doctorId}`).then((r) => setQueue(r.data));

    // 2) then listen for live updates
    const socket = createSocket();
    socket.on('connect', () => socket.emit('join_doctor_queue', doctorId)); // also re-joins after reconnect
    socket.on('queue_updated', (state) => {
      if (state.doctor_id === Number(doctorId)) setQueue(state);
    });
    return () => socket.disconnect(); // clean up when the page closes
  }, [doctorId]);

  return queue;
}