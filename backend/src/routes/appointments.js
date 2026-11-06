// File: backend/src/routes/appointments.js
// Book, list, cancel and reschedule appointments.
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize, attachDoctor } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { getSlots } = require('../utils/slots');
const { todayStr } = require('../utils/helpers');
const { createToken, broadcastQueue } = require('../services/queueService');
const { notify, checkTurnNear } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate); // every route below needs login

// POST /api/appointments : patient books a slot
router.post('/', authorize('patient'), async (req, res) => {
  const { doctor_id, date, slot_start, reason } = req.body;
  if (!doctor_id || !date || !slot_start) throw httpError(400, 'doctor_id, date and slot_start are required');
  if (date < todayStr()) throw httpError(400, 'You cannot book a past date');

  const doc = await pool.query(
    `SELECT d.id, u.name FROM doctors d JOIN users u ON u.id = d.user_id
     WHERE d.id = $1 AND d.is_active = TRUE`, [doctor_id]);
  if (doc.rowCount === 0) throw httpError(404, 'Doctor not found');

  // One transaction: appointment + token succeed together or not at all
  const result = await pool.withTransaction(async (client) => {
    // SAFETY LAYER 1: is this a real, free slot?
    const { onLeave, slots } = await getSlots(client, doctor_id, date);
    if (onLeave) throw httpError(400, 'Doctor is on leave that day');
    const slot = slots.find((s) => s.start === slot_start);
    if (!slot) throw httpError(400, 'This is not a valid slot for that doctor');
    if (!slot.available) throw httpError(409, 'This slot is already booked or has passed');

    // SAFETY LAYER 2: the unique index in the database rejects duplicates
    const a = await client.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, slot_start, slot_end, type, reason)
       VALUES ($1, $2, $3, $4, $5, 'online', $6) RETURNING *`,
      [req.user.id, doctor_id, date, slot.start, slot.end, reason || null]
    );
    const token = await createToken(client, a.rows[0].id, doctor_id, date);
    return { appointment: a.rows[0], token };
  });

  const io = req.app.get('io');
  await notify(io, {
    userId: req.user.id, appointmentId: result.appointment.id, type: 'booking',
    title: 'Appointment booked',
    message: `${doc.rows[0].name} on ${date} at ${slot_start}. Your token number is ${result.token.token_number}.`,
  });
  if (date === todayStr()) await broadcastQueue(io, doctor_id);
  res.status(201).json(result);
});

// GET /api/appointments/my : the patient's own appointments
router.get('/my', authorize('patient'), async (req, res) => {
  const r = await pool.query(
    `SELECT a.*, u.name AS doctor_name, dep.name AS department,
            qt.token_number, qt.status AS token_status
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     JOIN users u ON u.id = d.user_id
     JOIN departments dep ON dep.id = d.department_id
     LEFT JOIN queue_tokens qt ON qt.appointment_id = a.id
     WHERE a.patient_id = $1
     ORDER BY a.appointment_date DESC, a.slot_start DESC NULLS LAST`,
    [req.user.id]
  );
  res.json(r.rows);
});

// GET /api/appointments/today : the doctor's list for today
router.get('/today', authorize('doctor'), attachDoctor, async (req, res) => {
  const r = await pool.query(
    `SELECT a.id, a.type, a.status, a.reason, a.slot_start, a.patient_id,
            COALESCE(u.name, a.walk_in_name) AS patient_name,
            qt.id AS token_id, qt.token_number, qt.status AS token_status,
            (p.id IS NOT NULL) AS has_prescription
     FROM appointments a
     LEFT JOIN users u ON u.id = a.patient_id
     LEFT JOIN queue_tokens qt ON qt.appointment_id = a.id
     LEFT JOIN prescriptions p ON p.appointment_id = a.id
     WHERE a.doctor_id = $1 AND a.appointment_date = $2 AND a.status <> 'cancelled'
     ORDER BY qt.token_number`,
    [req.doctorId, todayStr()]
  );
  res.json(r.rows);
});

// PATCH /api/appointments/:id/cancel
router.patch('/:id/cancel', authorize('patient', 'admin', 'receptionist'), async (req, res) => {
  const found = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
  const appt = found.rows[0];
  if (!appt) throw httpError(404, 'Appointment not found');
  // A patient may cancel only their own appointment
  if (req.user.role === 'patient' && appt.patient_id !== req.user.id) throw httpError(403, 'Not your appointment');
  if (appt.status !== 'booked') throw httpError(400, 'Only booked appointments can be cancelled');

  await pool.withTransaction(async (client) => {
    await client.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [appt.id]);
    await client.query(`UPDATE queue_tokens SET status = 'cancelled' WHERE appointment_id = $1`, [appt.id]);
  });

  const io = req.app.get('io');
  if (appt.patient_id) {
    await notify(io, {
      userId: appt.patient_id, appointmentId: appt.id, type: 'cancellation',
      title: 'Appointment cancelled', message: `Your appointment on ${appt.appointment_date} was cancelled.`,
    });
  }
  if (appt.appointment_date === todayStr()) {
    await broadcastQueue(io, appt.doctor_id);   // queue shortens for everyone
    await checkTurnNear(io, appt.doctor_id);    // someone may now be 3 away
  }
  res.json({ message: 'Appointment cancelled' });
});

// PUT /api/appointments/:id/reschedule  { date, slot_start }
router.put('/:id/reschedule', authorize('patient'), async (req, res) => {
  const { date, slot_start } = req.body;
  if (!date || !slot_start) throw httpError(400, 'date and slot_start are required');
  if (date < todayStr()) throw httpError(400, 'You cannot choose a past date');

  const found = await pool.query('SELECT * FROM appointments WHERE id = $1 AND patient_id = $2', [req.params.id, req.user.id]);
  const appt = found.rows[0];
  if (!appt) throw httpError(404, 'Appointment not found');
  if (appt.status !== 'booked') throw httpError(400, 'Only booked appointments can be rescheduled');

  const result = await pool.withTransaction(async (client) => {
    const { onLeave, slots } = await getSlots(client, appt.doctor_id, date);
    if (onLeave) throw httpError(400, 'Doctor is on leave that day');
    const slot = slots.find((s) => s.start === slot_start);
    if (!slot || !slot.available) throw httpError(409, 'That slot is not available');

    // Move to the new slot (the unique index protects us again)
    await client.query(
      `UPDATE appointments SET appointment_date = $1, slot_start = $2, slot_end = $3 WHERE id = $4`,
      [date, slot.start, slot.end, appt.id]
    );
    // Remove the old token and issue a new one for the new day
    await client.query('DELETE FROM queue_tokens WHERE appointment_id = $1', [appt.id]);
    return createToken(client, appt.id, appt.doctor_id, date);
  });

  const io = req.app.get('io');
  await notify(io, {
    userId: req.user.id, appointmentId: appt.id, type: 'booking', title: 'Appointment rescheduled',
    message: `New time: ${date} at ${slot_start}. Your new token is ${result.token_number}.`,
  });
  await broadcastQueue(io, appt.doctor_id);
  res.json({ message: 'Rescheduled', token: result });
});

module.exports = router;