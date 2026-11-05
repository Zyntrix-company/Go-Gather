/**
 * SEC-06 — Swee executeAction must not act on trips/events the caller can't.
 * add_note: membership required (the id comes from the client).
 * update_trip: admin required (same rule as PUT /trips/:id).
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

jest.mock('../../src/modules/trips/submodules/activities/activities.service', () => ({
  createActivity: jest.fn().mockResolvedValue({ id: 'act-id' }),
  notifyItineraryUpdated: jest.fn(),
}));

const db = require('../../src/config/database');
const notesService = require('../../src/modules/shared/notes/notes.service');
const tripsService = require('../../src/modules/trips/trips.service');
const activitiesService = require('../../src/modules/trips/submodules/activities/activities.service');
const { executeAction } = require('../../src/modules/ai/ai.service');

const USER = '123e4567-e89b-12d3-a456-426614174000';
const TRIP = 'aaaa0001-0000-4000-8000-000000000001';
const EVENT = 'eeee0001-0000-4000-8000-000000000001';

const tripRow = (role) => ({
  id: TRIP, name: 'Goa', start_date: '2026-11-01', end_date: '2026-11-05', location_name: 'Goa', role,
});

describe('Swee executeAction authorization (SEC-06)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('add_note', () => {
    it('rejects a trip the caller is not a member of, and writes nothing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // membership-joined lookup finds nothing

      await expect(executeAction(USER, {
        intent: 'add_note', readyToCreate: true, tripId: TRIP, noteContent: 'spam',
      })).rejects.toMatchObject({ statusCode: 404 });

      expect(notesService.createNote).not.toHaveBeenCalled();
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/JOIN trip_members tm ON tm\.trip_id = t\.id AND tm\.user_id = \$1/);
      expect(params).toEqual([USER, TRIP]);
    });

    it('rejects an event the caller is not a member of', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(executeAction(USER, {
        intent: 'add_note', readyToCreate: true, eventId: EVENT, noteContent: 'spam',
      })).rejects.toMatchObject({ statusCode: 404 });

      expect(notesService.createNote).not.toHaveBeenCalled();
      expect(db.query.mock.calls[0][0]).toMatch(/JOIN event_members em/);
    });

    it('writes the note for a member (any role)', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('member')] });

      const result = await executeAction(USER, {
        intent: 'add_note', readyToCreate: true, tripId: TRIP, noteContent: 'Pack sunscreen',
      });

      expect(result.reply).toMatch(/Note saved/);
      expect(notesService.createNote).toHaveBeenCalledWith(
        { parentType: 'trip', parentId: TRIP },
        USER,
        expect.objectContaining({ content: 'Pack sunscreen' }),
      );
    });

    it('still requires an id', async () => {
      await expect(executeAction(USER, {
        intent: 'add_note', readyToCreate: true, noteContent: 'x',
      })).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('update_trip', () => {
    const action = { intent: 'update_trip', readyToCreate: true, tripId: TRIP, draft: { destination: 'Bali' } };

    it('plain member → 403 and the trip is not updated', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('member')] });
      await expect(executeAction(USER, action)).rejects.toMatchObject({ statusCode: 403 });
      expect(tripsService.updateTrip).not.toHaveBeenCalled();
    });

    it('admin → trip updated', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('admin')] });
      const result = await executeAction(USER, action);
      expect(tripsService.updateTrip).toHaveBeenCalledWith(TRIP, expect.objectContaining({
        location: { name: 'Bali' },
      }));
      expect(result.created).toMatchObject({ id: TRIP, type: 'trip' });
    });

    it('non-member → 404 (lookup is membership-joined)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(executeAction(USER, action)).rejects.toMatchObject({ statusCode: 404 });
      expect(tripsService.updateTrip).not.toHaveBeenCalled();
    });
  });

  describe('add_activities', () => {
    const acts = (...items) => items;
    const action = (activities, extra = {}) => ({
      intent: 'add_activities', readyToCreate: true, tripId: TRIP, draft: { activities }, ...extra,
    });

    it('non-member → 404 and nothing is written (lookup is membership-joined)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(executeAction(USER, action(acts({ title: 'Beach', date: '2026-11-02', time: '09:00' }))))
        .rejects.toMatchObject({ statusCode: 404 });

      expect(activitiesService.createActivity).not.toHaveBeenCalled();
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/JOIN trip_members tm ON tm\.trip_id = t\.id AND tm\.user_id = \$1/);
      expect(params).toEqual([USER, TRIP]);
    });

    it('a plain member may add activities (same rule as POST /trips/:id/activities)', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('member')] });

      const result = await executeAction(USER, action(acts(
        { title: 'Beach morning', date: '2026-11-02', time: '09:00' },
        { title: 'Sunset dinner', date: '2026-11-02', time: '18:30' },
      )));

      expect(activitiesService.createActivity).toHaveBeenCalledTimes(2);
      expect(activitiesService.createActivity).toHaveBeenCalledWith(TRIP, USER, expect.objectContaining({
        title: 'Beach morning', date: '2026-11-02', time: { hour: 9, minute: 0 },
      }), { notify: false });
      expect(result.reply).toBe('Added 2 activities to Goa.');
      expect(result.created).toMatchObject({ id: TRIP, type: 'trip', name: 'Goa', action: 'updated' });
      // One summary notification for the batch, not one per activity.
      expect(activitiesService.notifyItineraryUpdated).toHaveBeenCalledTimes(1);
      expect(activitiesService.notifyItineraryUpdated).toHaveBeenCalledWith(TRIP, USER, 'act-id', 2);
    });

    it('reads Date-typed trip dates as local calendar days (pg returns DATE as Date)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...tripRow('member'), start_date: new Date(2026, 10, 1), end_date: new Date(2026, 10, 5) }],
      });

      const result = await executeAction(USER, action(acts(
        { title: 'First day', date: '2026-11-01', time: '09:00' },
        { title: 'Last day', date: '2026-11-05', time: '09:00' },
      )));

      expect(result.reply).toBe('Added 2 activities to Goa.');
    });

    it('skips activities outside the trip dates and reports the count', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('member')] });

      const result = await executeAction(USER, action(acts(
        { title: 'Inside', date: '2026-11-03', time: '10:00' },
        { title: 'Too early', date: '2026-10-30', time: '10:00' },
        { title: 'Too late', date: '2026-11-06', time: '10:00' },
        { title: 'Bad date', date: 'tomorrow', time: '10:00' },
      )));

      expect(activitiesService.createActivity).toHaveBeenCalledTimes(1);
      expect(result.reply).toBe('Added 1 activity to Goa. 3 activities left out (date outside the trip or invalid).');
    });

    it('rejects with 400 when every activity is outside the trip dates', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('member')] });

      await expect(executeAction(USER, action(acts({ title: 'Late', date: '2027-01-01' }))))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/outside Goa's dates/) });
      expect(activitiesService.createActivity).not.toHaveBeenCalled();
    });

    it('counts a failing createActivity as skipped, and 400s if nothing was saved', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('member')] });
      activitiesService.createActivity
        .mockResolvedValueOnce({ id: 'ok' })
        .mockRejectedValueOnce(new Error('db down'));

      const partial = await executeAction(USER, action(acts(
        { title: 'One', date: '2026-11-02', time: '09:00' },
        { title: 'Two', date: '2026-11-02', time: '12:00' },
      )));
      // A save failure is reported as such — not blamed on the dates.
      expect(partial.reply).toBe("Added 1 activity to Goa. 1 activity couldn't be saved.");

      db.query.mockResolvedValueOnce({ rows: [tripRow('member')] });
      activitiesService.createActivity.mockRejectedValueOnce(new Error('db down'));
      await expect(executeAction(USER, action(acts({ title: 'One', date: '2026-11-02' }))))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(activitiesService.notifyItineraryUpdated).toHaveBeenCalledTimes(1); // only the partial run
    });

    it('a non-UUID tripId never reaches Postgres: falls back to the trip name, else 400', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('member')] });
      const result = await executeAction(USER, {
        intent: 'add_activities',
        readyToCreate: true,
        tripId: 'Turkey trip',
        targetTripName: 'Goa',
        draft: { activities: [{ title: 'Beach', date: '2026-11-02' }] },
      });
      expect(result.reply).toBe('Added 1 activity to Goa.');
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/LIKE \$2/);
      expect(params).toEqual([USER, '%goa%']);

      db.query.mockClear();
      await expect(executeAction(USER, action(acts({ title: 'Beach', date: '2026-11-02' }), { tripId: 'Turkey trip' })))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Which trip/) });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('caps a single action at 20 activities, before touching the database', async () => {
      const many = Array.from({ length: 21 }, (_, i) => ({ title: `Act ${i}`, date: '2026-11-02', time: '09:00' }));

      await expect(executeAction(USER, action(many))).rejects.toMatchObject({ statusCode: 400 });
      expect(db.query).not.toHaveBeenCalled();
      expect(activitiesService.createActivity).not.toHaveBeenCalled();
    });

    it('requires at least one activity', async () => {
      await expect(executeAction(USER, action([]))).rejects.toMatchObject({ statusCode: 400 });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('409 when a trip name matches several trips', async () => {
      db.query.mockResolvedValueOnce({ rows: [tripRow('member'), { ...tripRow('member'), id: 'other' }] });

      await expect(executeAction(USER, {
        intent: 'add_activities',
        readyToCreate: true,
        targetTripName: 'Goa',
        draft: { activities: [{ title: 'Beach', date: '2026-11-02' }] },
      })).rejects.toMatchObject({ statusCode: 409 });
      expect(activitiesService.createActivity).not.toHaveBeenCalled();
    });
  });
});
