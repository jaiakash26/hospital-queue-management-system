// File: backend/src/routes/notifications.js
// The notification bell: list and mark as read.
const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications : my latest 30
router.get('/', async (req, res) => {
  const r = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
    [req.user.id]
  );
  res.json(r.rows);
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
  res.json({ message: 'All marked as read' });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read' });
});

module.exports = router;