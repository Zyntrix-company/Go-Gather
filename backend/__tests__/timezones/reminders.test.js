require('../setup');

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

jest.mock('../../src/utils/fcm.util', () => ({
  createAndSendNotifications: jest.fn().mockResolvedValue(undefined),
  sendFCMNotification: jest.fn().mockResolvedValue(true),
  isInQuietHours: jest.fn(),
}));

const db = require('../../src/config/database');
const fcm = require('../../src/utils/fcm.util');
const config = require('../../src/config');
const {
  scheduleTripReminders,
  scheduleEventReminders,
  scheduleActivityReminders,
  processReminders,
} = require('../../src/utils/reminders.cron');

// ── Oracles: today's code, copied verbatim (the regression lock) ──────────────

const legacyDayReminders = (startDate, startType) => {
  const HOUR = parseInt(process.env.REMINDER_HOUR_UTC ?? '3');
  const MIN  = parseInt(process.env.REMINDER_MIN_UTC  ?? '30');
  const start = new Date(startDate);
  start.setUTCHours(HOUR, MIN, 0, 0);
  return [
    { type: startType,       date: new Date(start) },
    { type: '1_day_before',  date: new Date(start.getTime() - 86400000) },
    { type: '3_days_before', date: new Date(start.getTime() - 3 * 86400000) },
    { type: '1_week_before', date: new Date(start.getTime() - 7 * 86400000) },
  ].filter((r) => r.date > new Date()).map((r) => [r.type, r.date.toISOString()]);
};

const legacyActivityReminders = (activityDate, activityTime) => {
  const startMs = new Date(`${activityDate}T${activityTime}+05:30`).getTime();
  return [10, 30, 60]
    .map((m) => ({ m, at: startMs - m * 60000 }))
    .filter((r) => r.at > Date.now())
    .map((r) => [new Date(r.at).toISOString(), r.m]);
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-10T00:00:00.000Z');

const executor = () => ({ query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }) });
// [type, iso] for each INSERT the executor received
const inserted = (ex) => ex.query.mock.calls
  .filter(([sql]) => /^\s*INSERT INTO/.test(sql))
  .map(([, params]) => [params[1], params[2]]);

// Route db.query for scheduleActivityReminders; returns the INSERTed [remindAt, minutes] pairs.
const runActivity = async (date, time, tripTimeZone) => {
  db.query.mockImplementation(async (sql) => {
    if (/SELECT timezone FROM trips/.test(sql)) return { rows: [{ timezone: tripTimeZone }] };
    if (/FROM trip_members/.test(sql)) return { rows: [{ id: 'user-1' }] };
    return { rowCount: 0, rows: [] };
  });
  await scheduleActivityReminders('act-1', 'trip-1', date, time);
  const insert = db.query.mock.calls.find(([sql]) => /INSERT INTO activity_reminders/.test(sql));
  if (!insert) return [];
  const params = insert[1];
  const out = [];
  for (let i = 0; i < params.length; i += 5) out.push([params[i + 3], params[i + 4]]);
  return out;
};

const setFlag = (on) => { config.featureFlags.tripTimezones = on; };

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] });
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
  db.query.mockReset();
  config.reminderLocalTime = '09:00';
});
afterEach(() => {
  jest.useRealTimers();
  setFlag(false);
});

const IST_DATES = ['2026-01-11', '2026-01-14', '2026-01-17', '2026-03-29', '2026-07-15', '2026-10-25', '2026-12-31'];

// ── Regression locks: IST output identical to today, flag off AND on ─────────

describe('regression lock — IST trips/events/activities match today exactly', () => {
  describe.each([
    ['flag off', false, 'Europe/London'], // flag off ignores the stored zone entirely
    ['flag on, zone Asia/Kolkata', true, 'Asia/Kolkata'],
    ['flag on, zone not filled yet (null)', true, null],
  ])('%s', (_label, flag, zone) => {
    beforeEach(() => setFlag(flag));

    it.each(IST_DATES)('trip start/1d/3d/1w for a trip starting %s', async (startDate) => {
      const ex = executor();
      await scheduleTripReminders(ex, 'trip-1', startDate, zone);
      expect(inserted(ex)).toEqual(legacyDayReminders(startDate, 'trip_start'));
    });

    it.each(IST_DATES)('event reminders for an event on %s', async (eventDate) => {
      const ex = executor();
      await scheduleEventReminders(ex, 'event-1', eventDate, zone);
      expect(inserted(ex)).toEqual(legacyDayReminders(eventDate, 'event_start'));
    });

    it.each([
      ['2026-01-10', '06:00:00'], // partly in the past (now = 05:30 IST)
      ['2026-01-10', '23:59:00'],
      ['2026-01-11', '00:00:00'], // midnight
      ['2026-01-11', '09:00:00'],
      ['2026-03-29', '01:30:00'],
    ])('activity reminders for %s %s', async (date, time) => {
      const tz = zone === 'Europe/London' ? 'Europe/London' : (zone || null);
      expect(await runActivity(date, time, tz)).toEqual(legacyActivityReminders(date, time));
    });

    it('the SQL is unchanged (same INSERT … ON CONFLICT … WHERE sent_at IS NULL upsert)', async () => {
      const ex = executor();
      await scheduleTripReminders(ex, 'trip-1', '2026-02-01', zone);
      for (const [sql] of ex.query.mock.calls) {
        expect(sql.replace(/\s+/g, ' ').trim()).toBe(
          'INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at) VALUES ($1, $2, $3) '
          + 'ON CONFLICT (trip_id, reminder_type) WHERE sent_at IS NULL DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at',
        );
      }
    });
  });

  it('flag off never reads the trip time zone for activity reminders', async () => {
    setFlag(false);
    await runActivity('2026-01-11', '09:00:00', 'Europe/London');
    expect(db.query.mock.calls.some(([sql]) => /SELECT timezone FROM trips/.test(sql))).toBe(false);
  });
});

// ── Local time abroad (flag on) ──────────────────────────────────────────────

describe('trip-local reminder times (TRIP_TIMEZONES on)', () => {
  beforeEach(() => setFlag(true));

  it('London trip: day reminders at 09:00 London time, across the March DST change', async () => {
    const ex = executor();
    await scheduleTripReminders(ex, 'trip-1', '2026-04-02', 'Europe/London');
    expect(inserted(ex)).toEqual([
      ['trip_start', '2026-04-02T08:00:00.000Z'],    // BST
      ['1_day_before', '2026-04-01T08:00:00.000Z'],  // BST
      ['3_days_before', '2026-03-30T08:00:00.000Z'], // BST (day after the change)
      ['1_week_before', '2026-03-26T09:00:00.000Z'], // GMT
    ]);
  });

  it('New York event: reminders at 09:00 New York time, across the US March DST change', async () => {
    const ex = executor();
    await scheduleEventReminders(ex, 'event-1', '2026-03-10', 'America/New_York');
    expect(inserted(ex)).toEqual([
      ['event_start', '2026-03-10T13:00:00.000Z'],   // EDT
      ['1_day_before', '2026-03-09T13:00:00.000Z'],  // EDT
      ['3_days_before', '2026-03-07T14:00:00.000Z'], // EST
      ['1_week_before', '2026-03-03T14:00:00.000Z'], // EST
    ]);
  });

  it('London event on the October fall-back day stays at 09:00 local', async () => {
    const ex = executor();
    await scheduleEventReminders(ex, 'event-1', '2026-10-25', 'Europe/London');
    expect(inserted(ex)[0]).toEqual(['event_start', '2026-10-25T09:00:00.000Z']);
    expect(inserted(ex)[1]).toEqual(['1_day_before', '2026-10-24T08:00:00.000Z']);
  });

  it('London activity at 09:00 → reminders 60/30/10 min before 09:00 London time', async () => {
    expect(await runActivity('2026-07-15', '09:00:00', 'Europe/London')).toEqual([
      ['2026-07-15T07:50:00.000Z', 10],
      ['2026-07-15T07:30:00.000Z', 30],
      ['2026-07-15T07:00:00.000Z', 60],
    ]);
  });

  it('New York activity at 09:00 (winter) → relative to 09:00 New York time', async () => {
    expect(await runActivity('2026-01-20', '09:00', 'America/New_York')).toEqual([
      ['2026-01-20T13:50:00.000Z', 10],
      ['2026-01-20T13:30:00.000Z', 30],
      ['2026-01-20T13:00:00.000Z', 60],
    ]);
  });

  it('activity at local midnight in London → reminders on the previous evening', async () => {
    expect(await runActivity('2026-07-15', '00:00:00', 'Europe/London')).toEqual([
      ['2026-07-14T22:50:00.000Z', 10],
      ['2026-07-14T22:30:00.000Z', 30],
      ['2026-07-14T22:00:00.000Z', 60],
    ]);
  });

  it('accepts a pg DATE object (previously skipped silently by the +05:30 string concat)', async () => {
    expect(await runActivity(new Date(2026, 6, 15), '09:00:00', 'Europe/London')).toHaveLength(3);
  });

  it('REMINDER_LOCAL_TIME moves the day reminders', async () => {
    config.reminderLocalTime = '08:30';
    const ex = executor();
    await scheduleTripReminders(ex, 'trip-1', '2026-01-20', 'Europe/London');
    expect(inserted(ex)[0]).toEqual(['trip_start', '2026-01-20T08:30:00.000Z']);
  });

  it('skips reminders whose time has passed and invalid dates', async () => {
    const ex = executor();
    await scheduleTripReminders(ex, 'trip-1', '2026-01-12', 'Europe/London'); // 1w and 3d before are past
    const inserts = ex.query.mock.calls.filter(([sql]) => /INSERT/.test(sql));
    expect(inserts.map(([, p]) => p[1])).toEqual(['trip_start', '1_day_before']);
    // stale unsent rows for the passed days are dropped (a trip moved earlier can't send "1 week to go" late)
    const deletes = ex.query.mock.calls.filter(([sql]) => /^DELETE FROM trip_reminders/.test(sql));
    expect(deletes.map(([, p]) => p[1])).toEqual(['3_days_before', '1_week_before']);
    for (const [sql] of deletes) expect(sql).toMatch(/sent_at IS NULL$/);
    const ex2 = executor();
    await scheduleTripReminders(ex2, 'trip-1', 'nonsense', 'Europe/London');
    expect(ex2.query).not.toHaveBeenCalled();
  });

  it('onlyExisting moves only unsent future rows and never inserts', async () => {
    const ex = executor();
    const changed = await scheduleTripReminders(ex, 'trip-1', '2026-04-02', 'Europe/London', { onlyExisting: true });
    expect(changed).toBe(4);
    for (const [sql] of ex.query.mock.calls) {
      expect(sql).toMatch(/^UPDATE trip_reminders SET scheduled_at = \$3/);
      expect(sql).toMatch(/sent_at IS NULL AND scheduled_at > NOW\(\)/);
      expect(sql).not.toMatch(/INSERT/);
    }
  });
});

// ── Quiet hours: unchanged ────────────────────────────────────────────────────

describe('quiet hours (unchanged)', () => {
  const dueRow = {
    id: 'ar-1', user_id: 'user-1', trip_id: 'trip-1', activity_id: 'act-1', reminder_minutes: 10,
    activity_name: 'Museum', trip_name: 'London', fcm_token: 'tok',
    notification_settings: { quiet_hours_enabled: true }, timezone: 'Europe/London',
  };
  const route = () => db.query.mockImplementation(async (sql) => (
    /UPDATE activity_reminders/.test(sql) ? { rowCount: 1, rows: [dueRow] } : { rowCount: 0, rows: [] }
  ));

  it.each([[false], [true]])('a due reminder is still held during the recipient\'s quiet hours (flag on=%s)', async (flag) => {
    setFlag(flag);
    route();
    fcm.isInQuietHours.mockReturnValue(true);
    await processReminders();
    // checked against the RECIPIENT's own users.timezone, not the trip's
    expect(fcm.isInQuietHours).toHaveBeenCalledWith(dueRow.notification_settings, 'Europe/London');
    expect(fcm.sendFCMNotification).not.toHaveBeenCalled();
  });

  it.each([[false], [true]])('outside quiet hours it is sent (flag on=%s)', async (flag) => {
    setFlag(flag);
    route();
    fcm.isInQuietHours.mockReturnValue(false);
    await processReminders();
    expect(fcm.sendFCMNotification).toHaveBeenCalledTimes(1);
  });
});
