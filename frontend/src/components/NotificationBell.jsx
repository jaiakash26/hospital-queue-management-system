// File: frontend/src/components/NotificationBell.jsx
// Bell icon with unread count. New notifications arrive live through Socket.io.
import { useEffect, useState } from 'react';
import api from '../api';
import { createSocket } from '../socket';

export default function NotificationBell() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);

  const load = () => api.get('/notifications').then((r) => setList(r.data));

  useEffect(() => {
    load();
    const socket = createSocket();
    socket.on('notification', (n) => setList((old) => [n, ...old])); // live!
    return () => socket.disconnect();
  }, []);

  const unread = list.filter((n) => !n.is_read).length;
  const readAll = async () => { await api.patch('/notifications/read-all'); load(); };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative text-xl">
        🔔
        {unread > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white text-gray-800 rounded-xl shadow-lg z-10">
          <div className="flex justify-between p-3 border-b">
            <b>Notifications</b>
            <button onClick={readAll} className="text-blue-600 text-sm">Mark all read</button>
          </div>
          {list.length === 0 && <p className="p-4 text-gray-500">Nothing yet</p>}
          {list.map((n) => (
            <div key={n.id} className={`p-3 border-b text-sm ${n.is_read ? '' : 'bg-blue-50'}`}>
              <p className="font-semibold">{n.title}</p>
              <p>{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}