// File: backend/src/services/notificationService.js
// Saves notifications, pushes them live (Socket.io), optionally sends SMS (Twilio).
const pool = require('../config/db');
const { todayStr, addDays } = require('../utils/helpers');

// Twilio client is created only if keys exist in .env
let twilioClient = null;
function getTwilio() {
  if (twilioClient) return twilioClient;
  if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  return twilioClient;
}

// Send an SMS. Returns true if sent. Never crashes the app.
async function sendSms(userId, text) {
  const client = getTwilio();
  if (!client) return false;
  const u = await pool.query('SELECT phone FROM users WHERE id = $1', [userId]);
  const phone = u.rows[0]?.phone;
  if (!phone) return false;
  try {
    await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to: phone.startsWith('+') ? phone : '+91' + phone, // assume Indian numbers
      body: text,
    });
    return true;
  } catch (err) {
    console.error('SMS failed:', err.message);
    return false;
  }
}

// Main function: save in DB + push live + (optional) SMS
async function notify(io, { userId, appointmentId = null, type, title, message, sms = false }) {
  const smsSent = sms ? await sendSms(userId, `${title}: ${message}`) : false;
  const r = await pool.query(
    `INSERT INTO notifications (user_id, appointment_id, type, title, message, channel)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, appointmentId, type, title, message, smsSent ? 'sms' : 'in_app']
  );
  // Show instantly in the patient's browser if they are online
  if (io) io.to(`user_${userId}`).emit('notification', r.rows[0]);
  return r.rows[0];
}

// "Your turn is near": tell every waiting patient who has 3 or fewer patients ahead.
// Each patient is told only ONCE.
async function checkTurnNear(io, doctorId, date = todayStr()) {
  const doc = await pool.query(
    'SELECT u.name FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = $1', [doctorId]);
  const q = await pool.query(
    `SELECT qt.token_number, qt.status, qt.appointment_id, a.patient_id
     FROM queue_tokens qt JOIN appointments a ON a.id = qt.appointment_id
     WHERE qt.doctor_id = $1 AND qt.token_date = $2 AND qt.status IN ('called', 'waiting')
     ORDER BY qt.token_number`,
    [doctorId, date]
  );
  for (let ahead = 0; ahead < q.rows.length && ahead <= 3; ahead++) {
    const row = q.rows[ahead];
    if (row.status !== 'waiting' || !row.patient_id) continue; // walk-ins have no account
    const already = await pool.query(
      `SELECT 1 FROM notifications
       WHERE appointment_id = $1 AND type = 'turn_near' AND title = 'Your turn is near'`,
      [row.appointment_id]
    );
    if (already.rowCount > 0) continue;
    await notify(io, {
      userId: row.patient_id,
      appointmentId: row.appointment_id,
      type: 'turn_near',
      title: 'Your turn is near',
      message: `Token ${row.token_number} with ${doc.rows[0].name}: ${ahead} patient(s) ahead of you.`,
      sms: true,
    });
  }
}

// Reminder for every booked appointment TOMORROW (once per appointment)
async function sendTomorrowReminders(io) {
  const tomorrow = addDays(todayStr(), 1);
  const r = await pool.query(
    `SELECT a.id, a.patient_id, a.slot_start, u.name AS doctor_name
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     JOIN users u ON u.id = d.user_id
     WHERE a.appointment_date = $1 AND a.status = 'booked' AND a.patient_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM notifications n
                       WHERE n.appointment_id = a.id AND n.type = 'reminder')`,
    [tomorrow]
  );
  for (const a of r.rows) {
    await notify(io, {
      userId: a.patient_id,
      appointmentId: a.id,
      type: 'reminder',
      title: 'Appointment tomorrow',
      message: `Reminder: ${a.doctor_name} tomorrow at ${String(a.slot_start).slice(0, 5)}.`,
      sms: true,
    });
  }
  return r.rows.length;
}

module.exports = { notify, checkTurnNear, sendTomorrowReminders };