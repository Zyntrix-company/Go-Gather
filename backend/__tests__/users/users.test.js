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

  describe('GET /users/:id', () => {
    it('should return 422 for invalid UUID', async () => {
      const res = await request(app).get('/users/not-a-uuid');

      expect(res.statusCode).toBe(422);
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get(`/users/${mockUserId}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 200 with public profile', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: mockUserId,
          email: 'test@test.com',
          created_at: new Date().toISOString(),
          full_name: 'Test User',
          gender: 'male',
          country: 'India',
          bio: 'Hello world',
          avatar_url: 'https://cdn.example.com/avatar.jpg',
        }],
      });

      const res = await request(app).get(`/users/${mockUserId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.profile.fullName).toBe('Test User');
      expect(res.body.user.profile.avatarUrl).toBe('https://cdn.example.com/avatar.jpg');
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
