// File: backend/src/routes/catalog.js
// Lists used while booking: departments, doctors, free slots.
const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { getSlots } = require('../utils/slots');
const { httpError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/departments
router.get('/departments', authenticate, async (req, res) => {
  const r = await pool.query('SELECT * FROM departments ORDER BY name');
  res.json(r.rows);
});

// GET /api/doctors?department_id=1&search=arun
router.get('/doctors', authenticate, async (req, res) => {
  const departmentId = req.query.department_id || null;
  const search = req.query.search || null;
  const r = await pool.query(
    `SELECT d.id, u.name, d.specialization, d.qualification, d.experience_years,
            d.consultation_fee, d.avg_consult_minutes,
            dep.id AS department_id, dep.name AS department
     FROM doctors d
     JOIN users u ON u.id = d.user_id
     JOIN departments dep ON dep.id = d.department_id
     WHERE d.is_active = TRUE
       AND ($1::int IS NULL OR d.department_id = $1::int)
       AND ($2::text IS NULL OR u.name ILIKE '%' || $2::text || '%')
     ORDER BY u.name`,
    [departmentId, search]
  );
  res.json(r.rows);
});

// GET /api/doctors/1/slots?date=2026-11-09
router.get('/doctors/:id/slots', authenticate, async (req, res) => {
  const { date } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw httpError(400, 'date must look like 2026-11-09');
  res.json(await getSlots(pool, req.params.id, date));
});

module.exports = router;