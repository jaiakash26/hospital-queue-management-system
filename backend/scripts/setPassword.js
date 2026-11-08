// File: backend/scripts/setPassword.js
// Sets a new password for ONE user.
// Usage: node scripts/setPassword.js admin@hqms.com "MyNewPassword"
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

const [email, newPassword] = process.argv.slice(2);

(async () => {
  if (!email || !newPassword || newPassword.length < 8) {
    console.log('Usage: node scripts/setPassword.js email "password-of-8-or-more-characters"');
    process.exit(1);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  const r = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email.toLowerCase()]);
  console.log(r.rowCount ? 'Password changed for ' + email : 'No user found with that email');
  await pool.end();
})();