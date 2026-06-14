/**
 * Delete an existing user by email (if present) and create a fresh platform admin.
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL=hello@gatherrgo.com node backend/scripts/reset-platform-admin.js
 *
 * Or pass email as first CLI arg:
 *   node backend/scripts/reset-platform-admin.js hello@gatherrgo.com
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, pool } = require('../src/config/database');
const { resolveAuthEmail } = require('../src/utils/email.util');

async function main() {
  const rawEmail = process.argv[2] || process.env.PLATFORM_ADMIN_EMAIL || '';
  const resolved = resolveAuthEmail(rawEmail);
  if (!resolved) {
    console.error('ERROR: Provide PLATFORM_ADMIN_EMAIL env var or email as first argument.');
    process.exit(1);
  }

  const { display: email, normalized } = resolved;

  const existing = await query(
    'SELECT id, email, is_platform_admin FROM users WHERE email_normalized = $1',
    [normalized],
  );

  const rawPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  let userId;

  if (existing.rows.length) {
    const { id: oldId, is_platform_admin: wasAdmin } = existing.rows[0];
    console.log(`Found existing user: id=${oldId}, is_platform_admin=${wasAdmin}`);

    try {
      await query('DELETE FROM users WHERE id = $1', [oldId]);
      console.log('Deleted existing user (cascaded related rows).');
      const inserted = await query(
        `INSERT INTO users
           (email, email_normalized, password_hash, is_verified, is_profile_complete, is_platform_admin, password_reset_recommended)
         VALUES ($1, $2, $3, true, true, true, true)
         RETURNING id`,
        [email, normalized, passwordHash],
      );
      userId = inserted.rows[0].id;
    } catch (err) {
      if (err.code !== '23503') throw err;
      console.log(
        'Cannot delete — user is referenced by trips/events data. Resetting credentials in place instead.',
      );
      const updated = await query(
        `UPDATE users SET
           email_normalized            = $2,
           password_hash               = $3,
           is_verified                 = true,
           is_profile_complete         = true,
           is_platform_admin           = true,
           password_reset_recommended  = true,
           updated_at                  = NOW()
         WHERE id = $1
         RETURNING id`,
        [oldId, normalized, passwordHash],
      );
      userId = updated.rows[0].id;
    }
  } else {
    console.log('No existing user found — creating fresh platform admin.');
    const inserted = await query(
      `INSERT INTO users
         (email, email_normalized, password_hash, is_verified, is_profile_complete, is_platform_admin, password_reset_recommended)
       VALUES ($1, $2, $3, true, true, true, true)
       RETURNING id`,
      [email, normalized, passwordHash],
    );
    userId = inserted.rows[0].id;
  }

  await query(
    `INSERT INTO profiles (user_id, full_name)
     VALUES ($1, 'Platform Admin')
     ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name`,
    [userId],
  );

  console.log('='.repeat(58));
  console.log('Platform admin created successfully.');
  console.log(`User ID:            ${userId}`);
  console.log(`Email:              ${email}`);
  console.log(`Temporary password: ${rawPassword}`);
  console.log('SAVE THIS PASSWORD — it will not be shown again.');
  console.log('Change it via the Security section of the admin panel.');
  console.log('='.repeat(58));

  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  if (err.detail) console.error('Detail:', err.detail);
  if (err.constraint) console.error('Constraint:', err.constraint);
  process.exit(1);
});
