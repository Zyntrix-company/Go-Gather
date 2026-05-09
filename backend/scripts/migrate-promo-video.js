/**
 * One-shot: creates the promo_video table (if not exists).
 * Safe to re-run.
 *
 * Usage:
 *   node backend/scripts/migrate-promo-video.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { query, pool } = require('../src/config/database');

async function main() {
  console.log('Creating promo_video table...');

  await query(`
    CREATE TABLE IF NOT EXISTS promo_video (
      id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      video_url  TEXT    NOT NULL,
      s3_key     TEXT    NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_promo_video_updated_at'
      ) THEN
        CREATE TRIGGER update_promo_video_updated_at
          BEFORE UPDATE ON promo_video
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END
    $$
  `);

  console.log('Done — promo_video table ready.');
  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
