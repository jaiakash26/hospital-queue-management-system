// File: backend/scripts/runSql.js
// Runs a .sql file against Neon.
// It looks up the database address using Google DNS (8.8.8.8),
// because this network's own DNS refuses the lookup.
const path = require('path');
const fs = require('fs');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const file = process.argv[2];
if (!file) {
  console.log('Usage: node backend/scripts/runSql.js database/schema.sql');
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Ask Google DNS for the IPv4 address of the Neon host
async function findIp(hostname) {
  const resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '8.8.4.4']);
  const ips = await resolver.resolve4(hostname);
  return ips[0];
}

(async () => {
  const sql = fs.readFileSync(file, 'utf8');
  for (let attempt = 1; attempt <= 6; attempt++) {
    let pool;
    try {
      console.log(`Attempt ${attempt}: finding database address...`);
      const ip = await findIp(url.hostname);
      console.log('Address found: ' + ip + ' - connecting...');
      pool = new Pool({
        host: ip,                              // connect to the IP directly
        port: Number(url.port) || 5432,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { servername: url.hostname, rejectUnauthorized: false }, // Neon needs the host name here
      });
      await pool.query(sql);
      console.log('SUCCESS: ' + file + ' ran without errors');
      await pool.end();
      return;
    } catch (err) {
      console.log('Not ready yet: ' + err.message);
      if (pool) await pool.end().catch(() => {});
      if (attempt < 6) await wait(8000);
    }
  }
  console.log('Gave up. Send me the messages above.');
})();