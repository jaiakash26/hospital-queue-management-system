// File: backend/src/config/db.js
// One shared connection pool to PostgreSQL (Neon).
const dns = require('dns');
const { Pool, types } = require('pg');

// ---- DNS FIX ----
// This network's DNS refuses to find Neon, so for neon.tech names
// we ask Google DNS (8.8.8.8) instead. Other names work as usual.
const googleDns = new dns.Resolver();
googleDns.setServers(['8.8.8.8', '8.8.4.4']);
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (typeof options === 'number') options = { family: options };
  if (!hostname.endsWith('neon.tech')) return originalLookup(hostname, options, callback);

  googleDns.resolve4(hostname, (err, addresses) => {
    if (err) return originalLookup(hostname, options, callback); // fall back to normal
    if (options.all) return callback(null, addresses.map((a) => ({ address: a, family: 4 })));
    callback(null, addresses[0], 4);
  });
};
// -----------------

// By default pg turns DATE into a JS Date (timezone bugs). Keep it a "YYYY-MM-DD" string.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon needs SSL, local PostgreSQL does not
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Run several queries as ONE unit. If any fails, ALL are undone (ROLLBACK).
pool.withTransaction = async (work) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // always give the connection back
  }
};

module.exports = pool;