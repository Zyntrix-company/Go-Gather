/**
 * SEC-03 — friends-only gallery access on the legacy per-user routes, and
 * SEC-04 search hardening. The real verifyViewerAccess runs against mocked
 * friendship/block rows; only the data fetches behind it are stubbed.
 */
const request = require('supertest');

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

jest.mock('../../src/modules/users/service', () => ({
  ...jest.requireActual('../../src/modules/users/service'),
  getUserGallery: jest.fn(),
  getUserPhotos: jest.fn(),
}));

jest.mock('../../src/modules/users/galleryAlbums.service', () => ({
  ...jest.requireActual('../../src/modules/users/galleryAlbums.service'),
  getAlbumPhotosForProfile: jest.fn(),
}));

const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');
const db = require('../../src/config/database');
const usersService = require('../../src/modules/users/service');
const galleryAlbums = require('../../src/modules/users/galleryAlbums.service');

const VIEWER = '123e4567-e89b-12d3-a456-426614174000';
const TARGET = '223e4567-e89b-12d3-a456-426614174001';
const TRIP = 'aaaa0001-0000-4000-8000-000000000001';
const ALBUM = 'bbbb0001-0000-4000-8000-000000000001';
const token = generateAccessToken({ id: VIEWER, email: 'viewer@test.com' });

const ROUTES = [
  { name: 'GET /users/:id/gallery', path: (id) => `/users/${id}/gallery`, stub: () => usersService.getUserGallery },
  {
    name: 'GET /users/:id/photos (trip scoped)',
    path: (id) => `/users/${id}/photos?parentType=trip&parentId=${TRIP}`,
    stub: () => usersService.getUserPhotos,
  },
  { name: 'GET /users/:id/photos', path: (id) => `/users/${id}/photos`, stub: () => usersService.getUserPhotos },
  {
    name: 'GET /users/:id/gallery/albums/:albumId/photos',
    path: (id) => `/users/${id}/gallery/albums/${ALBUM}/photos`,
    stub: () => galleryAlbums.getAlbumPhotosForProfile,
  },
];

// verifyViewerAccess: query 1 = "target blocked viewer?", query 2 = "accepted friends?"
const asFriend = () => db.query
  .mockResolvedValueOnce({ rowCount: 0, rows: [] })
  .mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
const asStranger = () => db.query
  .mockResolvedValueOnce({ rowCount: 0, rows: [] })
  .mockResolvedValueOnce({ rowCount: 0, rows: [] });
const asBlocked = () => db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });

describe('Gallery access (SEC-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    usersService.getUserGallery.mockResolvedValue({ trips: [], events: [], customAlbums: { trip: [], event: [] } });
    usersService.getUserPhotos.mockResolvedValue({ trips: [], events: [] });
    galleryAlbums.getAlbumPhotosForProfile.mockResolvedValue({ photos: [], total: 0 });
  });

  describe.each(ROUTES)('$name', ({ path, stub }) => {
    it('401 without a token', async () => {
      const res = await request(app).get(path(TARGET));
      expect(res.statusCode).toBe(401);
      expect(stub()).not.toHaveBeenCalled();
    });

    it('200 for the owner (no friendship lookup needed)', async () => {
      const res = await request(app).get(path(VIEWER)).set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(stub()).toHaveBeenCalled();
    });

    it('200 for an accepted friend', async () => {
      asFriend();
      const res = await request(app).get(path(TARGET)).set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(stub()).toHaveBeenCalled();
    });

    it('403 for a signed-in non-friend, without fetching any data', async () => {
      asStranger();
      const res = await request(app).get(path(TARGET)).set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
      expect(stub()).not.toHaveBeenCalled();
    });

    it('403 BLOCKED when the target has blocked the viewer', async () => {
      asBlocked();
      const res = await request(app).get(path(TARGET)).set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('BLOCKED');
      expect(stub()).not.toHaveBeenCalled();
    });
  });

  it('checks friendship between the viewer and the profile owner, not a trip member', async () => {
    asStranger();
    await request(app)
      .get(`/users/${TARGET}/photos?parentType=trip&parentId=${TRIP}`)
      .set('Authorization', `Bearer ${token}`);
    const friendCheck = db.query.mock.calls[1];
    expect(friendCheck[0]).toMatch(/status = 'accepted'/);
    expect(friendCheck[1]).toEqual([VIEWER, TARGET]);
  });
});

describe('User search hardening (SEC-04)', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [] });
  });

  it('rejects one-character queries', async () => {
    const res = await request(app).get('/users/search?q=a').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(422);
  });

  it('rejects queries that are only whitespace around one character', async () => {
    const res = await request(app).get('/users/search?q=%20a%20').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(422);
  });

  it('accepts two-character queries', async () => {
    const res = await request(app).get('/users/search?q=ab').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/users/search?q=ab');
    expect(res.statusCode).toBe(401);
  });
});
