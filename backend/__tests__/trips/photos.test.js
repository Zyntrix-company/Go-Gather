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
  uploadToS3: jest.fn().mockResolvedValue('trips/uuid/photos/uuid-photo.jpg'),
  deleteFromS3: jest.fn().mockResolvedValue(true),
  sanitiseFilename: jest.fn((n) => n),
}));

const db = require('../../src/config/database');

const USER_ID  = '123e4567-e89b-12d3-a456-426614174000';
const USER2_ID = '223e4567-e89b-12d3-a456-426614174001';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const PHOTO_ID = 'ffff0001-0000-4000-8000-000000000001';
const token    = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

const mockTripMember = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'member' }] });
};

const mockTripMemberAdmin = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'admin' }] });
};

const photoRow = {
  id: PHOTO_ID,
  parent_type: 'trip',
  parent_id: TRIP_ID,
  s3_key: 'trips/uuid/photos/uuid-photo.jpg',
  file_url: 'https://cdn.test.com/photo.jpg',
  url: 'https://cdn.test.com/photo.jpg',
  mime_type: 'image/jpeg',
  uploaded_by: USER_ID,
  display_order: 0,
  activity_id: null,
  uploader_name: 'Alice',
  total_count: 1,
  created_at: new Date().toISOString(),
};

describe('Photos Routes', () => {
  beforeEach(() => jest.resetAllMocks());

  // ── GET /trips/:id/photos ──────────────────────────────────────────────────

  describe('GET /trips/:id/photos', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/trips/${TRIP_ID}/photos`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with photos list', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [photoRow] });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/photos`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.photos)).toBe(true);
      expect(res.body.photos[0].mimeType).toBe('image/jpeg');
      expect(res.body.photos[0].displayOrder).toBe(0);
    });
  });

  // ── PATCH /trips/:id/photos/reorder ────────────────────────────────────────

  describe('PATCH /trips/:id/photos/reorder', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch(`/trips/${TRIP_ID}/photos/reorder`)
        .send({ items: [{ id: PHOTO_ID, displayOrder: 0 }] });
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 on successful reorder', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: PHOTO_ID }] });
      db.getClient.mockResolvedValueOnce({
        query: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined),
        release: jest.fn(),
      });

      const res = await request(app)
        .patch(`/trips/${TRIP_ID}/photos/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ id: PHOTO_ID, displayOrder: 0 }] });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when photo not in trip-level scope', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const res = await request(app)
        .patch(`/trips/${TRIP_ID}/photos/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ id: PHOTO_ID, displayOrder: 0 }] });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /trips/:id/photos ─────────────────────────────────────────────────

  describe('POST /trips/:id/photos (multipart)', () => {
    it('returns 400 when no files are attached', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/photos`)
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect([400, 422]).toContain(res.statusCode);
    });

    it('returns 201 after uploading a JPEG photo', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ next_order: 0 }] })
        .mockResolvedValueOnce({ rows: [photoRow] });

      // Minimal JPEG: starts with FF D8 FF bytes
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...Buffer.from(' JFIF minimal')]);

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/photos`)
        .set('Authorization', `Bearer ${token}`)
        .attach('photos', jpegBuffer, { filename: 'beach.jpg', contentType: 'image/jpeg' });

      expect(res.statusCode).toBe(201);
      expect(Array.isArray(res.body.photos)).toBe(true);
    });
  });

  // ── DELETE /trips/:id/photos/:photoId ──────────────────────────────────────

  describe('DELETE /trips/:id/photos/:photoId', () => {
    it('returns 200 when any member deletes a photo', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...photoRow, uploaded_by: USER2_ID }] })
        .mockResolvedValueOnce({ rows: [{ id: PHOTO_ID }] });

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/photos/${PHOTO_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when photo not found', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/photos/${PHOTO_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
    });

    it('returns 200 when uploader deletes own photo', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...photoRow, uploaded_by: USER_ID }] })
        .mockResolvedValueOnce({ rows: [{ id: PHOTO_ID }] });

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/photos/${PHOTO_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 200 when admin deletes any photo', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...photoRow, uploaded_by: USER2_ID }] })
        .mockResolvedValueOnce({ rows: [{ id: PHOTO_ID }] });

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/photos/${PHOTO_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
    });
  });
});
