const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
  uploadToS3: jest.fn().mockResolvedValue('trips/uuid/cover.jpg'),
  deleteFromS3: jest.fn().mockResolvedValue(true),
  batchDeleteFromS3: jest.fn().mockResolvedValue(true),
  sanitiseFilename: jest.fn((n) => n),
}));

jest.mock('../../src/utils/fcm.util', () => ({
  sendFCMNotification: jest.fn().mockResolvedValue(true),
  notifyUsers: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationOTPEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetOTPEmail: jest.fn().mockResolvedValue(true),
}));

const db = require('../../src/config/database');

// ── Test constants ─────────────────────────────────────────────────────────────

const USER_ID  = '123e4567-e89b-12d3-a456-426614174000';
const USER2_ID = '223e4567-e89b-12d3-a456-426614174001';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const token    = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

// Helpers to mock the tripMember middleware DB calls
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

const tripRow = {
  id: TRIP_ID,
  name: 'Goa 2026',
  start_date: '2026-05-01',
  end_date: '2026-05-07',
  location_name: 'Goa, India',
  location_lat: '15.2993',
  location_lng: '74.1240',
  cover_photo_url: null,
  created_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Trips Routes', () => {
  beforeEach(() => jest.resetAllMocks());

  // ── GET /trips ────────────────────────────────────────────────────────────

  describe('GET /trips', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/trips');
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with paginated trips list', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...tripRow, member_count: 2, total_count: '1' }],
      })
      .mockResolvedValueOnce({ rows: [] }); // trip_locations batch

      const res = await request(app)
        .get('/trips')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.trips)).toBe(true);
    });

    it('accepts status filter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/trips?status=upcoming')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
    });
  });

  // ── POST /trips ───────────────────────────────────────────────────────────

  describe('POST /trips', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trips')
        .send({ name: 'Test', startDate: '2026-05-01', endDate: '2026-05-07' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 when name is missing', async () => {
      const res = await request(app)
        .post('/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({ startDate: '2026-05-01', endDate: '2026-05-07' });
      expect(res.statusCode).toBe(422);
    });

    it('returns 422 when startDate is after endDate', async () => {
      const res = await request(app)
        .post('/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Trip', startDate: '2026-05-07', endDate: '2026-05-01' });
      expect(res.statusCode).toBe(422);
    });

    it('returns 201 on successful trip creation', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)                         // BEGIN
          .mockResolvedValueOnce({ rows: [tripRow] })               // INSERT trip
          .mockResolvedValueOnce({ rows: [] })                      // INSERT trip_locations
          .mockResolvedValueOnce({ rows: [] })                      // INSERT trip_members (creator)
          .mockResolvedValueOnce(undefined),                        // COMMIT
        release: jest.fn(),
      };
      db.getClient.mockResolvedValue(mockClient);
      db.query
        .mockResolvedValueOnce({ rows: [] })                              // resolveBannerUrl categories
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice Smith' }] })  // inviterName
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });               // member count

      const res = await request(app)
        .post('/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Goa 2026',
          startDate: '2026-05-01',
          endDate: '2026-05-07',
          location: { name: 'Goa, India', lat: 15.2993, lng: 74.124 },
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.trip).toHaveProperty('id');
      expect(res.body.trip.name).toBe('Goa 2026');
    });

    it('returns 201 when creating trip with locations array', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: [tripRow] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce(undefined),
        release: jest.fn(),
      };
      db.getClient.mockResolvedValue(mockClient);
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice Smith' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const res = await request(app)
        .post('/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Europe 2026',
          startDate: '2026-05-01',
          endDate: '2026-05-14',
          locations: [
            { name: 'Paris, France', sortOrder: 0 },
            { name: 'Rome, Italy', sortOrder: 1 },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.trip.locations).toHaveLength(2);
      expect(res.body.trip.location.name).toBe('Paris, France');
    });
  });

  // ── GET /trips/:id ────────────────────────────────────────────────────────

  describe('GET /trips/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/trips/${TRIP_ID}`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when user is not a trip member', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('returns 200 with trip detail for a member', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            ...tripRow,
            photo_video_count: 5,
            doc_count: 2,
            total_expense_amount: '6000.00',
            member_count: 3,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // trip_locations
        .mockResolvedValueOnce({ rows: [] }); // members query

      const res = await request(app)
        .get(`/trips/${TRIP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.trip.name).toBe('Goa 2026');
    });
  });

  // ── PUT /trips/:id ────────────────────────────────────────────────────────

  describe('PUT /trips/:id', () => {
    it('returns 403 when user is a member (not admin)', async () => {
      mockTripMember(); // role: member

      const res = await request(app)
        .put(`/trips/${TRIP_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('returns 200 when admin updates trip name', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({
          rows: [{ ...tripRow, name: 'Updated Name' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // trip_locations load

      const res = await request(app)
        .put(`/trips/${TRIP_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });

      expect(res.statusCode).toBe(200);
      expect(res.body.trip.name).toBe('Updated Name');
    });
  });

  // ── DELETE /trips/:id ─────────────────────────────────────────────────────

  describe('DELETE /trips/:id', () => {
    it('returns 403 when non-admin tries to delete', async () => {
      mockTripMember();

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
    });

    it('returns 200 when admin deletes trip', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({ rows: [] })                        // docs S3 keys
        .mockResolvedValueOnce({ rows: [] })                        // photos S3 keys
        .mockResolvedValueOnce({ rows: [] })                        // members
        .mockResolvedValueOnce({ rows: [{ name: 'Goa 2026' }] })   // trip name
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });         // DELETE trip

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── POST /trips/:id/invite ─────────────────────────────────────────────────

  describe('POST /trips/:id/invite', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post(`/trips/${TRIP_ID}/invite`)
        .send({ emails: ['friend@test.com'] });
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with invite result for admin', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice' }] })  // inviterName
        .mockResolvedValueOnce({ rows: [{ name: 'Goa 2026' }] });  // trip name

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/invite`)
        .set('Authorization', `Bearer ${token}`)
        .send({ friendIds: [], emails: ['newmember@test.com'] });

      expect(res.statusCode).toBe(200);
    });
  });

  // ── GET /trips/invite/:token ───────────────────────────────────────────────

  describe('GET /trips/invite/:token', () => {
    it('returns 404 for unknown token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/trips/invite/badtoken123');
      expect(res.statusCode).toBe(404);
    });

    it('returns invite details for valid token', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          trip_id: TRIP_ID,
          trip_name: 'Goa 2026',
          inviter_name: 'Alice',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          accepted_at: null,
        }],
      });

      const res = await request(app).get('/trips/invite/validtoken123');

      expect(res.statusCode).toBe(200);
      expect(res.body.tripName).toBe('Goa 2026');
    });

    it('returns 410 for expired invite', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          trip_id: TRIP_ID,
          trip_name: 'Goa 2026',
          inviter_name: 'Alice',
          expires_at: new Date(Date.now() - 86400000).toISOString(), // past
          accepted_at: null,
        }],
      });

      const res = await request(app).get('/trips/invite/expiredtoken');
      expect(res.statusCode).toBe(410);
      expect(res.body.error).toBe('TOKEN_EXPIRED');
    });
  });
});
