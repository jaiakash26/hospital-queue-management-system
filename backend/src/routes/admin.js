// File: backend/src/routes/admin.js
// Admin / receptionist: doctors, departments, walk-ins, reports.
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { todayStr, addDays } = require('../utils/helpers');
const { createToken, getQueueState, broadcastQueue } = require('../services/queueService');
const { sendTomorrowReminders } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

const staff = authorize('admin', 'receptionist'); // both roles
const adminOnly = authorize('admin');             // admin only

// ================= DEPARTMENTS =================
router.post('/departments', adminOnly, async (req, res) => {
  const { name, description } = req.body;
  if (!name) throw httpError(400, 'Department name is required');
  const r = await pool.query(
    'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *', [name, description || null]);
  res.status(201).json(r.rows[0]);
});

router.put('/departments/:id', adminOnly, async (req, res) => {
  const { name, description } = req.body;
  const r = await pool.query(
    `UPDATE departments SET name = COALESCE($1, name), description = COALESCE($2, description)
     WHERE id = $3 RETURNING *`, [name || null, description || null, req.params.id]);
  if (r.rowCount === 0) throw httpError(404, 'Department not found');
  res.json(r.rows[0]);
});

// ================= DOCTORS =================
// GET /api/admin/doctors : all doctors including inactive
router.get('/doctors', staff, async (req, res) => {
  const r = await pool.query(
    `SELECT d.id, u.name, u.email, u.phone, d.specialization, d.qualification, d.consultation_fee,
            d.avg_consult_minutes, d.is_active, dep.id AS department_id, dep.name AS department
     FROM doctors d JOIN users u ON u.id = d.user_id JOIN departments dep ON dep.id = d.department_id
     ORDER BY u.name`);
  res.json(r.rows);
});

// POST /api/admin/doctors : creates the login account AND the doctor profile together
router.post('/doctors', adminOnly, async (req, res) => {
  const { name, email, phone, password, department_id, specialization, qualification,
          experience_years = 0, consultation_fee = 0, avg_consult_minutes = 10 } = req.body;
  if (!name || !email || !password || !department_id) {
    throw httpError(400, 'Name, email, password and department are required');
  }
  const dup = await pool.query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
  if (dup.rowCount > 0) throw httpError(409, 'Email already used');

  const hash = await bcrypt.hash(password, 10);
  const doctor = await pool.withTransaction(async (client) => {
    const u = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, 'doctor') RETURNING id`,
      [name, email.toLowerCase(), phone || null, hash]);
    const d = await client.query(
      `INSERT INTO doctors (user_id, department_id, specialization, qualification, experience_years, consultation_fee, avg_consult_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [u.rows[0].id, department_id, specialization || null, qualification || null,
       experience_years, consultation_fee, avg_consult_minutes]);
    // Default timetable Mon-Fri 09:00-13:00 so the doctor can be booked immediately
    await client.query(
      `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_minutes)
       SELECT $1, d, '09:00', '13:00', $2 FROM generate_series(1, 5) AS d`,
      [d.rows[0].id, avg_consult_minutes]);
    return d.rows[0];
  });
  res.status(201).json(doctor);
});

// PUT /api/admin/doctors/:id : edit details or deactivate (send only what changes)
router.put('/doctors/:id', adminOnly, async (req, res) => {
  const { department_id, specialization, qualification, consultation_fee, avg_consult_minutes, is_active } = req.body;
  const r = await pool.query(
    `UPDATE doctors SET
       department_id = COALESCE($1, department_id), specialization = COALESCE($2, specialization),
       qualification = COALESCE($3, qualification), consultation_fee = COALESCE($4, consultation_fee),
       avg_consult_minutes = COALESCE($5, avg_consult_minutes), is_active = COALESCE($6, is_active)
     WHERE id = $7 RETURNING *`,
    [department_id ?? null, specialization ?? null, qualification ?? null,
     consultation_fee ?? null, avg_consult_minutes ?? null, is_active ?? null, req.params.id]);
  if (r.rowCount === 0) throw httpError(404, 'Doctor not found');
  res.json(r.rows[0]);
});

// ================= WALK-IN PATIENTS =================
// POST /api/admin/walk-in { doctor_id, name, phone, reason }
router.post('/walk-in', staff, async (req, res) => {
  const { doctor_id, name, phone, reason } = req.body;
  if (!doctor_id || !name) throw httpError(400, 'Doctor and patient name are required');
  const today = todayStr();

  const doc = await pool.query('SELECT 1 FROM doctors WHERE id = $1 AND is_active = TRUE', [doctor_id]);
  if (doc.rowCount === 0) throw httpError(404, 'Doctor not found');
  const leave = await pool.query('SELECT 1 FROM doctor_leaves WHERE doctor_id = $1 AND leave_date = $2', [doctor_id, today]);
  if (leave.rowCount > 0) throw httpError(400, 'Doctor is on leave today');

  // Walk-ins have no slot, only a token
  const token = await pool.withTransaction(async (client) => {
    const a = await client.query(
      `INSERT INTO appointments (walk_in_name, walk_in_phone, doctor_id, appointment_date, type, reason)
       VALUES ($1, $2, $3, $4, 'walk_in', $5) RETURNING id`,
      [name, phone || null, doctor_id, today, reason || null]);
    return createToken(client, a.rows[0].id, doctor_id, today);
  });

  const io = req.app.get('io');
  await broadcastQueue(io, doctor_id);
  const state = await getQueueState(doctor_id);
  const me = state.queue.find((q) => q.token_number === token.token_number);
  res.status(201).json({
    token_number: token.token_number,
    patients_ahead: me ? me.patients_ahead : 0,
    estimated_wait_minutes: me ? me.estimated_wait_minutes : 0,
  });
});

// GET /api/admin/appointments?date=YYYY-MM-DD : the day's full list (default today)
router.get('/appointments', staff, async (req, res) => {
  const date = req.query.date || todayStr();
  const r = await pool.query(
    `SELECT a.id, a.type, a.status, a.slot_start, qt.token_number,
            COALESCE(pu.name, a.walk_in_name) AS patient_name, du.name AS doctor_name
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     JOIN users du ON du.id = d.user_id
     LEFT JOIN users pu ON pu.id = a.patient_id
     LEFT JOIN queue_tokens qt ON qt.appointment_id = a.id
     WHERE a.appointment_date = $1
     ORDER BY du.name, qt.token_number`, [date]);
  res.json(r.rows);
});

// ================= REPORTS =================
// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD (default: last 7 days)
router.get('/reports', adminOnly, async (req, res) => {
  const to = req.query.to || todayStr();
  const from = req.query.from || addDays(to, -6);

  // 1) Patients per day
  const daily = await pool.query(
    `SELECT appointment_date AS date,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
            COUNT(*) FILTER (WHERE status = 'no_show')::int AS no_show
     FROM appointments WHERE appointment_date BETWEEN $1 AND $2
     GROUP BY appointment_date ORDER BY appointment_date`, [from, to]);

  // 2) Busiest hours (slot time, or arrival time for walk-ins)
  const hours = await pool.query(
    `SELECT EXTRACT(HOUR FROM COALESCE(slot_start, created_at::time))::int AS hour, COUNT(*)::int AS patients
     FROM appointments WHERE appointment_date BETWEEN $1 AND $2 AND status <> 'cancelled'
     GROUP BY hour ORDER BY hour`, [from, to]);

  // 3) Doctor workload
  const workload = await pool.query(
    `SELECT u.name, dep.name AS department,
            COUNT(a.id)::int AS total,
            COUNT(a.id) FILTER (WHERE a.status = 'completed')::int AS completed,
            ROUND(AVG(EXTRACT(EPOCH FROM (qt.completed_at - qt.called_at)) / 60)::numeric, 1) AS avg_minutes
     FROM doctors d
     JOIN users u ON u.id = d.user_id
     JOIN departments dep ON dep.id = d.department_id
     LEFT JOIN appointments a ON a.doctor_id = d.id
          AND a.appointment_date BETWEEN $1 AND $2 AND a.status <> 'cancelled'
     LEFT JOIN queue_tokens qt ON qt.appointment_id = a.id AND qt.status = 'completed'
     GROUP BY d.id, u.name, dep.name ORDER BY total DESC`, [from, to]);

  res.json({ from, to, daily: daily.rows, busiest_hours: hours.rows, doctor_workload: workload.rows });
});

// POST /api/admin/run-reminders : run the reminder job now (handy for testing)
router.post('/run-reminders', adminOnly, async (req, res) => {
  const count = await sendTomorrowReminders(req.app.get('io'));
  res.json({ message: `Reminders sent: ${count}` });
});

module.exports = router;