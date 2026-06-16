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
const token = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });
const friendToken = generateAccessToken({ id: FRIEND_ID, email: 'bob@test.com' });

describe('Shared gallery item routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/me/gallery-items/trip/:parentId/photos', () => {
    it('returns shared photos from the photos table only', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rows: [{
          id: SHARED_PHOTO_ID,
          file_url: 'https://cdn.test.com/shared.jpg',
          s3_key: 'trips/x/photos/a.jpg',
          mime_type: 'image/jpeg',
          activity_id: null,
          display_order: 0,
          created_at: new Date().toISOString(),
          activity_title: null,
        }] });

      const res = await request(app)
        .get(`/users/me/gallery-items/trip/${TRIP_ID}/photos`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.photos.map((p) => p.id)).toEqual([SHARED_PHOTO_ID]);
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
