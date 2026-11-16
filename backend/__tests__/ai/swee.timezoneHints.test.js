/**
 * TRIP_TIMEZONES — Swee events and Swee destination renames carry the place's IANA zone
 * (runbook §3.1 / §3.2; same approach as create_trip in 2cbb84f):
 *  - create_event → eventsService.createEvent(userId, body, { timeZoneHint })
 *  - update_trip with a new destination → tripsService.updateTrip(id, updates, { timeZoneHint })
 *  - update_event with a new location → eventsService.updateEvent(id, updates, { timeZoneHint })
 *  - the prompt asks for the zone only with TRIP_TIMEZONES; flag off = calls and prompt unchanged
 */
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

jest.mock('../../src/config/aws', () => ({
  s3Client: {},
  sesClient: { send: jest.fn() },
  snsClient: { send: jest.fn() },
}));

jest.mock('../../src/modules/shared/notes/notes.service', () => ({
  createNote: jest.fn().mockResolvedValue({ id: 'note-id' }),
}));

jest.mock('../../src/modules/trips/trips.service', () => ({
  updateTrip: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/modules/events/events.service', () => ({
  createEvent: jest.fn(),
  updateEvent: jest.fn().mockResolvedValue({}),
}));

const config = require('../../src/config');
const db = require('../../src/config/database');
const tripsService = require('../../src/modules/trips/trips.service');
const eventsService = require('../../src/modules/events/events.service');
const { executeAction } = require('../../src/modules/ai/ai.service');
const { buildSweetSystemPrompt } = require('../../src/modules/ai/swee.config');

const USER = '123e4567-e89b-12d3-a456-426614174000';
const TRIP = 'aaaa0001-0000-4000-8000-000000000001';
const EVENT = 'eeee0001-0000-4000-8000-000000000001';

const tripRow = { id: TRIP, name: 'Goa', start_date: '2026-11-01', end_date: '2026-11-05', location_name: 'Goa', role: 'admin' };
const eventRow = { id: EVENT, name: 'Dinner', event_date: '2026-11-01', event_type: 'Party', location_name: 'Mumbai' };

const createEventAction = (extra = {}) => ({
  intent: 'create_event',
  readyToCreate: true,
  draft: { name: 'Team dinner', eventDate: '2026-12-10', eventTime: '19:30', location: 'Soho, London', ...extra },
});
const updateTripAction = (draft) => ({ intent: 'update_trip', readyToCreate: true, tripId: TRIP, draft });
const updateEventAction = (draft) => ({ intent: 'update_event', readyToCreate: true, eventId: EVENT, draft });

describe('Swee time zone hints for events and renamed destinations (TRIP_TIMEZONES)', () => {
  const original = { ...config.featureFlags };

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    eventsService.createEvent.mockResolvedValue({ id: EVENT, name: 'Team dinner' });
  });
  afterEach(() => { Object.assign(config.featureFlags, original); });

  describe('create_event', () => {
    it.each([
      ['Europe/London'], ['Asia/Dubai'], ['Asia/Kolkata'],
    ])('flag on: draft zone %s → createEvent gets the hint', async (zone) => {
      config.featureFlags.tripTimezones = true;
      await executeAction(USER, createEventAction({ timeZone: zone }));
      expect(eventsService.createEvent.mock.calls[0]).toEqual([
        USER, expect.objectContaining({ name: 'Team dinner', location: { name: 'Soho, London' } }), { timeZoneHint: zone },
      ]);
    });

    it('flag on: no zone, or a non-string zone → called exactly as before', async () => {
      config.featureFlags.tripTimezones = true;
      await executeAction(USER, createEventAction());
      await executeAction(USER, createEventAction({ timeZone: { evil: true } }));
      await executeAction(USER, createEventAction({ timeZone: '' }));
      for (const call of eventsService.createEvent.mock.calls) expect(call).toHaveLength(2);
    });

    it('flag off: a draft zone is not passed on (call byte-identical)', async () => {
      config.featureFlags.tripTimezones = false;
      await executeAction(USER, createEventAction({ timeZone: 'Europe/London' }));
      expect(eventsService.createEvent.mock.calls[0]).toEqual([USER, {
        name: 'Team dinner',
        eventDate: '2026-12-10',
        eventTime: '19:30',
        eventType: expect.any(String),
        description: undefined,
        location: { name: 'Soho, London' },
        reminders: true,
      }]);
    });
  });

  describe('update_trip', () => {
    beforeEach(() => { db.query.mockResolvedValueOnce({ rows: [tripRow] }); });

    it('flag on, new destination + zone → updateTrip gets the hint', async () => {
      config.featureFlags.tripTimezones = true;
      await executeAction(USER, updateTripAction({ destination: 'London', timeZone: 'Europe/London' }));
      expect(tripsService.updateTrip.mock.calls[0]).toEqual([TRIP, { location: { name: 'London' } }, { timeZoneHint: 'Europe/London' }]);
    });

    it('flag on, dates only (a stray zone is ignored) → called exactly as before', async () => {
      config.featureFlags.tripTimezones = true;
      await executeAction(USER, updateTripAction({ startDate: '2026-11-02', endDate: '2026-11-06', timeZone: 'Europe/London' }));
      expect(tripsService.updateTrip.mock.calls[0]).toEqual([TRIP, { startDate: '2026-11-02', endDate: '2026-11-06' }]);
    });

    it('flag on, new destination without a zone → called exactly as before', async () => {
      config.featureFlags.tripTimezones = true;
      await executeAction(USER, updateTripAction({ destination: 'London' }));
      expect(tripsService.updateTrip.mock.calls[0]).toEqual([TRIP, { location: { name: 'London' } }]);
    });

    it('flag off: zone not passed on', async () => {
      config.featureFlags.tripTimezones = false;
      await executeAction(USER, updateTripAction({ destination: 'London', timeZone: 'Europe/London' }));
      expect(tripsService.updateTrip.mock.calls[0]).toEqual([TRIP, { location: { name: 'London' } }]);
    });
  });

  describe('update_event', () => {
    beforeEach(() => { db.query.mockResolvedValueOnce({ rows: [eventRow] }); });

    it('flag on, new location + zone → updateEvent gets the hint', async () => {
      config.featureFlags.tripTimezones = true;
      await executeAction(USER, updateEventAction({ location: 'Dubai Marina', timeZone: 'Asia/Dubai' }));
      expect(eventsService.updateEvent.mock.calls[0]).toEqual([EVENT, { location: { name: 'Dubai Marina' } }, { timeZoneHint: 'Asia/Dubai' }]);
    });

    it('flag on, time only (a stray zone is ignored) → called exactly as before', async () => {
      config.featureFlags.tripTimezones = true;
      await executeAction(USER, updateEventAction({ eventTime: '20:00', timeZone: 'Asia/Dubai' }));
      expect(eventsService.updateEvent.mock.calls[0]).toEqual([EVENT, { eventTime: '20:00' }]);
    });

    it('flag off: zone not passed on', async () => {
      config.featureFlags.tripTimezones = false;
      await executeAction(USER, updateEventAction({ location: 'Dubai Marina', timeZone: 'Asia/Dubai' }));
      expect(eventsService.updateEvent.mock.calls[0]).toEqual([EVENT, { location: { name: 'Dubai Marina' } }]);
    });
  });

  describe('prompt asks for the zone only with TRIP_TIMEZONES', () => {
    const ctx = { profile: { full_name: 'Priya', timezone: 'Asia/Kolkata' }, trips: [], events: [] };
    const EVENT_RULE = '→ If you know where the event happens, also put "timeZone" in the draft: that place\'s IANA zone (e.g. "Europe/London", "Asia/Dubai", "Asia/Kolkata").\n';
    const TRIP_RENAME_RULE = '→ If the destination changes, also put "timeZone" in the draft: the new destination\'s IANA zone (e.g. "Europe/London", "Asia/Kolkata").\n';
    const EVENT_RENAME_RULE = '→ If the location changes, also put "timeZone" in the draft: the new location\'s IANA zone (e.g. "Europe/London", "Asia/Kolkata").\n';
    const LEGACY_TRIP_RULE = '→ Also put "timeZone" in the draft: the destination\'s IANA zone (e.g. "Europe/London", "America/New_York", "Asia/Kolkata").\n';
    const strip = (p, rules) => rules.reduce((s, r) => s.replace(r, ''), p);

    it.each([[false], [true]])('Planner v2 = %p: flag off has no rules; flag on = same prompt plus the rules', (v2) => {
      config.featureFlags.sweePlannerV2 = v2;
      config.featureFlags.tripTimezones = false;
      const off = buildSweetSystemPrompt(ctx, null, 1);
      config.featureFlags.tripTimezones = true;
      const on = buildSweetSystemPrompt(ctx, null, 1);
      expect(off).not.toContain('"timeZone" in the draft');
      for (const rule of [EVENT_RULE, TRIP_RENAME_RULE, EVENT_RENAME_RULE]) expect(on).toContain(rule);
      const rules = [EVENT_RULE, TRIP_RENAME_RULE, EVENT_RENAME_RULE, ...(v2 ? [] : [LEGACY_TRIP_RULE])];
      expect(strip(on, rules)).toBe(off);
    });
  });
});
