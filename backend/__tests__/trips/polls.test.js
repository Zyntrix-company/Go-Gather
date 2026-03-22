const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');

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

const db = require('../../src/config/database');

const USER_ID  = '123e4567-e89b-12d3-a456-426614174000';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const POLL_ID  = 'ab010001-0000-4000-8000-000000000001';
const OPT1_ID  = 'ab020001-0000-4000-8000-000000000001';
const OPT2_ID  = 'ab030002-0000-4000-8000-000000000002';
const token    = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

const mockTripMember = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'member' }] });
};

const pollRow = {
  id: POLL_ID,
  parent_type: 'trip',
  parent_id: TRIP_ID,
  question: 'Which hotel?',
  created_by: USER_ID,
  created_at: new Date().toISOString(),
};

describe('Polls Routes', () => {
  beforeEach(() => jest.resetAllMocks());

  // ── GET /trips/:id/polls ───────────────────────────────────────────────────

  describe('GET /trips/:id/polls', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/trips/${TRIP_ID}/polls`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with polls including vote counts', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [pollRow] })  // getPolls: SELECT polls list
        .mockResolvedValueOnce({ rows: [pollRow] })  // getPollById: SELECT poll by id
        .mockResolvedValueOnce({
          rows: [
            { id: OPT1_ID, option_text: 'Taj', display_order: 0, vote_count: 2 },
            { id: OPT2_ID, option_text: 'Leela', display_order: 1, vote_count: 1 },
          ],
        })  // getPollById: SELECT options with vote counts
        .mockResolvedValueOnce({ rows: [{ option_id: OPT1_ID }] });  // getPollById: SELECT my vote

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/polls`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.polls)).toBe(true);
    });
  });

  // ── POST /trips/:id/polls ──────────────────────────────────────────────────

  describe('POST /trips/:id/polls', () => {
    it('returns 400 when options is missing', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/polls`)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'Which hotel?' }); // no options field

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when fewer than 2 options provided', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/polls`)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'Which hotel?', options: ['Only one option'] });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 201 with created poll', async () => {
      mockTripMember();

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)  // BEGIN
          .mockResolvedValueOnce({ rows: [{ ...pollRow, id: POLL_ID }] })  // INSERT poll
          .mockResolvedValueOnce({ rows: [{ id: OPT1_ID, option_text: 'Taj', display_order: 0 }] })  // INSERT opt1
          .mockResolvedValueOnce({ rows: [{ id: OPT2_ID, option_text: 'Leela', display_order: 1 }] })  // INSERT opt2
          .mockResolvedValueOnce(undefined),  // COMMIT
        release: jest.fn(),
      };
      db.getClient.mockResolvedValue(mockClient);

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/polls`)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'Which hotel?', options: ['Taj', 'Leela'] });

      expect(res.statusCode).toBe(201);
      expect(res.body.poll).toHaveProperty('id');
      expect(res.body.poll.question).toBe('Which hotel?');
    });
  });

  // ── POST /trips/:id/polls/:pollId/vote ─────────────────────────────────────

  describe('POST /trips/:id/polls/:pollId/vote', () => {
    it('returns 400 when optionId is missing', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/polls/${POLL_ID}/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when poll does not exist', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // poll not found

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/polls/${POLL_ID}/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ optionId: OPT1_ID });

      expect(res.statusCode).toBe(404);
    });

    it('returns 200 and updated poll after voting', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...pollRow, id: POLL_ID }], rowCount: 1 }) // verify poll
        .mockResolvedValueOnce({ rows: [{ id: OPT1_ID }], rowCount: 1 })             // verify option
        .mockResolvedValueOnce({ rows: [] })                                          // INSERT ON CONFLICT vote
        // getPollById for updated state
        .mockResolvedValueOnce({ rows: [pollRow] })                                   // SELECT poll by id
        .mockResolvedValueOnce({
          rows: [
            { id: OPT1_ID, option_text: 'Taj', display_order: 0, vote_count: 1 },
            { id: OPT2_ID, option_text: 'Leela', display_order: 1, vote_count: 0 },
          ],
        })  // SELECT options with vote counts
        .mockResolvedValueOnce({ rows: [{ option_id: OPT1_ID }] });  // SELECT my vote

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/polls/${POLL_ID}/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ optionId: OPT1_ID });

      expect(res.statusCode).toBe(200);
      expect(res.body.poll).toHaveProperty('id');
    });
  });
});
