/**
 * Runs migrations/truncate_all.sql against the DB from .env (same as seed scripts).
 *
 * Usage:
 *   node backend/scripts/run-truncate.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { query, pool } = require('../src/config/database');

async function main() {
  const sqlPath = path.join(__dirname, '../migrations/truncate_all.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Running truncate_all.sql…');
  await query(sql);
  console.log('Truncate complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
