/**
 * Backfill trips.timezone / events.timezone (migration 076) and move UNSENT, FUTURE
 * reminders of all three kinds (activity, trip, event) to the correct local time.
 *
 * Usage:
 *   node scripts/backfill-timezones.js            # dry run (default): prints counts, writes nothing
 *   node scripts/backfill-timezones.js --apply    # writes
 *   ... --prod                                    # required when the DB host is not localhost —
 *                                                 # only after a fresh RDS snapshot
 *
 * Idempotent: only NULL time zones are filled, and a reminder is updated only when its
 * corrected time differs from the stored one — a second run reports 0 changes.
 * Sent reminders and reminders already due (scheduled in the past) are never touched; a
 * reminder whose corrected time has already passed is left as is (it still fires once).
 *
 * Time zone resolution matches the app (src/utils/localTime.js): coordinates → creator's
 * users.timezone → Asia/Kolkata. Reminder times always use the TRIP_TIMEZONES=on rules,
 * whatever the flag is set to.
 */
const path = require('path');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const { DEFAULT_TIME_ZONE, localToUtc, resolveTimeZone } = require('../src/utils/localTime');
const { startReminderTimes } = require('../src/utils/reminders.cron');

const sameInstant = (a, b) => new Date(a).getTime() === new Date(b).getTime();

const bump = (counts, ...keys) => {
  let node = counts;
  for (let i = 0; i < keys.length - 1; i += 1) node = node[keys[i]] = node[keys[i]] || {};
  const last = keys[keys.length - 1];
  node[last] = (node[last] || 0) + 1;
};

/**
 * @param {{ query: Function, apply?: boolean, now?: Date }} opts
 *   query: (sql, params) => Promise<{ rows, rowCount }>
 * @returns counts { timezones: { trips: {zone:n}, events: {zone:n} },
 *                   reminders: { activity|trip|event: { rescheduled: {zone:n}, unchanged, skippedPast } } }
 */
const run = async ({ query, apply = false, now = new Date() }) => {
  const counts = {
    timezones: { trips: {}, events: {} },
    reminders: {
      activity: { rescheduled: {}, unchanged: 0, skippedPast: 0 },
      trip: { rescheduled: {}, unchanged: 0, skippedPast: 0 },
      event: { rescheduled: {}, unchanged: 0, skippedPast: 0 },
    },
  };

  // ── 1. Fill missing time zones (resolved values kept in memory so a dry run
  //       computes reminder times exactly as a real run would) ──
  const resolved = { trips: new Map(), events: new Map() };
  for (const table of ['trips', 'events']) {
    const { rows } = await query(
      `SELECT x.id, x.location_lat, x.location_lng, u.timezone AS creator_timezone
       FROM ${table} x LEFT JOIN users u ON u.id = x.created_by
       WHERE x.timezone IS NULL
       ORDER BY x.created_at`,
      [],
    );
    for (const row of rows) {
      const zone = await resolveTimeZone(row.location_lat, row.location_lng, async () => row.creator_timezone);
      resolved[table].set(row.id, zone);
      bump(counts.timezones, table, zone);
      if (apply) {
        await query(`UPDATE ${table} SET timezone = $2 WHERE id = $1 AND timezone IS NULL`, [row.id, zone]);
      }
    }
  }

  const zoneOf = (table, id, stored) => resolved[table].get(id) || stored || DEFAULT_TIME_ZONE;

  const reschedule = async (kind, table, row, zone, target) => {
    const bucket = counts.reminders[kind];
    if (!target || !(target > now)) { bucket.skippedPast += 1; return; }
    if (sameInstant(target, row.current)) { bucket.unchanged += 1; return; }
    bump(bucket, 'rescheduled', zone);
    if (apply) {
      const column = kind === 'activity' ? 'remind_at' : 'scheduled_at';
      await query(
        `UPDATE ${table} SET ${column} = $2 WHERE id = $1 AND sent_at IS NULL AND ${column} > NOW()`,
        [row.id, target.toISOString()],
      );
    }
  };

  // ── 2. Trip and event day reminders (unsent, future) ──
  const dayReminderKinds = [
    { kind: 'trip', table: 'trip_reminders', parent: 'trips', fk: 'trip_id', dateColumn: 'start_date', startType: 'trip_start' },
    { kind: 'event', table: 'event_reminders', parent: 'events', fk: 'event_id', dateColumn: 'event_date', startType: 'event_start' },
  ];
  for (const k of dayReminderKinds) {
    const { rows } = await query(
      `SELECT r.id, r.${k.fk} AS parent_id, r.reminder_type, r.scheduled_at AS current,
              p.${k.dateColumn} AS start_date, p.timezone
       FROM ${k.table} r JOIN ${k.parent} p ON p.id = r.${k.fk}
       WHERE r.sent_at IS NULL AND r.scheduled_at > NOW()
       ORDER BY r.scheduled_at`,
      [],
    );
    for (const row of rows) {
      const zone = zoneOf(k.parent, row.parent_id, row.timezone);
      const match = startReminderTimes(row.start_date, zone, k.startType, { useLocalTime: true })
        .find((t) => t.type === row.reminder_type);
      await reschedule(k.kind, k.table, row, zone, match ? match.date : null);
    }
  }

  // ── 3. Activity reminders (unsent, future): activity date + time in the trip's zone ──
  const { rows: activityRows } = await query(
    `SELECT ar.id, ar.trip_id, ar.reminder_minutes, ar.remind_at AS current,
            a.activity_date, a.activity_time, t.timezone
     FROM activity_reminders ar
     JOIN trip_activities a ON a.id = ar.activity_id
     JOIN trips t ON t.id = ar.trip_id
     WHERE ar.sent_at IS NULL AND ar.remind_at > NOW()
     ORDER BY ar.remind_at`,
    [],
  );
  for (const row of activityRows) {
    const zone = zoneOf('trips', row.trip_id, row.timezone);
    const start = localToUtc(row.activity_date, row.activity_time, zone);
    const target = start ? new Date(start.getTime() - row.reminder_minutes * 60000) : null;
    await reschedule('activity', 'activity_reminders', row, zone, target);
  }

  return counts;
};

const printCounts = (counts, apply) => {
  const verb = apply ? 'Updated' : 'Would update';
  /* eslint-disable no-console */
  console.log(`\n${apply ? 'APPLY' : 'DRY RUN (nothing written — pass --apply to write)'}`);
  for (const table of ['trips', 'events']) {
    const byZone = counts.timezones[table];
    const total = Object.values(byZone).reduce((a, b) => a + b, 0);
    console.log(`\n${verb} timezone on ${total} ${table}:`);
    for (const [zone, n] of Object.entries(byZone).sort()) console.log(`  ${zone.padEnd(32)} ${n}`);
  }
  for (const kind of ['activity', 'trip', 'event']) {
    const r = counts.reminders[kind];
    const total = Object.values(r.rescheduled).reduce((a, b) => a + b, 0);
    console.log(`\n${kind} reminders — ${verb.toLowerCase()} ${total}, unchanged ${r.unchanged}, left as is (corrected time already passed) ${r.skippedPast}`);
    for (const [zone, n] of Object.entries(r.rescheduled).sort()) console.log(`  ${zone.padEnd(32)} ${n}`);
  }
  /* eslint-enable no-console */
};

/** Exit unless the DB is local, or --prod was passed explicitly. */
const assertSafeTarget = (host, argv) => {
  if (LOCAL_HOSTS.has(String(host || '').toLowerCase())) return;
  if (argv.includes('--prod')) return;
  const err = new Error(
    `Refusing to run against DB host "${host}". This script only runs against localhost unless --prod `
    + 'is passed (only after taking a fresh RDS snapshot).',
  );
  err.code = 'UNSAFE_TARGET';
  throw err;
};

const main = async () => {
  const argv = process.argv.slice(2);
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  const config = require('../src/config');
  assertSafeTarget(config.db.host, argv); // before any connection is opened

  const { pool } = require('../src/config/database');
  const apply = argv.includes('--apply');
  try {
    const counts = await run({ query: (sql, params) => pool.query(sql, params), apply });
    printCounts(counts, apply);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err.message || err.code || err);
    process.exit(1);
  });
}

module.exports = { run, assertSafeTarget, printCounts };
