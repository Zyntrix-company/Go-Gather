/**
 * One-time backfill: canonicalize users.email via normalizeAuthEmail().
 * Run after migration 044 if you have existing Gmail/Outlook alias duplicates.
 *
 * Usage: node scripts/backfill-auth-emails.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { pool } = require('../src/config/database');
const { normalizeAuthEmail } = require('../src/utils/email.util');

async function main() {
  const { rows } = await pool.query('SELECT id, email FROM users ORDER BY created_at ASC');
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const canonical = normalizeAuthEmail(row.email);
    if (!canonical || canonical === row.email) {
      skipped += 1;
      continue;
    }

    const conflict = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2',
      [canonical, row.id],
    );

    if (conflict.rows.length > 0) {
      console.warn(
        `[skip-conflict] ${row.email} -> ${canonical} (already owned by ${conflict.rows[0].id})`,
      );
      continue;
    }

    await pool.query(
      'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2',
      [canonical, row.id],
    );
    console.log(`[updated] ${row.email} -> ${canonical}`);
    updated += 1;
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
