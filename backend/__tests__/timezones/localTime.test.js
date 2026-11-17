require('../setup');

// resolveTimeZone checks names against pg_timezone_names; never reach a real DB here.
const PG_ZONES = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'Europe/Berlin', 'Europe/Paris', 'Europe/Kiev'];
jest.mock('../../src/config/database', () => ({
  query: jest.fn(async () => ({ rows: PG_ZONES.map((name) => ({ name })) })),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

const { localToUtc, resolveTimeZone, DEFAULT_TIME_ZONE } = require('../../src/utils/localTime');

const iso = (d) => (d ? d.toISOString() : d);

describe('localToUtc', () => {
  it.each([
    // [date, time, zone, expected UTC]
    ['2026-05-03', '09:00', 'Asia/Kolkata', '2026-05-03T03:30:00.000Z'],      // IST, no DST
    ['2026-01-15', '09:00', 'Europe/London', '2026-01-15T09:00:00.000Z'],     // GMT
    ['2026-07-15', '09:00', 'Europe/London', '2026-07-15T08:00:00.000Z'],     // BST
    ['2026-01-15', '09:00', 'America/New_York', '2026-01-15T14:00:00.000Z'],  // EST
    ['2026-07-15', '09:00', 'America/New_York', '2026-07-15T13:00:00.000Z'],  // EDT
    ['2026-05-03', '09:00:00', 'Asia/Kolkata', '2026-05-03T03:30:00.000Z'],   // DB "HH:MM:SS"
  ])('%s %s in %s → %s', (date, time, zone, expected) => {
    expect(iso(localToUtc(date, time, zone))).toBe(expected);
  });

  describe('DST changeover days', () => {
    it.each([
      // London: clocks go forward on the last Sunday of March (29 Mar 2026)
      ['2026-03-28', '09:00', 'Europe/London', '2026-03-28T09:00:00.000Z'],
      ['2026-03-29', '09:00', 'Europe/London', '2026-03-29T08:00:00.000Z'],
      // London: clocks go back on the last Sunday of October (25 Oct 2026)
      ['2026-10-24', '09:00', 'Europe/London', '2026-10-24T08:00:00.000Z'],
      ['2026-10-25', '09:00', 'Europe/London', '2026-10-25T09:00:00.000Z'],
      // US: clocks go forward on the second Sunday of March (8 Mar 2026)
      ['2026-03-07', '09:00', 'America/New_York', '2026-03-07T14:00:00.000Z'],
      ['2026-03-08', '09:00', 'America/New_York', '2026-03-08T13:00:00.000Z'],
    ])('%s %s in %s → %s', (date, time, zone, expected) => {
      expect(iso(localToUtc(date, time, zone))).toBe(expected);
    });

    it('moves a time inside the spring-forward gap forward by the gap', () => {
      // 01:30 does not exist in London on 29 Mar 2026 → 02:30 BST = 01:30Z
      expect(iso(localToUtc('2026-03-29', '01:30', 'Europe/London'))).toBe('2026-03-29T01:30:00.000Z');
      // 02:30 does not exist in New York on 8 Mar 2026 → 03:30 EDT = 07:30Z
      expect(iso(localToUtc('2026-03-08', '02:30', 'America/New_York'))).toBe('2026-03-08T07:30:00.000Z');
    });

    it('resolves an ambiguous fall-back time to its standard-time occurrence', () => {
      expect(iso(localToUtc('2026-10-25', '01:30', 'Europe/London'))).toBe('2026-10-25T01:30:00.000Z');
    });
  });

  describe('midnight edge cases', () => {
    it('local midnight can be the previous UTC day', () => {
      expect(iso(localToUtc('2026-07-01', '00:00', 'Europe/London'))).toBe('2026-06-30T23:00:00.000Z');
      expect(iso(localToUtc('2026-07-01', '00:00', 'Asia/Kolkata'))).toBe('2026-06-30T18:30:00.000Z');
    });
    it('23:59 in New York is the next UTC day', () => {
      expect(iso(localToUtc('2026-07-01', '23:59', 'America/New_York'))).toBe('2026-07-02T03:59:00.000Z');
    });
  });

  it('accepts a pg DATE (JS Date at local midnight) and an ISO datetime string', () => {
    expect(iso(localToUtc(new Date(2026, 4, 3), '09:00', 'Asia/Kolkata'))).toBe('2026-05-03T03:30:00.000Z');
    expect(iso(localToUtc('2026-05-03T00:00:00.000Z', '09:00', 'Asia/Kolkata'))).toBe('2026-05-03T03:30:00.000Z');
  });

  it.each([
    ['bad date', 'not-a-date', '09:00', 'Asia/Kolkata'],
    ['impossible date', '2026-02-30', '09:00', 'Asia/Kolkata'],
    ['hour 25', '2026-05-03', '25:00', 'Asia/Kolkata'],
    ['single-digit hour', '2026-05-03', '9:00', 'Asia/Kolkata'],
    ['null time', '2026-05-03', null, 'Asia/Kolkata'],
    ['null date', null, '09:00', 'Asia/Kolkata'],
    ['invalid Date', new Date('x'), '09:00', 'Asia/Kolkata'],
    ['unknown zone', '2026-05-03', '09:00', 'Mars/Olympus'],
    ['missing zone', '2026-05-03', '09:00', null],
  ])('returns null for invalid input (%s)', (_label, date, time, zone) => {
    expect(localToUtc(date, time, zone)).toBeNull();
  });
});

describe('resolveTimeZone', () => {
  it.each([
    ['Goa', 15.2993, 74.124, 'Asia/Kolkata'],
    ['London', 51.5074, -0.1278, 'Europe/London'],
    ['New York', 40.7128, -74.006, 'America/New_York'],
    ['London as pg NUMERIC strings', '51.5074', '-0.1278', 'Europe/London'],
  ])('%s → %s', async (_label, lat, lng, expected) => {
    const fallback = jest.fn();
    await expect(resolveTimeZone(lat, lng, fallback)).resolves.toBe(expected);
    expect(fallback).not.toHaveBeenCalled(); // user lookup only when there are no coordinates
  });

  it('no coordinates → the user time zone', async () => {
    await expect(resolveTimeZone(null, null, async () => 'Europe/Berlin')).resolves.toBe('Europe/Berlin');
    await expect(resolveTimeZone('', '', async () => 'Europe/Berlin')).resolves.toBe('Europe/Berlin');
  });

  it('no coordinates and no/invalid user time zone → Asia/Kolkata', async () => {
    await expect(resolveTimeZone(null, null, async () => null)).resolves.toBe(DEFAULT_TIME_ZONE);
    await expect(resolveTimeZone(null, null, async () => 'Not/AZone')).resolves.toBe(DEFAULT_TIME_ZONE);
    await expect(resolveTimeZone(undefined, undefined)).resolves.toBe(DEFAULT_TIME_ZONE);
    expect(DEFAULT_TIME_ZONE).toBe('Asia/Kolkata');
  });

  it('out-of-range or half-missing coordinates fall back', async () => {
    await expect(resolveTimeZone(100, 10, async () => 'Europe/Paris')).resolves.toBe('Europe/Paris');
    await expect(resolveTimeZone(51.5, null, async () => 'Europe/Paris')).resolves.toBe('Europe/Paris');
  });
});

describe('resolveTimeZone — only zones Postgres recognises are returned', () => {
  // Fresh module per test so the once-per-process zone cache starts empty.
  const load = (impl) => {
    let mod; let db;
    jest.isolateModules(() => {
      db = require('../../src/config/database');
      db.query.mockReset();
      db.query.mockImplementation(impl);
      mod = require('../../src/utils/localTime');
    });
    return { ...mod, db };
  };
  const pgKnows = (names) => async () => ({ rows: names.map((name) => ({ name })) });

  it('a user zone Postgres does not know (newer ICU name) falls back to Asia/Kolkata', async () => {
    const { resolveTimeZone: resolve } = load(pgKnows(PG_ZONES)); // has Europe/Kiev, not Europe/Kyiv
    await expect(resolve(null, null, async () => 'Europe/Kyiv')).resolves.toBe('Asia/Kolkata');
    await expect(resolve(null, null, async () => 'Europe/Kiev')).resolves.toBe('Europe/Kiev');
  });

  it('a coordinate zone Postgres does not know falls back to the user zone, then Asia/Kolkata', async () => {
    const { resolveTimeZone: resolve } = load(pgKnows(['Asia/Kolkata', 'Europe/Berlin']));
    await expect(resolve(51.5074, -0.1278, async () => 'Europe/Berlin')).resolves.toBe('Europe/Berlin');
    await expect(resolve(51.5074, -0.1278, async () => 'Europe/Paris')).resolves.toBe('Asia/Kolkata');
  });

  it('loads pg_timezone_names once and reuses it (also for concurrent calls)', async () => {
    const { resolveTimeZone: resolve, db } = load(pgKnows(PG_ZONES));
    await Promise.all([resolve(51.5074, -0.1278), resolve(40.7128, -74.006)]);
    await resolve(null, null, async () => 'Europe/Berlin');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toBe('SELECT name FROM pg_timezone_names');
  });

  it('if the list cannot be loaded, falls back to the IANA check and retries next time', async () => {
    const { resolveTimeZone: resolve, db } = load(async () => { throw new Error('db down'); });
    await expect(resolve(null, null, async () => 'Europe/Kyiv')).resolves.toBe('Europe/Kyiv');
    await expect(resolve(null, null, async () => 'Not/AZone')).resolves.toBe('Asia/Kolkata'); // no lookup needed
    await expect(resolve(51.5074, -0.1278)).resolves.toBe('Europe/London');
    expect(db.query).toHaveBeenCalledTimes(2); // not cached on failure
    db.query.mockImplementation(pgKnows(PG_ZONES));
    await expect(resolve(null, null, async () => 'Europe/Kyiv')).resolves.toBe('Asia/Kolkata');
  });

  it('a synchronous throw from query is also retried next time', async () => {
    const { resolveTimeZone: resolve, db } = load(() => { throw new Error('sync'); });
    await expect(resolve(51.5074, -0.1278)).resolves.toBe('Europe/London');
    db.query.mockImplementation(pgKnows(['Asia/Kolkata']));
    await expect(resolve(51.5074, -0.1278)).resolves.toBe('Asia/Kolkata');
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('an empty list is treated as a failed load, not "no zone is valid"', async () => {
    const { resolveTimeZone: resolve } = load(pgKnows([]));
    await expect(resolve(51.5074, -0.1278)).resolves.toBe('Europe/London');
  });
});
