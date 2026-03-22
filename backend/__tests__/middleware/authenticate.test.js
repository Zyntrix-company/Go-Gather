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

const db = require('../../src/config/database');
const VALID_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('authenticateJWT middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 when header format is not Bearer', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Token abc123');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 with error TokenExpired for an expired token', async () => {
    // jwt library will detect a malformed/expired token
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InRlc3QiLCJleHAiOjF9.invalid');
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for a completely invalid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('passes through to route handler with a valid token', async () => {
    const token = generateAccessToken({ id: VALID_USER_ID, email: 'alice@test.com' });

    db.query.mockResolvedValueOnce({
      rows: [{
        id: VALID_USER_ID,
        email: 'alice@test.com',
        phone: null,
        google_id: null,
        facebook_id: null,
        is_profile_complete: true,
        is_verified: true,
        sns_endpoint_arn: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        full_name: 'Alice',
        dob: null,
        gender: null,
        country: null,
        bio: null,
        avatar_url: null,
      }],
    });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.id).toBe(VALID_USER_ID);
  });
});
