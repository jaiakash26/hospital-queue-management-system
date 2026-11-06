// File: backend/scripts/setPasswords.js
// Gives every sample user the password "password123" (real bcrypt hash).
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

(async () => {
  const hash = await bcrypt.hash('password123', 10);
  await pool.query('UPDATE users SET password_hash = $1', [hash]);
  console.log('Done! All sample users now have the password: password123');
  await pool.end();
})();