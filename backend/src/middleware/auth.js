// File: backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// 1) AUTHENTICATE: "Are you logged in?"
// Reads the header "Authorization: Bearer <token>" and checks the token.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in first' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role, name }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
}

// 2) AUTHORIZE: "Is your role allowed here?"
// Usage: authorize('doctor')  or  authorize('admin', 'receptionist')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not allowed to do this' });
    }
    next();
  };
}

// 3) ATTACH DOCTOR: finds doctors.id of the logged-in doctor
async function attachDoctor(req, res, next) {
  const r = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
  if (r.rowCount === 0) return res.status(403).json({ message: 'No doctor profile found' });
  req.doctorId = r.rows[0].id;
  next();
}

module.exports = { authenticate, authorize, attachDoctor };