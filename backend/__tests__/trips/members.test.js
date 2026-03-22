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
const USER2_ID = '223e4567-e89b-12d3-a456-426614174001';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const token    = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

const mockTripMemberAdmin = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'admin' }] });
};

const mockTripMember = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'member' }] });
};

describe('Members Routes', () => {
  beforeEach(() => jest.resetAllMocks());

  // ── GET /trips/:id/members ─────────────────────────────────────────────────

  describe('GET /trips/:id/members', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/trips/${TRIP_ID}/members`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with member list for trip members', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: USER_ID,
            full_name: 'Alice Smith',
            avatar_url: 'https://cdn.test.com/alice.jpg',
            role: 'admin',
            joined_at: new Date().toISOString(),
          },
          {
            user_id: USER2_ID,
            full_name: 'Bob Jones',
            avatar_url: null,
            role: 'member',
            joined_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/members`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.members).toHaveLength(2);
      expect(res.body.members[0].role).toBe('admin');
    });
  });

  // ── DELETE /trips/:id/members/:userId ─────────────────────────────────────

  describe('DELETE /trips/:id/members/:userId', () => {
    it('returns 403 when non-admin tries to remove a member', async () => {
      mockTripMember(); // role: member

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/members/${USER2_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('returns 422 when admin tries to remove themselves', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'admin', user_id: USER_ID }] }) // member found
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });                                  // only 1 admin

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/members/${USER_ID}`)  // removing self
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(422);
    });

    it('returns 200 when admin successfully removes a member', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'member', user_id: USER2_ID }] }) // member found
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })                                     // adminCount
        .mockResolvedValueOnce({ rowCount: 1 })                                                // DELETE members
        .mockResolvedValueOnce({ rowCount: 1 });                                               // DELETE invites

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/members/${USER2_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
