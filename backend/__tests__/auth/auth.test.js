const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');
const bcrypt = require('bcryptjs');

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

jest.mock('../../src/utils/mailer', () => ({
  sendVerificationOTPEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetOTPEmail: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/modules/legal/legal.service', () => ({
  syncUserLegalAckFromCurrent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/sns', () => ({
  registerDeviceEndpoint: jest.fn().mockResolvedValue('arn:aws:sns:test'),
}));

const db = require('../../src/config/database');

const VALID_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('Auth Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── POST /auth/signup ──────────────────────────────────────────────────────

  describe('POST /auth/signup', () => {
    it('returns 422 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ password: 'ValidPass1' });

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('ValidationError');
    });

    it('returns 422 when password is too short', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@test.com', password: 'short' });

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('ValidationError');
    });

    it('returns 422 when password lacks uppercase letter', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@test.com', password: 'nouppercase1' });

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('ValidationError');
    });

    it('returns 201 and sends OTP — does NOT issue tokens yet', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      db.query.mockResolvedValueOnce({ rows: [] }); // check existing user
      db.getClient.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: VALID_USER_ID,
            email: 'test@test.com',
            phone: null,
            is_profile_complete: false,
            is_verified: false,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM otps
        .mockResolvedValueOnce({ rows: [] }) // INSERT INTO otps
        .mockResolvedValueOnce(undefined); // COMMIT

      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(201);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe('test@test.com');
      expect(res.body.user.isVerified).toBe(false);
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('returns 409 when a Gmail alias of an existing email is used', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'john.doe@gmail.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('EmailExists');
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE email_normalized = $1',
        ['johndoe@gmail.com'],
      );
    });

    it('returns 503 and rolls back user when verification email fails', async () => {
      const { sendVerificationOTPEmail } = require('../../src/utils/mailer');
      sendVerificationOTPEmail.mockRejectedValueOnce(new Error('SES down'));

      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      db.query
        .mockResolvedValueOnce({ rows: [] }) // check existing user
        .mockResolvedValueOnce({ rows: [] }); // rollback delete
      db.getClient.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          rows: [{
            id: VALID_USER_ID,
            email: 'test@test.com',
            phone: null,
            is_profile_complete: false,
            is_verified: false,
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(503);
      expect(res.body.error).toBe('EmailDeliveryFailed');
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        [VALID_USER_ID],
      );
    });

    it('returns 409 when email already exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'existing@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('EmailExists');
    });
  });

  // ── POST /auth/verify-email ────────────────────────────────────────────────

  describe('POST /auth/verify-email', () => {
    it('returns 422 when email or otp is missing', async () => {
      const res = await request(app)
        .post('/auth/verify-email')
        .send({ email: 'test@test.com' });

      expect(res.statusCode).toBe(422);
    });

    it('returns 401 when OTP is invalid', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: VALID_USER_ID, email: 'test@test.com' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/verify-email')
        .send({ email: 'test@test.com', otp: '000000' });

      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with tokens after valid OTP', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: VALID_USER_ID, email: 'test@test.com' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'otp-row-id' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/verify-email')
        .send({ email: 'test@test.com', otp: '123456' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.isVerified).toBe(true);
    });
  });

  // ── POST /auth/resend-otp ──────────────────────────────────────────────────

  describe('POST /auth/resend-otp', () => {
    it('returns 422 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/resend-otp')
        .send({ purpose: 'email-verification' });

      expect(res.statusCode).toBe(422);
    });

    it('returns 200 silently when user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/resend-otp')
        .send({ email: 'ghost@test.com', purpose: 'email-verification' });

      expect(res.statusCode).toBe(200);
    });
  });

  // ── POST /auth/login ───────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 422 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'ValidPass1' });

      expect(res.statusCode).toBe(422);
    });

    it('returns 401 when user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'ghost@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('InvalidCredentials');
    });

    it('returns 401 on wrong password', async () => {
      const hashedPassword = await bcrypt.hash('RealPass1', 12);

      db.query.mockResolvedValueOnce({
        rows: [{
          id: VALID_USER_ID,
          email: 'test@test.com',
          password_hash: hashedPassword,
          is_profile_complete: true,
          is_verified: true,
        }],
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'WrongPass1' });

      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when email is not verified yet', async () => {
      const hashedPassword = await bcrypt.hash('ValidPass1', 12);

      db.query.mockResolvedValueOnce({
        rows: [{
          id: VALID_USER_ID,
          email: 'test@test.com',
          password_hash: hashedPassword,
          is_profile_complete: false,
          is_verified: false,
        }],
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('EmailNotVerified');
    });

    it('returns 200 with tokens on valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('ValidPass1', 12);

      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: VALID_USER_ID,
            email: 'test@test.com',
            password_hash: hashedPassword,
            is_profile_complete: true,
            is_verified: true,
          }],
        })
        .mockResolvedValueOnce({ rows: [] });   // INSERT refresh token

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'ValidPass1' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.message).toBe('Login successful');
    });

    it('returns 401 for Google-only account trying password login', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: VALID_USER_ID,
          email: 'google@test.com',
          password_hash: null,   // no password — Google-only account
          is_profile_complete: true,
        }],
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'google@test.com', password: 'AnyPass1' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('GoogleOnlyAccount');
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns 422 when refreshToken is missing', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(res.statusCode).toBe(422);
    });

    it('returns 401 on malformed refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'not-a-jwt' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('InvalidRefreshToken');
    });
  });

  // ── POST /auth/forgot-password ─────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('returns 422 when neither email nor phone provided', async () => {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({});

      expect(res.statusCode).toBe(422);
    });

    it('returns 200 even when email not found (prevents enumeration)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'nobody@test.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/If an account exists/);
    });
  });

  // ── POST /auth/reset-password ──────────────────────────────────────────────

  describe('POST /auth/reset-password', () => {
    it('returns 422 when fields are missing', async () => {
      const res = await request(app)
        .post('/auth/reset-password')
        .send({ email: 'test@test.com' });

      expect(res.statusCode).toBe(422);
    });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer bad.token.here');
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with full user profile', async () => {
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
          full_name: 'Alice Smith',
          dob: '1995-06-15',
          gender: 'female',
          country: 'IN',
          bio: 'Traveller',
          avatar_url: 'https://cdn.test.com/avatar.jpg',
        }],
      });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.id).toBe(VALID_USER_ID);
      expect(res.body.user.profile.fullName).toBe('Alice Smith');
      expect(res.body.user.isProfileComplete).toBe(true);
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .send({ refreshToken: 'some-token' });

      expect(res.statusCode).toBe(401);
    });

    it('returns 200 on valid logout', async () => {
      const token = generateAccessToken({ id: VALID_USER_ID, email: 'alice@test.com' });

      db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE refresh token

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: 'any-token' });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
    });
  });

  // ── POST /auth/apple ───────────────────────────────────────────────────────

  describe('POST /auth/apple', () => {
    it('returns 422 when identityToken or nonce is missing', async () => {
      const res = await request(app)
        .post('/auth/apple')
        .send({ authorizationCode: 'code' });

      expect(res.statusCode).toBe(422);
    });
  });

  // ── POST /auth/facebook (removed) ──────────────────────────────────────────

  describe('POST /auth/facebook', () => {
    it('is no longer routed', async () => {
      const res = await request(app)
        .post('/auth/facebook')
        .send({ accessToken: 'x' });

      expect(res.statusCode).toBe(404);
    });
  });
});
