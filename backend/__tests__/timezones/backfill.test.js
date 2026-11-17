require('../setup');

// The script must never reach a real database in tests.
jest.mock('../../src/config/database', () => ({
  query: jest.fn(() => { throw new Error('real DB must not be used'); }),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn(), query: jest.fn(() => { throw new Error('real DB must not be used'); }) },
}));

const { run, assertSafeTarget } = require('../../scripts/backfill-timezones');

const NOW = new Date('2026-01-10T00:00:00.000Z');
const LONDON = { lat: '51.5074', lng: '-0.1278' };
const GOA = { lat: '15.2993', lng: '74.1240' };
const NYC = { lat: '40.7128', lng: '-74.0060' };

// ── In-memory tables + a router for exactly the SQL the script issues ─────────
const makeStore = () => ({
  users: [{ id: 'u-ber', timezone: 'Europe/Berlin' }, { id: 'u-none', timezone: null }, { id: 'u-ist', timezone: 'Asia/Kolkata' }],
  trips: [
    { id: 't-lon', ...{ location_lat: LONDON.lat, location_lng: LONDON.lng }, created_by: 'u-ist', timezone: null, start_date: '2026-02-01', created_at: 1 },
    // pg returns DATE columns as JS Dates at local midnight
    { id: 't-goa', location_lat: GOA.lat, location_lng: GOA.lng, created_by: 'u-ist', timezone: null, start_date: new Date(2026, 1, 1), created_at: 2 },
    { id: 't-ber', location_lat: null, location_lng: null, created_by: 'u-ber', timezone: null, start_date: '2026-02-01', created_at: 3 },
    { id: 't-def', location_lat: null, location_lng: null, created_by: 'u-none', timezone: null, start_date: '2026-02-01', created_at: 4 },
    { id: 't-done', location_lat: NYC.lat, location_lng: NYC.lng, created_by: 'u-ist', timezone: 'America/New_York', start_date: '2026-02-01', created_at: 5 },
  ],
  events: [
    { id: 'e-nyc', location_lat: NYC.lat, location_lng: NYC.lng, created_by: 'u-ist', timezone: null, event_date: '2026-02-01', created_at: 1 },
  ],
  trip_reminders: [
    // Today's (IST) times — 03:30Z
    { id: 'tr-lon-start', trip_id: 't-lon', reminder_type: 'trip_start', scheduled_at: new Date('2026-02-01T03:30:00Z'), sent_at: null },
    { id: 'tr-lon-1d', trip_id: 't-lon', reminder_type: '1_day_before', scheduled_at: new Date('2026-01-31T03:30:00Z'), sent_at: null },
    { id: 'tr-lon-sent', trip_id: 't-lon', reminder_type: '1_week_before', scheduled_at: new Date('2026-01-25T03:30:00Z'), sent_at: new Date('2026-01-01T00:00:00Z') },
    { id: 'tr-goa-start', trip_id: 't-goa', reminder_type: 'trip_start', scheduled_at: new Date('2026-02-01T03:30:00Z'), sent_at: null },
    { id: 'tr-done-start', trip_id: 't-done', reminder_type: 'trip_start', scheduled_at: new Date('2026-02-01T03:30:00Z'), sent_at: null },
  ],
  event_reminders: [
    { id: 'er-nyc-start', event_id: 'e-nyc', reminder_type: 'event_start', scheduled_at: new Date('2026-02-01T03:30:00Z'), sent_at: null },
    // due but unsent (in the past) — must be left alone
    { id: 'er-nyc-past', event_id: 'e-nyc', reminder_type: '1_week_before', scheduled_at: new Date('2026-01-09T03:30:00Z'), sent_at: null },
  ],
  trip_activities: [
    { id: 'a-lon', trip_id: 't-lon', activity_date: '2026-02-02', activity_time: '09:00:00' },
    { id: 'a-goa', trip_id: 't-goa', activity_date: '2026-02-02', activity_time: '09:00:00' },
  ],
  activity_reminders: [
    { id: 'ar-lon-10', activity_id: 'a-lon', trip_id: 't-lon', reminder_minutes: 10, remind_at: new Date('2026-02-02T03:20:00Z'), sent_at: null },
    { id: 'ar-lon-60', activity_id: 'a-lon', trip_id: 't-lon', reminder_minutes: 60, remind_at: new Date('2026-02-02T02:30:00Z'), sent_at: new Date('2026-01-05T00:00:00Z') },
    { id: 'ar-goa-10', activity_id: 'a-goa', trip_id: 't-goa', reminder_minutes: 10, remind_at: new Date('2026-02-02T03:20:00Z'), sent_at: null },
  ],
});

const fakeDb = (store) => {
  const writes = [];
  const byId = (rows, id) => rows.find((r) => r.id === id);
  const query = jest.fn(async (sql, params = []) => {
    let m;
    if ((m = sql.match(/FROM (trips|events) x LEFT JOIN users u/))) {
      const rows = store[m[1]].filter((x) => x.timezone === null).map((x) => ({
        id: x.id, location_lat: x.location_lat, location_lng: x.location_lng,
        creator_timezone: byId(store.users, x.created_by)?.timezone ?? null,
      }));
      return { rows, rowCount: rows.length };
    }
    if ((m = sql.match(/^UPDATE (trips|events) SET timezone = \$2 WHERE id = \$1 AND timezone IS NULL$/))) {
      writes.push([sql, params]);
      const row = byId(store[m[1]], params[0]);
      if (row && row.timezone === null) { row.timezone = params[1]; return { rowCount: 1, rows: [] }; }
      return { rowCount: 0, rows: [] };
    }
    if ((m = sql.match(/FROM (trip_reminders|event_reminders) r JOIN (trips|events) p/))) {
      const fk = m[1] === 'trip_reminders' ? 'trip_id' : 'event_id';
      const dateCol = m[2] === 'trips' ? 'start_date' : 'event_date';
      const rows = store[m[1]].filter((r) => r.sent_at === null && r.scheduled_at > NOW).map((r) => {
        const p = byId(store[m[2]], r[fk]);
        return { id: r.id, parent_id: r[fk], reminder_type: r.reminder_type, current: r.scheduled_at, start_date: p[dateCol], timezone: p.timezone };
      });
      return { rows, rowCount: rows.length };
    }
    if (/FROM activity_reminders ar/.test(sql)) {
      const rows = store.activity_reminders.filter((r) => r.sent_at === null && r.remind_at > NOW).map((r) => {
        const a = byId(store.trip_activities, r.activity_id);
        return {
          id: r.id, trip_id: r.trip_id, reminder_minutes: r.reminder_minutes, current: r.remind_at,
          activity_date: a.activity_date, activity_time: a.activity_time, timezone: byId(store.trips, r.trip_id).timezone,
        };
      });
      return { rows, rowCount: rows.length };
    }
    if ((m = sql.match(/^UPDATE (trip_reminders|event_reminders|activity_reminders) SET (scheduled_at|remind_at) = \$2 WHERE id = \$1 AND sent_at IS NULL AND \2 > NOW\(\)$/))) {
      writes.push([sql, params]);
      const row = byId(store[m[1]], params[0]);
      if (row && row.sent_at === null && row[m[2]] > NOW) { row[m[2]] = new Date(params[1]); return { rowCount: 1, rows: [] }; }
      return { rowCount: 0, rows: [] };
    }
    if ((m = sql.match(/^DELETE FROM (trip_reminders|event_reminders|activity_reminders) WHERE id = \$1 AND sent_at IS NULL AND (scheduled_at|remind_at) > NOW\(\)$/))) {
      writes.push([sql, params]);
      const i = store[m[1]].findIndex((r) => r.id === params[0] && r.sent_at === null && r[m[2]] > NOW);
      if (i >= 0) { store[m[1]].splice(i, 1); return { rowCount: 1, rows: [] }; }
      return { rowCount: 0, rows: [] };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  });
  return { query, writes };
};

const total = (byZone) => Object.values(byZone).reduce((a, b) => a + b, 0);

describe('backfill-timezones', () => {
  it('dry run (default) writes nothing but reports what it would do', async () => {
    const store = makeStore();
    const before = JSON.stringify(store);
    const { query, writes } = fakeDb(store);

    const counts = await run({ query, now: NOW });

    expect(writes).toHaveLength(0);
    expect(JSON.stringify(store)).toBe(before);
    expect(counts.timezones).toEqual({
      trips: { 'Europe/London': 1, 'Asia/Kolkata': 2, 'Europe/Berlin': 1 },
      events: { 'America/New_York': 1 },
    });
    // London trip: start + 1d move (sent 1w untouched); Goa unchanged; already-set NY trip moves
    expect(counts.reminders.trip).toEqual({
      rescheduled: { 'Europe/London': 2, 'America/New_York': 1 }, unchanged: 1, droppedPast: 0, skippedInvalid: 0,
    });
    expect(counts.reminders.event).toEqual({ rescheduled: { 'America/New_York': 1 }, unchanged: 0, droppedPast: 0, skippedInvalid: 0 });
    expect(counts.reminders.activity).toEqual({ rescheduled: { 'Europe/London': 1 }, unchanged: 1, droppedPast: 0, skippedInvalid: 0 });
  });

  it('real run fills zones and moves only unsent future reminders to the local time', async () => {
    const store = makeStore();
    const { query } = fakeDb(store);

    await run({ query, apply: true, now: NOW });

    const get = (table, id) => store[table].find((r) => r.id === id);
    expect(store.trips.map((t) => t.timezone)).toEqual(
      ['Europe/London', 'Asia/Kolkata', 'Europe/Berlin', 'Asia/Kolkata', 'America/New_York'],
    );
    expect(get('events', 'e-nyc').timezone).toBe('America/New_York');

    expect(get('trip_reminders', 'tr-lon-start').scheduled_at.toISOString()).toBe('2026-02-01T09:00:00.000Z');
    expect(get('trip_reminders', 'tr-lon-1d').scheduled_at.toISOString()).toBe('2026-01-31T09:00:00.000Z');
    expect(get('trip_reminders', 'tr-done-start').scheduled_at.toISOString()).toBe('2026-02-01T14:00:00.000Z');
    expect(get('event_reminders', 'er-nyc-start').scheduled_at.toISOString()).toBe('2026-02-01T14:00:00.000Z');
    expect(get('activity_reminders', 'ar-lon-10').remind_at.toISOString()).toBe('2026-02-02T08:50:00.000Z');

    // IST trip: unchanged (regression lock)
    expect(get('trip_reminders', 'tr-goa-start').scheduled_at.toISOString()).toBe('2026-02-01T03:30:00.000Z');
    expect(get('activity_reminders', 'ar-goa-10').remind_at.toISOString()).toBe('2026-02-02T03:20:00.000Z');
    // Sent and already-due reminders: untouched
    expect(get('trip_reminders', 'tr-lon-sent').scheduled_at.toISOString()).toBe('2026-01-25T03:30:00.000Z');
    expect(get('activity_reminders', 'ar-lon-60').remind_at.toISOString()).toBe('2026-02-02T02:30:00.000Z');
    expect(get('event_reminders', 'er-nyc-past').scheduled_at.toISOString()).toBe('2026-01-09T03:30:00.000Z');
  });

  it('every write is guarded: zones only where NULL, reminders only unsent and in the future', async () => {
    const { query, writes } = fakeDb(makeStore());
    await run({ query, apply: true, now: NOW });
    expect(writes.length).toBeGreaterThan(0);
    for (const [sql] of writes) {
      expect(sql).toMatch(/timezone IS NULL$|sent_at IS NULL AND (scheduled_at|remind_at) > NOW\(\)$/);
    }
  });

  it('second run is a no-op', async () => {
    const store = makeStore();
    await run({ query: fakeDb(store).query, apply: true, now: NOW });
    const after = JSON.stringify(store);

    const second = fakeDb(store);
    const counts = await run({ query: second.query, apply: true, now: NOW });

    expect(second.writes).toHaveLength(0);
    expect(JSON.stringify(store)).toBe(after);
    expect(total(counts.timezones.trips) + total(counts.timezones.events)).toBe(0);
    for (const kind of ['activity', 'trip', 'event']) expect(total(counts.reminders[kind].rescheduled)).toBe(0);
  });

  const tokyoStore = () => {
    const store = makeStore();
    // Tokyo is ahead of India: 09:00 JST = 00:00Z, before the stored 03:30Z
    store.trips = [{ id: 't-tyo', location_lat: '35.6762', location_lng: '139.6503', created_by: 'u-ist', timezone: null, start_date: '2026-01-10', created_at: 1 }];
    store.trip_reminders = [{ id: 'tr-tyo', trip_id: 't-tyo', reminder_type: 'trip_start', scheduled_at: new Date('2026-01-10T03:30:00Z'), sent_at: null }];
    store.trip_activities = [{ id: 'a-tyo', trip_id: 't-tyo', activity_date: '2026-01-10', activity_time: '09:05:00' }];
    // 09:05 JST - 10 min = 23:55Z on 9 Jan (passed); the stored IST time 03:25Z is still ahead
    store.activity_reminders = [{ id: 'ar-tyo', activity_id: 'a-tyo', trip_id: 't-tyo', reminder_minutes: 10, remind_at: new Date('2026-01-10T03:25:00Z'), sent_at: null }];
    store.events = []; store.event_reminders = [];
    return store;
  };

  it('an unsent reminder whose corrected time has already passed is deleted, not fired late', async () => {
    const store = tokyoStore();
    const { query, writes } = fakeDb(store);
    const counts = await run({ query, apply: true, now: NOW }); // now = 2026-01-10T00:00Z: 00:00Z is not in the future
    expect(counts.reminders.trip).toMatchObject({ droppedPast: 1, skippedInvalid: 0 });
    expect(counts.reminders.activity).toMatchObject({ droppedPast: 1, skippedInvalid: 0 });
    expect(store.trip_reminders).toHaveLength(0);
    expect(store.activity_reminders).toHaveLength(0);
    expect(writes.filter(([sql]) => /^DELETE/.test(sql)).map(([sql]) => sql)).toEqual([
      'DELETE FROM trip_reminders WHERE id = $1 AND sent_at IS NULL AND scheduled_at > NOW()',
      'DELETE FROM activity_reminders WHERE id = $1 AND sent_at IS NULL AND remind_at > NOW()',
    ]);
  });

  it('dry run only counts reminders it would delete', async () => {
    const store = tokyoStore();
    const before = JSON.stringify(store);
    const { query, writes } = fakeDb(store);
    const counts = await run({ query, now: NOW });
    expect(counts.reminders.trip.droppedPast).toBe(1);
    expect(counts.reminders.activity.droppedPast).toBe(1);
    expect(writes).toHaveLength(0);
    expect(JSON.stringify(store)).toBe(before);
  });

  it('sent and already-due reminders are never deleted, even when their corrected time has passed', async () => {
    const store = tokyoStore();
    store.trip_reminders.push(
      { id: 'tr-tyo-sent', trip_id: 't-tyo', reminder_type: '1_day_before', scheduled_at: new Date('2026-01-10T03:30:00Z'), sent_at: new Date('2026-01-09T00:00:00Z') },
      { id: 'tr-tyo-due', trip_id: 't-tyo', reminder_type: '3_days_before', scheduled_at: new Date('2026-01-07T03:30:00Z'), sent_at: null },
    );
    await run({ query: fakeDb(store).query, apply: true, now: NOW });
    expect(store.trip_reminders.map((r) => r.id)).toEqual(['tr-tyo-sent', 'tr-tyo-due']);
  });

  it('a reminder whose time cannot be computed is left as is', async () => {
    const store = tokyoStore();
    store.trip_reminders[0].reminder_type = 'unknown_type';
    const { query, writes } = fakeDb(store);
    const counts = await run({ query, apply: true, now: NOW });
    expect(counts.reminders.trip).toMatchObject({ droppedPast: 0, skippedInvalid: 1 });
    expect(writes.filter(([sql]) => /trip_reminders/.test(sql))).toHaveLength(0);
  });

  describe('production guard', () => {
    it.each(['localhost', '127.0.0.1', '::1', 'LOCALHOST'])('allows %s', (host) => {
      expect(() => assertSafeTarget(host, [])).not.toThrow();
    });
    it.each(['gathergo.abc123.ap-south-1.rds.amazonaws.com', '10.0.0.5', '', undefined])('refuses %s without --prod', (host) => {
      expect(() => assertSafeTarget(host, ['--apply'])).toThrow(/Refusing to run/);
    });
    it('allows a remote host only with an explicit --prod', () => {
      expect(() => assertSafeTarget('db.example.rds.amazonaws.com', ['--prod'])).not.toThrow();
    });
  });
});
