// File: backend/server.js
// Entry point: starts HTTP server + Socket.io + reminder job.
require('dotenv').config(); // load .env FIRST

const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const app = require('./src/app');
const { startCronJobs } = require('./src/services/cron');

const server = http.createServer(app);

// Socket.io shares the same server as Express
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST'] },
});
app.set('io', io); // routes can get it with req.app.get('io')

io.on('connection', (socket) => {
  // A valid login token puts the user in a private room for personal notifications
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.join(`user_${user.id}`);
    } catch (e) { /* invalid token: stay anonymous */ }
  }

  // Anyone can watch a doctor's queue (only token numbers, no names)
  socket.on('join_doctor_queue', (doctorId) => socket.join(`doctor_${doctorId}`));
  socket.on('leave_doctor_queue', (doctorId) => socket.leave(`doctor_${doctorId}`));
});

startCronJobs(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`HQMS backend running on port ${PORT}`));