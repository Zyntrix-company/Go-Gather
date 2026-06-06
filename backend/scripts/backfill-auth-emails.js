/**
 * Backfill users.email_normalized via normalizeAuthEmail().
 * Run after migration 045.
 *
 * Usage: node scripts/backfill-auth-emails.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { pool } = require('../src/config/database');
const { normalizeAuthEmail } = require('../src/utils/email.util');

async function main() {
  const { rows } = await pool.query(
    'SELECT id, email, email_normalized FROM users ORDER BY created_at ASC',
  );
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const normalized = normalizeAuthEmail(row.email);
    if (!normalized) {
      console.warn(`[skip-invalid] ${row.id} ${row.email}`);
      continue;
    }

    if (row.email_normalized === normalized) {
      skipped += 1;
      continue;
    }

    const conflict = await pool.query(
      'SELECT id FROM users WHERE email_normalized = $1 AND id <> $2',
      [normalized, row.id],
    );

    if (conflict.rows.length > 0) {
      console.warn(
        `[skip-conflict] ${row.email} -> ${normalized} (already owned by ${conflict.rows[0].id})`,
      );
      continue;
    }

    await pool.query(
      'UPDATE users SET email_normalized = $1, updated_at = NOW() WHERE id = $2',
      [normalized, row.id],
    );
    console.log(`[updated] ${row.email} normalized -> ${normalized}`);
    updated += 1;
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
