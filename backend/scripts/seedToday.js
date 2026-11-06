// File: backend/scripts/seedToday.js
// Recreates the sample queue for TODAY in India time (so it matches the app).
require('dotenv').config();
const pool = require('../src/config/db');
const { todayStr } = require('../src/utils/helpers');

(async () => {
  const today = todayStr();
  // Remove old sample queue data, then re-add it with today's date
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM prescriptions');
  await pool.query('DELETE FROM queue_tokens');
  await pool.query('DELETE FROM appointments');

  await pool.query(
    `INSERT INTO appointments (patient_id, walk_in_name, walk_in_phone, doctor_id, appointment_date, slot_start, slot_end, type, status, reason) VALUES
     (6,    NULL,   NULL,         1, $1, '09:00', '09:10', 'online',  'completed',   'Fever and cold'),
     (7,    NULL,   NULL,         1, $1, '09:10', '09:20', 'online',  'in_progress', 'Headache'),
     (8,    NULL,   NULL,         1, $1, '09:20', '09:30', 'online',  'booked',      'Body pain'),
     (NULL, 'Ravi', '9200000001', 1, $1, NULL,    NULL,    'walk_in', 'booked',      'Stomach ache')`,
    [today]
  );
  const a = await pool.query('SELECT id FROM appointments ORDER BY id');
  const ids = a.rows.map((r) => r.id);

  await pool.query(
    `INSERT INTO queue_tokens (appointment_id, doctor_id, token_date, token_number, status, called_at, completed_at) VALUES
     ($1, 1, $5, 1, 'completed', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes'),
     ($2, 1, $5, 2, 'called',    NOW() - INTERVAL '5 minutes',  NULL),
     ($3, 1, $5, 3, 'waiting',   NULL, NULL),
     ($4, 1, $5, 4, 'waiting',   NULL, NULL)`,
    [ids[0], ids[1], ids[2], ids[3], today]
  );

  await pool.query(
    `INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, diagnosis, medicines, notes)
     VALUES ($1, 1, 6, 'Viral fever',
     '[{"name":"Paracetamol 500mg","dosage":"1 tablet","frequency":"3 times a day","days":3}]',
     'Drink plenty of water and take rest.')`,
    [ids[0]]
  );

  console.log('Done! Sample queue created for ' + today);
  await pool.end();
})().catch((e) => { console.log('ERROR:', e.message); process.exit(1); });