/**
 * One-shot bootstrap: create or update the platform admin user.
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL=admin@example.com node backend/scripts/create-platform-admin.js
 *
 * The generated password is printed once to stdout — save it in a secrets
 * manager. The admin should change it via the Security section of the
 * admin panel (forgot-password → reset-password OTP flow).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, pool } = require('../src/config/database');
const { resolveAuthEmail } = require('../src/utils/email.util');

async function main() {
  const resolved = resolveAuthEmail(process.env.PLATFORM_ADMIN_EMAIL || '');
  if (!resolved) {
    console.error('ERROR: PLATFORM_ADMIN_EMAIL env var is required.');
    process.exit(1);
  }

  const { display: email, normalized } = resolved;

  const rawPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  await query(
    `INSERT INTO users
       (email, email_normalized, password_hash, is_verified, is_profile_complete, is_platform_admin, password_reset_recommended)
     VALUES ($1, $2, $3, true, true, true, true)
     ON CONFLICT (email) DO UPDATE SET
       email_normalized            = EXCLUDED.email_normalized,
       password_hash               = EXCLUDED.password_hash,
       is_verified                 = true,
       is_profile_complete         = true,
       is_platform_admin           = true,
       password_reset_recommended  = true,
       updated_at                  = NOW()`,
    [email, normalized, passwordHash],
  );

  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  const userId = rows[0].id;

  await query(
    `INSERT INTO profiles (user_id, full_name)
     VALUES ($1, 'Platform Admin')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  console.log('='.repeat(58));
  console.log('Platform admin created/updated successfully.');
  console.log(`Email:              ${email}`);
  console.log(`Temporary password: ${rawPassword}`);
  console.log('SAVE THIS PASSWORD — it will not be shown again.');
  console.log('Change it via the Security section of the admin panel.');
  console.log('='.repeat(58));

  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
