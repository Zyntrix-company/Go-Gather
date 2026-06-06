require('../setup');

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
  uploadToS3: jest.fn().mockResolvedValue(undefined),
  deleteFromS3: jest.fn().mockResolvedValue(true),
  sanitiseFilename: jest.fn((n) => n),
  getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://cdn.test.com/presigned.jpg'),
}));

const db = require('../../src/config/database');

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const FRIEND_ID = '223e4567-e89b-12d3-a456-426614174001';
const TRIP_ID = 'aaaa0001-0000-4000-8000-000000000001';
const SHARED_PHOTO_ID = 'ffff0001-0000-4000-8000-000000000001';
const EXTRA_PHOTO_ID = 'ffff0002-0000-4000-8000-000000000002';
const token = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });
const friendToken = generateAccessToken({ id: FRIEND_ID, email: 'bob@test.com' });

describe('Gallery overlay routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/me/gallery-items/trip/:parentId/photos', () => {
    it('returns curated photos excluding hidden and including extras', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rows: [{
          id: SHARED_PHOTO_ID,
          file_url: 'https://cdn.test.com/shared.jpg',
          s3_key: 'trips/x/photos/a.jpg',
          mime_type: 'image/jpeg',
          activity_id: null,
          created_at: new Date().toISOString(),
          activity_title: null,
          source: 'shared',
        }] })
        .mockResolvedValueOnce({ rows: [{
          id: EXTRA_PHOTO_ID,
          file_url: 'https://cdn.test.com/extra.jpg',
          s3_key: 'users/x/gallery/trip/y/z.jpg',
          mime_type: 'image/jpeg',
          activity_id: null,
          activity_title: null,
          created_at: new Date().toISOString(),
          source: 'extra',
        }] });

      const res = await request(app)
        .get(`/users/me/gallery-items/trip/${TRIP_ID}/photos`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.photos.map((p) => p.id)).toEqual(
        expect.arrayContaining([SHARED_PHOTO_ID, EXTRA_PHOTO_ID]),
      );
    });
  });

  describe('POST /users/me/gallery-items/trip/:parentId/photos/hide/:photoId', () => {
    it('returns 200 when hiding a shared photo', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: SHARED_PHOTO_ID }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(app)
        .post(`/users/me/gallery-items/trip/${TRIP_ID}/photos/hide/${SHARED_PHOTO_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /users/me/gallery-items/extra-photos/:photoId', () => {
    it('returns 200 when deleting own gallery-only photo', async () => {
      db.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: EXTRA_PHOTO_ID,
            user_id: USER_ID,
            s3_key: 'users/x/gallery/trip/y/z.jpg',
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(app)
        .delete(`/users/me/gallery-items/extra-photos/${EXTRA_PHOTO_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /users/:id/gallery-items/trip/:parentId/photos', () => {
    it('returns 403 when viewer is not a friend', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const res = await request(app)
        .get(`/users/${USER_ID}/gallery-items/trip/${TRIP_ID}/photos`)
        .set('Authorization', `Bearer ${friendToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
