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

const db = require('../../src/config/database');
const notesService = require('../../src/modules/shared/notes/notes.service');
const tripsService = require('../../src/modules/trips/trips.service');
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
});
