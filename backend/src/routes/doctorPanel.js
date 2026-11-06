// File: backend/src/routes/doctorPanel.js
// A doctor manages their own availability and leave days.
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize, attachDoctor } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { todayStr } = require('../utils/helpers');
const { notify } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate, authorize('doctor'), attachDoctor); // doctors only

// GET /api/doctor/me : my profile (frontend needs my doctor id)
router.get('/me', async (req, res) => {
  const r = await pool.query(
    'SELECT d.*, u.name FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = $1', [req.doctorId]);
  res.json(r.rows[0]);
});

// GET /api/doctor/schedule
router.get('/schedule', async (req, res) => {
  const r = await pool.query(
    'SELECT * FROM doctor_schedules WHERE doctor_id = $1 ORDER BY day_of_week, start_time', [req.doctorId]);
  res.json(r.rows);
});

// PUT /api/doctor/schedule : replace my whole weekly schedule
// body: { schedules: [{ day_of_week, start_time, end_time, slot_minutes }] }
router.put('/schedule', async (req, res) => {
  const { schedules } = req.body;
  if (!Array.isArray(schedules)) throw httpError(400, 'schedules must be a list');
  for (const s of schedules) {
    if (!(s.end_time > s.start_time)) throw httpError(400, 'End time must be after start time');
    if (!(s.slot_minutes >= 5 && s.slot_minutes <= 120)) throw httpError(400, 'Slot length must be 5 to 120 minutes');
  }
  await pool.withTransaction(async (client) => {
    await client.query('DELETE FROM doctor_schedules WHERE doctor_id = $1', [req.doctorId]);
    for (const s of schedules) {
      await client.query(
        `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_minutes)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.doctorId, s.day_of_week, s.start_time, s.end_time, s.slot_minutes]
      );
    }
  });
  res.json({ message: 'Schedule saved' });
});

// GET /api/doctor/leaves : upcoming leave days
router.get('/leaves', async (req, res) => {
  const r = await pool.query(
    'SELECT * FROM doctor_leaves WHERE doctor_id = $1 AND leave_date >= $2 ORDER BY leave_date',
    [req.doctorId, todayStr()]
  );
  res.json(r.rows);
});

// POST /api/doctor/leaves { leave_date, reason }
// Also cancels that day's booked appointments and informs the patients.
router.post('/leaves', async (req, res) => {
  const { leave_date, reason } = req.body;
  if (!leave_date || leave_date < todayStr()) throw httpError(400, 'Choose today or a future date');

  const cancelled = await pool.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO doctor_leaves (doctor_id, leave_date, reason) VALUES ($1, $2, $3)
       ON CONFLICT (doctor_id, leave_date) DO NOTHING`,
      [req.doctorId, leave_date, reason || null]
    );
    const a = await client.query(
      `UPDATE appointments SET status = 'cancelled'
       WHERE doctor_id = $1 AND appointment_date = $2 AND status = 'booked'
       RETURNING id, patient_id`,
      [req.doctorId, leave_date]
    );
    const ids = a.rows.map((x) => x.id);
    await client.query(`UPDATE queue_tokens SET status = 'cancelled' WHERE appointment_id = ANY($1::int[])`, [ids]);
    return a.rows;
  });

  const io = req.app.get('io');
  for (const a of cancelled) {
    if (a.patient_id) {
      await notify(io, {
        userId: a.patient_id, appointmentId: a.id, type: 'cancellation',
        title: 'Appointment cancelled',
        message: `Your doctor is on leave on ${leave_date}. Please book another slot.`, sms: true,
      });
    }
  }
  res.status(201).json({ message: 'Leave added', cancelled_appointments: cancelled.length });
});

// DELETE /api/doctor/leaves/:id
router.delete('/leaves/:id', async (req, res) => {
  await pool.query('DELETE FROM doctor_leaves WHERE id = $1 AND doctor_id = $2', [req.params.id, req.doctorId]);
  res.json({ message: 'Leave removed' });
});

module.exports = router;