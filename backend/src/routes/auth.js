// File: backend/src/routes/auth.js
// Register, login, and "who am I".
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');

const router = express.Router();

// Create a login token containing id, role and name
function makeToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register (public sign-up: ALWAYS creates a patient)
router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) throw httpError(400, 'Name, email and password are required');
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');

  const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (exists.rowCount > 0) throw httpError(409, 'This email is already registered');

  const hash = await bcrypt.hash(password, 10); // scramble the password

  // Role is fixed to 'patient' so nobody can make themselves admin from the website
  const r = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, role)
     VALUES ($1, $2, $3, $4, 'patient') RETURNING id, name, email, role`,
    [name, email.toLowerCase(), phone || null, hash]
  );
  const user = r.rows[0];
  res.status(201).json({ user, token: makeToken(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw httpError(400, 'Email and password are required');

  const r = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const row = r.rows[0];
  // Same message for "no user" and "wrong password" so attackers learn nothing
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw httpError(401, 'Wrong email or password');
  }
  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  res.json({ user, token: makeToken(user) });
});

// GET /api/auth/me (needs login)
router.get('/me', authenticate, async (req, res) => {
  const r = await pool.query('SELECT id, name, email, phone, role FROM users WHERE id = $1', [req.user.id]);
  res.json(r.rows[0]);
});

module.exports = router;