// File: backend/src/services/queueService.js
// Everything about the live queue: tokens, waiting time, broadcasting.
const pool = require('../config/db');
const { todayStr } = require('../utils/helpers');

// Give the next token number (1, 2, 3 ...) for this doctor and date.
// The advisory lock makes simultaneous bookings wait for each other,
// so two patients can never receive the same number.
async function createToken(client, appointmentId, doctorId, date) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [doctorId]);
  const next = await client.query(
    `SELECT COALESCE(MAX(token_number), 0) + 1 AS n
     FROM queue_tokens WHERE doctor_id = $1 AND token_date = $2`,
    [doctorId, date]
  );
  const r = await client.query(
    `INSERT INTO queue_tokens (appointment_id, doctor_id, token_date, token_number)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [appointmentId, doctorId, date, next.rows[0].n]
  );
  return r.rows[0];
}

// Average minutes per consultation.
// After 3 finished patients today we use the REAL average, otherwise the doctor's default.
async function getAvgMinutes(doctorId, date, fallback) {
  const r = await pool.query(
    `SELECT COUNT(*) AS n,
            AVG(EXTRACT(EPOCH FROM (completed_at - called_at)) / 60) AS avg
     FROM queue_tokens
     WHERE doctor_id = $1 AND token_date = $2 AND status = 'completed'
       AND called_at IS NOT NULL AND completed_at IS NOT NULL`,
    [doctorId, date]
  );
  if (Number(r.rows[0].n) >= 3) return Math.max(1, Math.round(Number(r.rows[0].avg)));
  return fallback;
}

// The full queue picture for one doctor on one date.
// Only token numbers are included (no patient names), so it is safe to show publicly.
async function getQueueState(doctorId, date = todayStr()) {
  const doc = await pool.query(
    `SELECT d.id, d.avg_consult_minutes, u.name
     FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = $1`,
    [doctorId]
  );
  if (doc.rowCount === 0) return null;

  const avg = await getAvgMinutes(doctorId, date, doc.rows[0].avg_consult_minutes);

  // Active tokens only (someone inside + people waiting), in order
  const t = await pool.query(
    `SELECT token_number, status FROM queue_tokens
     WHERE doctor_id = $1 AND token_date = $2 AND status IN ('called', 'waiting')
     ORDER BY token_number`,
    [doctorId, date]
  );

  // Position in the list = patients ahead. Wait = patients ahead x average minutes.
  const queue = t.rows.map((row, index) => ({
    token_number: row.token_number,
    status: row.status,
    patients_ahead: index,
    estimated_wait_minutes: index * avg,
  }));

  const serving = queue.find((q) => q.status === 'called');
  return {
    doctor_id: doc.rows[0].id,
    doctor_name: doc.rows[0].name,
    now_serving: serving ? serving.token_number : null,
    avg_minutes: avg,
    queue,
  };
}

// Push the fresh queue to everyone watching this doctor (Socket.io room)
async function broadcastQueue(io, doctorId) {
  const state = await getQueueState(doctorId);
  if (state) io.to(`doctor_${doctorId}`).emit('queue_updated', state);
}

module.exports = { createToken, getQueueState, broadcastQueue };