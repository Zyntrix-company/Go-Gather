/**
 * One-off data migration: promote user_gallery_extra_photos into shared photos.
 * Run after deploying migration 053_shared_gallery_promote_extras.sql if needed standalone.
 *
 * Usage: node backend/scripts/promote-gallery-extras.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../src/config/database');

async function main() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const insertResult = await client.query(`
      INSERT INTO photos (
        parent_type, parent_id, uploaded_by, file_url, s3_key, mime_type,
        activity_id, display_order, created_at
      )
      SELECT
        e.parent_type,
        e.parent_id,
        e.user_id,
        e.file_url,
        e.s3_key,
        e.mime_type,
        NULL,
        COALESCE(
          (SELECT COALESCE(MAX(ph.display_order), -1) + 1
           FROM photos ph
           WHERE ph.parent_type = e.parent_type AND ph.parent_id = e.parent_id),
          0
        ),
        e.created_at
      FROM user_gallery_extra_photos e
      WHERE NOT EXISTS (
        SELECT 1 FROM photos ph WHERE ph.s3_key = e.s3_key
      )
      RETURNING id
    `);

    await client.query(`
      UPDATE user_gallery_item_meta
      SET archived_at = NULL, updated_at = NOW()
      WHERE parent_type IN ('trip', 'event') AND archived_at IS NOT NULL
    `);

    await client.query('TRUNCATE user_gallery_hidden_photos');
    await client.query('TRUNCATE user_gallery_extra_photos');

    await client.query('COMMIT');
    console.log(`Promoted ${insertResult.rowCount} extra photo(s) to shared photos.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

main();
