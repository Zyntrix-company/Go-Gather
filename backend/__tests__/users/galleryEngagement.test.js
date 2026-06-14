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

const OWNER_ID = '123e4567-e89b-12d3-a456-426614174000';
const FRIEND_ID = '223e4567-e89b-12d3-a456-426614174001';
const STRANGER_ID = '323e4567-e89b-12d3-a456-426614174002';
const MEMBER_ID = '423e4567-e89b-12d3-a456-426614174003';
const TRIP_ID = 'aaaa0001-0000-4000-8000-000000000001';
const ALBUM_ID = 'bbbb0001-0000-4000-8000-000000000001';
const COMMENT_ID = 'cccc0001-0000-4000-8000-000000000001';

const ownerToken = generateAccessToken({ id: OWNER_ID, email: 'owner@test.com' });
const friendToken = generateAccessToken({ id: FRIEND_ID, email: 'friend@test.com' });
const strangerToken = generateAccessToken({ id: STRANGER_ID, email: 'stranger@test.com' });
const memberToken = generateAccessToken({ id: MEMBER_ID, email: 'member@test.com' });

const acceptedFriendQueries = () => {
  db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });
};

const notFriendQueries = () => {
  db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
  db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
};

describe('Gallery engagement routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Custom album engagement', () => {
    const albumRow = {
      id: ALBUM_ID,
      user_id: OWNER_ID,
      section: 'trip',
      name: 'My album',
      banner_image_url: null,
      subtitle: null,
      archived_at: null,
      photoCount: 0,
    };

    it('GET engagement returns likes and comments for album owner', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [albumRow] })
        .mockResolvedValueOnce({ rows: [{ count: 2 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/users/me/gallery/albums/${ALBUM_ID}/engagement`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.likeCount).toBe(2);
      expect(res.body.likedByMe).toBe(true);
      expect(res.body.comments).toEqual([]);
    });

    it('GET engagement allows accepted friend of album owner', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [albumRow] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/users/me/gallery/albums/${ALBUM_ID}/engagement`)
        .set('Authorization', `Bearer ${friendToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.likeCount).toBe(0);
    });

    it('GET engagement returns 403 for non-friend', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [albumRow] });
      notFriendQueries();

      const res = await request(app)
        .get(`/users/me/gallery/albums/${ALBUM_ID}/engagement`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('POST like toggles for friend', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [albumRow] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [albumRow] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/users/me/gallery/albums/${ALBUM_ID}/like`)
        .set('Authorization', `Bearer ${friendToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.liked).toBe(true);
      expect(res.body.likeCount).toBe(1);
    });

    it('DELETE comment allows album owner to delete another user comment', async () => {
      db.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: COMMENT_ID,
            user_id: FRIEND_ID,
            parent_type: 'gallery_album',
            parent_id: ALBUM_ID,
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [albumRow] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(app)
        .delete(`/users/me/gallery-items/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE comment rejects friend moderating on custom album', async () => {
      db.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: COMMENT_ID,
            user_id: OWNER_ID,
            parent_type: 'gallery_album',
            parent_id: ALBUM_ID,
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [albumRow] });

      const res = await request(app)
        .delete(`/users/me/gallery-items/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${friendToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Trip/event engagement with galleryOwnerId', () => {
    it('GET engagement allows friend via galleryOwnerId without membership', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: 3 }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/users/me/gallery-items/trip/${TRIP_ID}/engagement?galleryOwnerId=${OWNER_ID}`)
        .set('Authorization', `Bearer ${friendToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.likeCount).toBe(3);
    });

    it('GET engagement returns 403 for non-friend with galleryOwnerId', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });
      notFriendQueries();

      const res = await request(app)
        .get(`/users/me/gallery-items/trip/${TRIP_ID}/engagement?galleryOwnerId=${OWNER_ID}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('DELETE comment allows trip member to delete any comment', async () => {
      db.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: COMMENT_ID,
            user_id: FRIEND_ID,
            parent_type: 'trip',
            parent_id: TRIP_ID,
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(app)
        .delete(`/users/me/gallery-items/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE comment rejects non-member friend moderating trip comment', async () => {
      db.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: COMMENT_ID,
            user_id: OWNER_ID,
            parent_type: 'trip',
            parent_id: TRIP_ID,
          }],
        })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const res = await request(app)
        .delete(`/users/me/gallery-items/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${friendToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('PATCH comment rejects non-author', async () => {
      db.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: COMMENT_ID,
            user_id: OWNER_ID,
            parent_type: 'trip',
            parent_id: TRIP_ID,
            text: 'hello',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        });

      const res = await request(app)
        .patch(`/users/me/gallery-items/comments/${COMMENT_ID}`)
        .set('Authorization', `Bearer ${friendToken}`)
        .send({ text: 'hacked' });

      expect(res.statusCode).toBe(404);
    });
  });
});
