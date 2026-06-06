/**
 * Verifies duplicate-reminder fix: unique index + atomic cron claim.
 * Run: node scripts/verify-reminder-dedup.js
 * Requires .env with RDS credentials (uses same pool as app).
 */
const { pool } = require('../src/config/database');
const { processReminders } = require('../src/utils/reminders.cron');

const UPSERT_SQL = `
  INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at)
  VALUES ($1, $2, $3)
  ON CONFLICT (trip_id, reminder_type) WHERE sent_at IS NULL
  DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at
`;

async function main() {
  const client = await pool.connect();
  let tripId;
  let userId;

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `SELECT id FROM users ORDER BY created_at LIMIT 1`,
    );
    if (userRes.rowCount === 0) throw new Error('No users in DB — run seed first');
    userId = userRes.rows[0].id;

    const tripRes = await client.query(
      `INSERT INTO trips (name, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Dedup Test Trip', '2099-01-01', '2099-01-07', userId],
    );
    tripId = tripRes.rows[0].id;

    await client.query(
      'INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3)',
      [tripId, userId, 'admin'],
    );

    const scheduledAt = new Date(Date.now() - 60000).toISOString();

    // Simulate concurrent scheduling: 5 upserts for same type
    for (let i = 0; i < 5; i++) {
      await client.query(UPSERT_SQL, [tripId, '1_week_before', scheduledAt]);
    }

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM trip_reminders
       WHERE trip_id = $1 AND reminder_type = '1_week_before' AND sent_at IS NULL`,
      [tripId],
    );
    const pendingCount = countRes.rows[0].cnt;
    if (pendingCount !== 1) {
      throw new Error(`Expected 1 pending reminder row, got ${pendingCount}`);
    }
    console.log('✔ UPSERT: only 1 pending row after 5 concurrent-style inserts');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Parallel cron runs — should claim same row only once
  const beforeNotif = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM notifications
     WHERE type = 'TRIP_REMINDER' AND data->>'tripId' = $1`,
    [tripId],
  );

  await Promise.all([processReminders(), processReminders(), processReminders()]);

  const afterNotif = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM notifications
     WHERE type = 'TRIP_REMINDER' AND data->>'tripId' = $1 AND data->>'reminderType' = '1_week_before'`,
    [tripId],
  );

  const sent = afterNotif.rows[0].cnt - beforeNotif.rows[0].cnt;
  if (sent !== 1) {
    throw new Error(`Expected 1 notification from parallel cron, got ${sent} new rows`);
  }
  console.log('✔ Cron claim: parallel processReminders() created exactly 1 notification');

  const sentRow = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM trip_reminders
     WHERE trip_id = $1 AND reminder_type = '1_week_before' AND sent_at IS NOT NULL`,
    [tripId],
  );
  if (sentRow.rows[0].cnt !== 1) {
    throw new Error(`Expected 1 sent reminder row, got ${sentRow.rows[0].cnt}`);
  }
  console.log('✔ Reminder row marked sent once');

  // Cleanup
  await pool.query('DELETE FROM notifications WHERE data->>\'tripId\' = $1', [tripId]);
  await pool.query('DELETE FROM trip_reminders WHERE trip_id = $1', [tripId]);
  await pool.query('DELETE FROM trip_members WHERE trip_id = $1', [tripId]);
  await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);

  console.log('\nAll reminder dedup checks passed.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Verification failed:', err.message);
  try { await pool.end(); } catch (_) { /* ignore */ }
  process.exit(1);
});
