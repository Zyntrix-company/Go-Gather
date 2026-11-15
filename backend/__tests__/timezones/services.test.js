require('../setup');

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));
jest.mock('../../src/config/aws', () => ({ s3Client: {}, sesClient: { send: jest.fn() }, snsClient: { send: jest.fn() } }));
jest.mock('../../src/utils/s3.util', () => ({
  batchDeleteFromS3: jest.fn(), getPresignedDownloadUrl: jest.fn(), deleteFromS3: jest.fn(),
}));
jest.mock('../../src/utils/fcm.util', () => ({
  createAndSendNotifications: jest.fn(), createAndSendNotification: jest.fn(), notifySafely: jest.fn(),
  sendFCMNotification: jest.fn(), isInQuietHours: jest.fn(),
}));
jest.mock('../../src/utils/mailer', () => ({
  sendEmail: jest.fn(), wrapEmail: jest.fn((x) => x), sendTripCancelledEmail: jest.fn(),
}));

const db = require('../../src/config/database');
const config = require('../../src/config');
const trips = require('../../src/modules/trips/trips.service');
const events = require('../../src/modules/events/events.service');

// ── Oracle: today's day-reminder rule, copied verbatim ───────────────────────
const legacyDayReminders = (startDate, startType) => {
  const start = new Date(startDate);
  start.setUTCHours(3, 30, 0, 0);
  return [
    { type: startType,       date: new Date(start) },
    { type: '1_day_before',  date: new Date(start.getTime() - 86400000) },
    { type: '3_days_before', date: new Date(start.getTime() - 3 * 86400000) },
    { type: '1_week_before', date: new Date(start.getTime() - 7 * 86400000) },
  ].filter((r) => r.date > new Date()).map((r) => [r.type, r.date.toISOString()]);
};

// ── A tiny in-memory stand-in for the tables these flows touch ───────────────
const USER_ID = 'user-1';
const GOA = { name: 'Goa', lat: 15.2993, lng: 74.124 };
const MUMBAI = { name: 'Mumbai', lat: 19.076, lng: 72.8777 };
const LONDON = { name: 'London', lat: 51.5074, lng: -0.1278 };
const NEW_YORK = { name: 'New York', lat: 40.7128, lng: -74.006 };
const BANNER = 'https://images.example.com/banner.jpg';

let state;
const resetState = () => {
  state = { trip: null, event: null, userTz: 'Asia/Kolkata', activities: [], calls: [] };
};

const applyUpdate = (row, sql, params) => {
  const next = { ...row };
  for (const [, col, n] of sql.matchAll(/(\w+) = \$(\d+)/g)) {
    if (col !== 'id') next[col] = params[Number(n) - 1];
  }
  return next;
};

const handle = async (sql, params = []) => {
  state.calls.push([sql, params]);
  const one = (row) => ({ rowCount: row ? 1 : 0, rows: row ? [row] : [] });
  if (/^\s*INSERT INTO trips /.test(sql)) {
    state.trip = {
      id: 'trip-1', name: params[0], start_date: params[1], end_date: params[2], location_name: params[3],
      location_lat: params[4], location_lng: params[5], created_by: params[6], banner_image_url: params[7],
    };
    return one(state.trip);
  }
  if (/^\s*INSERT INTO events /.test(sql)) {
    state.event = {
      id: 'event-1', name: params[0], event_date: params[1], location_name: params[4],
      location_lat: params[5], location_lng: params[6], created_by: params[7], banner_image_url: params[8],
    };
    return one(state.event);
  }
  if (/AS unread_members/.test(sql) && /FROM trips t/.test(sql)) {
    return one({ ...state.trip, member_count: 1, total_expense_amount: '0' });
  }
  if (/SELECT timezone FROM users/.test(sql)) return one({ timezone: state.userTz });
  if (/SELECT timezone FROM trips/.test(sql)) return one({ timezone: state.trip?.timezone });
  if (/^\s*UPDATE trips SET/.test(sql)) { state.trip = applyUpdate(state.trip, sql, params); return one(state.trip); }
  if (/^\s*UPDATE events SET/.test(sql)) { state.event = applyUpdate(state.event, sql, params); return one(state.event); }
  if (/^\s*SELECT \* FROM trips WHERE id/.test(sql) || /SELECT start_date, end_date FROM trips/.test(sql)) return one(state.trip);
  if (/^\s*SELECT \* FROM events WHERE id/.test(sql)) return one(state.event);
  if (/FROM trip_activities WHERE trip_id = \$1 AND activity_time IS NOT NULL/.test(sql)) return { rowCount: state.activities.length, rows: state.activities };
  if (/lock_screen_reminders/.test(sql)) return one({ id: USER_ID });
  if (/SELECT COUNT\(\*\) FROM (trip|event)_members/.test(sql)) return one({ count: '1' });
  if (/^\s*UPDATE (trip|event)_reminders/.test(sql)) return { rowCount: 1, rows: [] };
  return { rowCount: 0, rows: [] };
};

const reminderWrites = (table) => state.calls.filter(([sql]) => new RegExp(`(INSERT INTO|UPDATE|DELETE FROM) ${table}`).test(sql));
const dayReminderParams = (table) => reminderWrites(table).map(([, p]) => [p[1], p[2]]);
const timezoneSql = () => state.calls.filter(([sql]) => /timezone/i.test(sql));
const flush = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r)); };
const setFlag = (on) => { config.featureFlags.tripTimezones = on; };

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] });
  jest.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
  resetState();
  db.query.mockReset();
  db.query.mockImplementation(handle);
  db.getClient.mockReset();
  db.getClient.mockImplementation(async () => ({ query: handle, release: jest.fn() }));
});
afterEach(() => { jest.useRealTimers(); setFlag(false); });

const createTrip = (loc, extra = {}) => trips.createTrip(USER_ID, {
  name: 'Trip', startDate: '2026-02-01', endDate: '2026-02-05', reminders: true,
  locations: [loc], bannerImageUrl: BANNER, ...extra,
});
const createEvent = (loc, extra = {}) => events.createEvent(USER_ID, {
  name: 'Event', eventDate: '2026-02-01', reminders: true,
  ...(loc ? { locations: [loc] } : {}), bannerImageUrl: BANNER, ...extra,
});

// ── Trips: create ─────────────────────────────────────────────────────────────

describe('createTrip', () => {
  it('flag off: exactly today — IST reminders, no time zone reads/writes, no timezone field', async () => {
    const trip = await createTrip(LONDON);
    expect(dayReminderParams('trip_reminders')).toEqual(legacyDayReminders('2026-02-01', 'trip_start'));
    expect(timezoneSql()).toHaveLength(0);
    expect(trip).not.toHaveProperty('timezone');
  });

  it('flag on, Goa: Asia/Kolkata and the same reminder times as today (regression lock)', async () => {
    setFlag(true);
    const trip = await createTrip(GOA);
    expect(trip.timezone).toBe('Asia/Kolkata');
    expect(state.trip.timezone).toBe('Asia/Kolkata');
    expect(dayReminderParams('trip_reminders')).toEqual(legacyDayReminders('2026-02-01', 'trip_start'));
  });

  it('flag on, London: Europe/London, day reminders at 09:00 London time', async () => {
    setFlag(true);
    const trip = await createTrip(LONDON);
    expect(trip.timezone).toBe('Europe/London');
    expect(dayReminderParams('trip_reminders')).toEqual([
      ['trip_start', '2026-02-01T09:00:00.000Z'],
      ['1_day_before', '2026-01-31T09:00:00.000Z'],
      ['3_days_before', '2026-01-29T09:00:00.000Z'],
      ['1_week_before', '2026-01-25T09:00:00.000Z'],
    ]);
  });

  it('flag on, New York: America/New_York', async () => {
    setFlag(true);
    expect((await createTrip(NEW_YORK)).timezone).toBe('America/New_York');
    expect(dayReminderParams('trip_reminders')[0]).toEqual(['trip_start', '2026-02-01T14:00:00.000Z']);
  });

  it('flag on, no coordinates: creator\'s users.timezone, else Asia/Kolkata', async () => {
    setFlag(true);
    state.userTz = 'Europe/Berlin';
    expect((await createTrip({ name: 'Somewhere' })).timezone).toBe('Europe/Berlin');
    resetState();
    state.userTz = null;
    expect((await createTrip({ name: 'Somewhere' })).timezone).toBe('Asia/Kolkata');
  });

  it('reminders off → no reminders, either way', async () => {
    setFlag(true);
    await createTrip(LONDON, { reminders: false });
    expect(reminderWrites('trip_reminders')).toHaveLength(0);
  });
});

// ── Trips: update ─────────────────────────────────────────────────────────────

describe('updateTrip', () => {
  const seedTrip = (loc, timezone) => {
    state.trip = {
      id: 'trip-1', name: 'Trip', start_date: '2026-02-01', end_date: '2026-02-05', created_by: USER_ID,
      location_name: loc.name, location_lat: loc.lat, location_lng: loc.lng, timezone,
    };
  };

  it.each([[false], [true]])('IST trip, new start date (flag on=%s) → same reminder times as today', async (flag) => {
    setFlag(flag);
    seedTrip(GOA, 'Asia/Kolkata');
    await trips.updateTrip('trip-1', { startDate: '2026-03-01', endDate: '2026-03-05' });
    expect(dayReminderParams('trip_reminders')).toEqual(legacyDayReminders('2026-03-01', 'trip_start'));
  });

  it('London trip, new start date (flag on) → 09:00 London on the new dates', async () => {
    setFlag(true);
    seedTrip(LONDON, 'Europe/London');
    await trips.updateTrip('trip-1', { startDate: '2026-04-02', endDate: '2026-04-05' });
    expect(dayReminderParams('trip_reminders')).toEqual([
      ['trip_start', '2026-04-02T08:00:00.000Z'],
      ['1_day_before', '2026-04-01T08:00:00.000Z'],
      ['3_days_before', '2026-03-30T08:00:00.000Z'],
      ['1_week_before', '2026-03-26T09:00:00.000Z'],
    ]);
  });

  it('location Goa → London (flag on): new zone stored; unsent trip AND activity reminders moved; sent ones untouched', async () => {
    setFlag(true);
    seedTrip(GOA, 'Asia/Kolkata');
    state.activities = [{ id: 'act-1', activity_date: '2026-02-02', activity_time: '09:00:00' }];

    const trip = await trips.updateTrip('trip-1', { locations: [LONDON] });
    await flush(); // activity rescheduling is fire-and-forget

    expect(trip.timezone).toBe('Europe/London');
    // Trip reminders: only existing, unsent, future rows are moved — never inserted
    const tripWrites = reminderWrites('trip_reminders');
    expect(tripWrites.map(([, p]) => [p[1], p[2]])).toEqual([
      ['trip_start', '2026-02-01T09:00:00.000Z'],
      ['1_day_before', '2026-01-31T09:00:00.000Z'],
      ['3_days_before', '2026-01-29T09:00:00.000Z'],
      ['1_week_before', '2026-01-25T09:00:00.000Z'],
    ]);
    for (const [sql] of tripWrites) expect(sql).toMatch(/^UPDATE trip_reminders[\s\S]*sent_at IS NULL AND scheduled_at > NOW\(\)/);
    // Activity reminders: unsent ones replaced in the new zone; the DELETE only targets unsent rows
    const actWrites = reminderWrites('activity_reminders');
    expect(actWrites[0][0]).toMatch(/DELETE FROM activity_reminders WHERE activity_id = \$1 AND sent_at IS NULL/);
    const insertParams = actWrites[1][1];
    expect([insertParams[3], insertParams[8], insertParams[13]]).toEqual([
      '2026-02-02T08:50:00.000Z', '2026-02-02T08:30:00.000Z', '2026-02-02T08:00:00.000Z',
    ]);
  });

  it('location change inside the same zone (Goa → Mumbai) reschedules nothing', async () => {
    setFlag(true);
    seedTrip(GOA, 'Asia/Kolkata');
    state.activities = [{ id: 'act-1', activity_date: '2026-02-02', activity_time: '09:00:00' }];
    await trips.updateTrip('trip-1', { locations: [MUMBAI] });
    await flush();
    expect(reminderWrites('trip_reminders')).toHaveLength(0);
    expect(reminderWrites('activity_reminders')).toHaveLength(0);
  });

  it('flag off: a location change touches no time zone and no reminders', async () => {
    seedTrip(GOA, null);
    state.activities = [{ id: 'act-1', activity_date: '2026-02-02', activity_time: '09:00:00' }];
    const trip = await trips.updateTrip('trip-1', { locations: [LONDON] });
    await flush();
    expect(timezoneSql()).toHaveLength(0);
    expect(reminderWrites('trip_reminders')).toHaveLength(0);
    expect(reminderWrites('activity_reminders')).toHaveLength(0);
    expect(trip).not.toHaveProperty('timezone');
  });

  it('flag on: a name-only change does not resolve a time zone', async () => {
    setFlag(true);
    seedTrip(LONDON, 'Europe/London');
    await trips.updateTrip('trip-1', { name: 'Renamed' });
    expect(timezoneSql()).toHaveLength(0);
  });
});

// ── Events ────────────────────────────────────────────────────────────────────

describe('events', () => {
  it('createEvent flag off: exactly today', async () => {
    const event = await createEvent(LONDON);
    expect(dayReminderParams('event_reminders')).toEqual(legacyDayReminders('2026-02-01', 'event_start'));
    expect(timezoneSql()).toHaveLength(0);
    expect(event).not.toHaveProperty('timezone');
  });

  it('createEvent flag on, Goa: same as today (regression lock)', async () => {
    setFlag(true);
    const event = await createEvent(GOA);
    expect(event.timezone).toBe('Asia/Kolkata');
    expect(dayReminderParams('event_reminders')).toEqual(legacyDayReminders('2026-02-01', 'event_start'));
  });

  it('createEvent flag on, London → 09:00 London; New York → 09:00 New York', async () => {
    setFlag(true);
    expect((await createEvent(LONDON)).timezone).toBe('Europe/London');
    expect(dayReminderParams('event_reminders')[0]).toEqual(['event_start', '2026-02-01T09:00:00.000Z']);
    resetState();
    expect((await createEvent(NEW_YORK)).timezone).toBe('America/New_York');
    expect(dayReminderParams('event_reminders')[0]).toEqual(['event_start', '2026-02-01T14:00:00.000Z']);
  });

  it('createEvent flag on, no location → creator\'s users.timezone', async () => {
    setFlag(true);
    state.userTz = 'America/New_York';
    expect((await createEvent(null)).timezone).toBe('America/New_York');
  });

  const seedEvent = (loc, timezone) => {
    state.event = {
      id: 'event-1', name: 'Event', event_date: '2026-02-01', created_by: USER_ID,
      location_name: loc.name, location_lat: loc.lat, location_lng: loc.lng, timezone,
    };
  };

  it.each([[false], [true]])('updateEvent IST, new date (flag on=%s) → same as today', async (flag) => {
    setFlag(flag);
    seedEvent(GOA, 'Asia/Kolkata');
    await events.updateEvent('event-1', { eventDate: '2026-03-01' });
    expect(dayReminderParams('event_reminders')).toEqual(legacyDayReminders('2026-03-01', 'event_start'));
  });

  it('updateEvent location Goa → New York (flag on) moves only unsent future reminders', async () => {
    setFlag(true);
    seedEvent(GOA, 'Asia/Kolkata');
    const event = await events.updateEvent('event-1', { locations: [NEW_YORK] });
    expect(event.timezone).toBe('America/New_York');
    const writes = reminderWrites('event_reminders');
    expect(writes.map(([, p]) => p[2])[0]).toBe('2026-02-01T14:00:00.000Z');
    for (const [sql] of writes) expect(sql).toMatch(/^UPDATE event_reminders[\s\S]*sent_at IS NULL AND scheduled_at > NOW\(\)/);
  });
});

// ── Local "today": lists and days to go ──────────────────────────────────────

describe('local "today"', () => {
  const listSql = () => state.calls.find(([sql]) => /LIMIT \$2 OFFSET \$3/.test(sql))[0];

  it.each(['upcoming', 'past', 'ongoing'])('getTrips %s: server date when off, trip-local date when on', async (status) => {
    await trips.getTrips(USER_ID, { status });
    expect(listSql()).toMatch(/CURRENT_DATE/);
    expect(listSql()).not.toMatch(/AT TIME ZONE/);
    resetState();
    setFlag(true);
    await trips.getTrips(USER_ID, { status });
    expect(listSql()).toContain("(NOW() AT TIME ZONE COALESCE(t.timezone, 'Asia/Kolkata'))::date");
    expect(listSql()).not.toMatch(/CURRENT_DATE/);
  });

  it.each(['upcoming', 'past', 'ongoing'])('getEvents %s: server date when off, event-local date when on', async (status) => {
    await events.getEvents(USER_ID, { status });
    expect(listSql()).toMatch(/CURRENT_DATE/);
    resetState();
    setFlag(true);
    await events.getEvents(USER_ID, { status });
    expect(listSql()).toContain("(NOW() AT TIME ZONE COALESCE(e.timezone, 'Asia/Kolkata'))::date");
    expect(listSql()).not.toMatch(/CURRENT_DATE/);
  });

  const daysToGo = async (timezone, startDate = '2026-05-02') => {
    state.trip = { id: 'trip-1', name: 'T', start_date: startDate, end_date: '2026-05-09', created_by: USER_ID, timezone };
    const { trip } = await trips.getTripById('trip-1', USER_ID);
    return trip;
  };

  it('around midnight: days to go uses the trip\'s own date (IST vs London)', async () => {
    setFlag(true);
    // 19:00Z on 1 May = 00:30 on 2 May in India, 20:00 on 1 May in London
    jest.setSystemTime(new Date('2026-05-01T19:00:00.000Z'));
    expect((await daysToGo('Asia/Kolkata')).daysToGo).toBe(0);
    expect((await daysToGo('Europe/London')).daysToGo).toBe(1);
    expect((await daysToGo(null)).daysToGo).toBe(0); // not filled yet → India
    // 18:00Z = 23:30 on 1 May in India → still 1 day to go
    jest.setSystemTime(new Date('2026-05-01T18:00:00.000Z'));
    expect((await daysToGo('Asia/Kolkata')).daysToGo).toBe(1);
    // started trips never go negative
    expect((await daysToGo('Europe/London', '2026-04-20')).daysToGo).toBe(0);
  });

  it('flag off: days to go is today\'s calculation and no timezone field', async () => {
    jest.setSystemTime(new Date('2026-05-01T19:00:00.000Z'));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date('2026-05-02'); start.setHours(0, 0, 0, 0);
    const legacy = Math.max(0, Math.round((start - today) / 86400000));
    const trip = await daysToGo('Europe/London');
    expect(trip.daysToGo).toBe(legacy);
    expect(trip).not.toHaveProperty('timezone');
  });

  it('flag on: timezone is included in the trip API response', async () => {
    setFlag(true);
    expect((await daysToGo('Europe/London')).timezone).toBe('Europe/London');
  });
});
