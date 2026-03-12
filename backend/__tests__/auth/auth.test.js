require('../setup');

const request = require('supertest');
const app = require('../../src/app');

// Mock the database module
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

// Mock AWS services
jest.mock('../../src/config/aws', () => ({
  s3Client: {},
  sesClient: { send: jest.fn() },
  snsClient: { send: jest.fn() },
}));

const db = require('../../src/config/database');
const bcrypt = require('bcryptjs');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('should return 422 if email is missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ password: 'ValidPass1' });

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return 422 if password is too short', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@test.com', password: 'short' });

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return 422 if password lacks uppercase', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@test.com', password: 'nouppercase1' });

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return 201 on successful signup', async () => {
      // Mock: no existing user
      db.query
        .mockResolvedValueOnce({ rows: [] }) // check existing
        .mockResolvedValueOnce({ // insert user
          rows: [{
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'test@test.com',
            phone: null,
            is_profile_complete: false,
            created_at: new Date().toISOString(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // store refresh token

      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe('test@test.com');
    });

    it('should return 409 if email already exists', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-user' }],
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'existing@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should return 422 if email is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'ValidPass1' });

      expect(res.statusCode).toBe(422);
    });

    it('should return 401 on wrong credentials', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'WrongPass1' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 200 with tokens on valid login', async () => {
      const hashedPassword = await bcrypt.hash('ValidPass1', 12);

      db.query
        .mockResolvedValueOnce({ // find user
          rows: [{
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'test@test.com',
            password_hash: hashedPassword,
            is_profile_complete: true,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // store refresh token

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.message).toBe('Login successful');
    });
  });

  describe('POST /auth/facebook', () => {
    it('should return 422 if accessToken is missing', async () => {
      const res = await request(app)
        .post('/auth/facebook')
        .send({});

      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 422 if refreshToken is missing', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(res.statusCode).toBe(422);
    });

    it('should return 401 on invalid refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should return 422 if neither email nor phone provided', async () => {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({});

      expect(res.statusCode).toBe(422);
    });

    it('should return 200 even if email not found (prevent enumeration)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('If an account exists');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 without auth header', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 401 without auth header', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .send({ refreshToken: 'some-token' });

      expect(res.statusCode).toBe(401);
    });
  });
});
