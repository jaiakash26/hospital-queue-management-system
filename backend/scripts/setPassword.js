// File: backend/scripts/setPassword.js
// Asks for the email and a new password, then saves it (bcrypt-hashed).
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

(async () => {
  const email = (await ask('Email of the user: ')).trim();
  const password = (await ask('New password (8+ characters): ')).trim();
  rl.close();

  if (password.length < 8) {
    console.log('Password is too short. Nothing changed.');
  } else {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email.toLowerCase()]);
    console.log(r.rowCount ? 'Password changed for ' + email : 'No user found with that email');
  }
  await pool.end();
})();