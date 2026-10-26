require('../setup');

const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');

// Mock DB
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

// Mock AWS
jest.mock('../../src/config/aws', () => ({
  s3Client: {},
  sesClient: { send: jest.fn() },
  snsClient: { send: jest.fn() },
}));

const db = require('../../src/config/database');

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const validToken = generateAccessToken({ id: mockUserId, email: 'test@test.com' });

describe('Users Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /users/profile', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/users/profile')
        .send({ fullName: 'Test User' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 422 if fullName is missing', async () => {
      const res = await request(app)
        .post('/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return 200 on successful profile save', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce() // BEGIN
          .mockResolvedValueOnce() // UPSERT profile
          .mockResolvedValueOnce({ rows: [{ username: 'testuser' }] }) // SELECT username (already set)
          .mockResolvedValueOnce() // UPDATE users
          .mockResolvedValueOnce(), // COMMIT
        release: jest.fn(),
      };
      db.getClient.mockResolvedValue(mockClient);

      db.query.mockResolvedValueOnce({
        rows: [{
          id: mockUserId,
          email: 'test@test.com',
          phone: null,
          is_profile_complete: true,
          full_name: 'Test User',
          dob: '1995-01-01',
          gender: 'male',
          country: 'India',
          bio: 'Hello world',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });

      const res = await request(app)
        .post('/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          fullName: 'Test User',
          dob: '1995-01-01',
          gender: 'male',
          country: 'India',
          bio: 'Hello world',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Profile saved successfully');
      expect(res.body.user.profile.fullName).toBe('Test User');
    });
  });

  // SEC-04: GET /users/:id now requires sign-in, honours blocks, and no longer
  // returns email or gender (it used to be public and include both).
  describe('GET /users/:id', () => {
    const OTHER_ID = '323e4567-e89b-12d3-a456-426614174999';

    it('should return 401 without auth', async () => {
      const res = await request(app).get(`/users/${OTHER_ID}`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 422 for invalid UUID', async () => {
      const res = await request(app)
        .get('/users/not-a-uuid')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(422);
    });

    it('should return 404 if user not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })  // block check: not blocked
        .mockResolvedValueOnce({ rows: [] }); // profile lookup: none

      const res = await request(app)
        .get(`/users/${OTHER_ID}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 403 when the target has blocked the viewer', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // block row exists

      const res = await request(app)
        .get(`/users/${OTHER_ID}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('BLOCKED');
    });

    it('should return 200 with a minimal public profile (no email, no gender)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // block check: not blocked
        .mockResolvedValueOnce({
          rows: [{
            id: OTHER_ID,
            created_at: new Date().toISOString(),
            full_name: 'Test User',
            country: 'India',
            bio: 'Hello world',
            avatar_url: 'https://cdn.example.com/avatar.jpg',
          }],
        });

      const res = await request(app)
        .get(`/users/${OTHER_ID}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.profile.fullName).toBe('Test User');
      expect(res.body.user.profile.avatarUrl).toBe('https://cdn.example.com/avatar.jpg');
      expect(res.body.user).not.toHaveProperty('email');
      expect(res.body.user.profile).not.toHaveProperty('gender');
      // The SQL itself no longer selects them either.
      const profileSql = db.query.mock.calls[1][0];
      expect(profileSql).not.toMatch(/u\.email/);
      expect(profileSql).not.toMatch(/p\.gender/);
    });
  });

  describe('PUT /users/photo', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .put('/users/photo');

      expect(res.statusCode).toBe(401);
    });
  });
});
