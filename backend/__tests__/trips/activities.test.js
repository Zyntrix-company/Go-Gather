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

jest.mock('../../src/utils/s3.util', () => ({
  uploadToS3: jest.fn().mockResolvedValue('trips/uuid/activities/uuid-photo.jpg'),
  deleteFromS3: jest.fn().mockResolvedValue(true),
  sanitiseFilename: jest.fn((n) => n),
}));

const db = require('../../src/config/database');

const USER_ID  = '123e4567-e89b-12d3-a456-426614174000';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const ACT_ID   = 'cccc0001-0000-4000-8000-000000000001';
const PHOTO_ID = 'dddd0001-0000-4000-8000-000000000001';
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

const activityRow = {
  id: ACT_ID,
  trip_id: TRIP_ID,
  created_by: USER_ID,
  title: 'Scuba Diving',
  description: 'At Baga beach',
  activity_date: '2026-05-03',
  time: '09:00:00',
  location: 'Baga Beach',
  cost: '1500.00',
  created_at: new Date().toISOString(),
  photo_count: 0,
};

describe('Activities Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── GET /trips/:id/activities ──────────────────────────────────────────────

  describe('GET /trips/:id/activities', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/trips/${TRIP_ID}/activities`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with activities list', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [activityRow] });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/activities`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.upcoming)).toBe(true);
      expect(res.body.upcoming[0].title).toBe('Scuba Diving');
    });
  });

  // ── POST /trips/:id/activities ─────────────────────────────────────────────

  describe('POST /trips/:id/activities', () => {
    it('returns 400 when time is invalid', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/activities`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test', date: '2026-05-03', time: { hour: 25, minute: 0 } }); // invalid hour

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 201 on successful activity creation', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [activityRow] });

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/activities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Scuba Diving',
          description: 'At Baga beach',
          date: '2026-05-03',
          time: '09:00',
          location: 'Baga Beach',
          cost: 1500,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.activity.title).toBe('Scuba Diving');
    });
  });

  // ── PUT /trips/:id/activities/:actId ──────────────────────────────────────

  describe('PUT /trips/:id/activities/:actId', () => {
    it('returns 403 when non-creator non-admin tries to update', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({
        rows: [{ ...activityRow, created_by: 'other-user-id' }], // someone else's activity
      });

      const res = await request(app)
        .put(`/trips/${TRIP_ID}/activities/${ACT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });

      expect(res.statusCode).toBe(403);
    });

    it('returns 200 when creator updates own activity', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...activityRow, created_by: USER_ID }] }) // find activity
        .mockResolvedValueOnce({ rowCount: 1 })                                                   // UPDATE
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...activityRow, title: 'Updated' }] });   // getActivityById

      const res = await request(app)
        .put(`/trips/${TRIP_ID}/activities/${ACT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });

      expect(res.statusCode).toBe(200);
    });
  });

  // ── DELETE /trips/:id/activities/:actId ───────────────────────────────────

  describe('DELETE /trips/:id/activities/:actId', () => {
    it('returns 200 when admin deletes any activity', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...activityRow, created_by: 'someone-else' }] }) // find
        .mockResolvedValueOnce({ rows: [{ s3_key: 'trips/uuid/photo.jpg' }] })             // get photos for S3 cleanup
        .mockResolvedValueOnce({ rowCount: 1 });                                            // DELETE activity

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/activities/${ACT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── GET /trips/:id/activities/:actId/photos ────────────────────────────────

  describe('GET /trips/:id/activities/:actId/photos', () => {
    it('returns 200 with photo list', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: ACT_ID }] }) // actCheck: activity exists
        .mockResolvedValueOnce({
          rows: [{
            id: PHOTO_ID,
            activity_id: ACT_ID,
            trip_id: TRIP_ID,
            s3_key: 'trips/uuid/activities/uuid-photo.jpg',
            file_url: 'https://cdn.test.com/photo.jpg',
            mime_type: 'image/jpeg',
            uploaded_by: USER_ID,
            created_at: new Date().toISOString(),
          }],
        });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/activities/${ACT_ID}/photos`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.photos)).toBe(true);
    });
  });
});
