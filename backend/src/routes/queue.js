// File: backend/src/routes/queue.js
// Live queue: view queue, doctor calls next / completes / skips.
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize, attachDoctor } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { todayStr } = require('../utils/helpers');
const { getQueueState, broadcastQueue } = require('../services/queueService');
const { notify, checkTurnNear } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

// After any queue change: update all screens and check who is "3 away"
async function afterQueueChange(io, doctorId) {
  await broadcastQueue(io, doctorId);
  await checkTurnNear(io, doctorId);
}

// GET /api/queue/doctor/:doctorId : any logged-in user can see a doctor's queue
router.get('/doctor/:doctorId', async (req, res) => {
  const state = await getQueueState(req.params.doctorId);
  if (!state) throw httpError(404, 'Doctor not found');
  res.json(state);
});

// GET /api/queue/my : the patient's active tokens today
router.get('/my', authorize('patient'), async (req, res) => {
  const r = await pool.query(
    `SELECT qt.token_number, qt.doctor_id, u.name AS doctor_name
     FROM queue_tokens qt
     JOIN appointments a ON a.id = qt.appointment_id
     JOIN doctors d ON d.id = qt.doctor_id
     JOIN users u ON u.id = d.user_id
     WHERE a.patient_id = $1 AND qt.token_date = $2 AND qt.status IN ('waiting', 'called')`,
    [req.user.id, todayStr()]
  );
  res.json(r.rows);
});

// POST /api/queue/call-next : doctor calls the next waiting patient
router.post('/call-next', authorize('doctor'), attachDoctor, async (req, res) => {
  const date = todayStr();
  const called = await pool.withTransaction(async (client) => {
    // Only one patient inside the room at a time
    const busy = await client.query(
      `SELECT 1 FROM queue_tokens WHERE doctor_id = $1 AND token_date = $2 AND status = 'called'`,
      [req.doctorId, date]
    );
    if (busy.rowCount > 0) throw httpError(400, 'Finish the current consultation first');

    // Lowest waiting token number goes next
    const next = await client.query(
      `SELECT id, appointment_id, token_number FROM queue_tokens
       WHERE doctor_id = $1 AND token_date = $2 AND status = 'waiting'
       ORDER BY token_number LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [req.doctorId, date]
    );
    if (next.rowCount === 0) throw httpError(404, 'No patients are waiting');

    await client.query(`UPDATE queue_tokens SET status = 'called', called_at = NOW() WHERE id = $1`, [next.rows[0].id]);
    await client.query(`UPDATE appointments SET status = 'in_progress' WHERE id = $1`, [next.rows[0].appointment_id]);
    return next.rows[0];
  });

  const io = req.app.get('io');
  // Tell the called patient directly
  const a = await pool.query('SELECT patient_id FROM appointments WHERE id = $1', [called.appointment_id]);
  if (a.rows[0].patient_id) {
    await notify(io, {
      userId: a.rows[0].patient_id, appointmentId: called.appointment_id, type: 'turn_near',
      title: 'It is your turn now', message: `Token ${called.token_number}: please go to the doctor's room.`, sms: true,
    });
  }
  await afterQueueChange(io, req.doctorId);
  res.json({ message: `Token ${called.token_number} called`, token: called });
});

// POST /api/queue/:tokenId/complete : consultation finished
router.post('/:tokenId/complete', authorize('doctor'), attachDoctor, async (req, res) => {
  const t = await pool.query(
    `UPDATE queue_tokens SET status = 'completed', completed_at = NOW()
     WHERE id = $1 AND doctor_id = $2 AND status = 'called' RETURNING appointment_id`,
    [req.params.tokenId, req.doctorId]
  );
  if (t.rowCount === 0) throw httpError(404, 'No active consultation with this token');
  await pool.query(`UPDATE appointments SET status = 'completed' WHERE id = $1`, [t.rows[0].appointment_id]);
  await afterQueueChange(req.app.get('io'), req.doctorId);
  res.json({ message: 'Consultation completed' });
});

// POST /api/queue/:tokenId/skip : patient did not show up
router.post('/:tokenId/skip', authorize('doctor'), attachDoctor, async (req, res) => {
  const t = await pool.query(
    `UPDATE queue_tokens SET status = 'skipped'
     WHERE id = $1 AND doctor_id = $2 AND status IN ('waiting', 'called') RETURNING appointment_id`,
    [req.params.tokenId, req.doctorId]
  );
  if (t.rowCount === 0) throw httpError(404, 'Token not found');
  await pool.query(`UPDATE appointments SET status = 'no_show' WHERE id = $1`, [t.rows[0].appointment_id]);
  await afterQueueChange(req.app.get('io'), req.doctorId);
  res.json({ message: 'Patient skipped' });
});

module.exports = router;