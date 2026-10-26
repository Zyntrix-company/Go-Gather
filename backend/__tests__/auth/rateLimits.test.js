/**
 * SEC-07 — rate limiting on unauthenticated endpoints and proxy-aware client IPs.
 * Low caps are set before the app loads (setup.js only fills unset values).
 */
process.env.AUTH_LOGIN_LIMIT_PER_IP = '4';
process.env.AUTH_LOGIN_LIMIT_PER_EMAIL = '3';
process.env.AUTH_SIGNUP_LIMIT_PER_IP = '2';
process.env.AUTH_OTP_SEND_LIMIT_PER_IP = '50';
process.env.AUTH_OTP_SEND_LIMIT_PER_EMAIL = '2';
process.env.AUTH_OTP_VERIFY_LIMIT_PER_IP = '50';
process.env.AUTH_OTP_VERIFY_LIMIT_PER_EMAIL = '3';
process.env.AUTH_SOCIAL_LIMIT_PER_IP = '2';
process.env.CONTACT_LIMIT_PER_IP = '2';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');

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

const db = require('../../src/config/database');

// Each test uses its own client IPs/emails: limiter state lives for the whole file.
let ipSeq = 0;
const freshIp = () => { ipSeq += 1; return `203.0.113.${ipSeq}`; };

const badLogin = (ip, email) => request(app)
  .post('/auth/login')
  .set('X-Forwarded-For', ip)
  .send({ email, password: 'WrongPass1' });

describe('Rate limiting (SEC-07)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 }); // unknown user / empty results
  });

  it('trusts exactly one proxy hop', () => {
    expect(app.get('trust proxy')).toBe(1);
  });

  it('limits failed logins per email even when the attacker rotates IPs', async () => {
    const email = 'target1@test.com';
    for (let i = 0; i < 3; i += 1) {
      expect((await badLogin(freshIp(), email)).statusCode).toBe(401);
    }
    const blocked = await badLogin(freshIp(), email);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body.error).toBe('RATE_LIMITED');
  });

  it('limits failed logins per IP across different emails', async () => {
    const ip = freshIp();
    for (let i = 0; i < 4; i += 1) {
      expect((await badLogin(ip, `spray${i}@test.com`)).statusCode).toBe(401);
    }
    expect((await badLogin(ip, 'spray-last@test.com')).statusCode).toBe(429);
  });

  it('keeps separate buckets for separate clients behind the proxy', async () => {
    const ip = freshIp();
    for (let i = 0; i < 4; i += 1) await badLogin(ip, `bucketA${i}@test.com`);
    expect((await badLogin(ip, 'bucketA-x@test.com')).statusCode).toBe(429);
    // A different client IP is unaffected by the first client's lockout.
    expect((await badLogin(freshIp(), 'bucketB@test.com')).statusCode).toBe(401);
  });

  it('does not count successful logins against the limit', async () => {
    const email = 'regular@test.com';
    const hash = await bcrypt.hash('RightPass1', 4);
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) {
      db.query.mockResolvedValueOnce({
        rows: [{ id: '123e4567-e89b-12d3-a456-426614174000', email, password_hash: hash, is_verified: true }],
      });
      const res = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email, password: 'RightPass1' });
      expect(res.statusCode).toBe(200);
    }
  });

  it('limits code verification attempts per email', async () => {
    const email = 'verify-target@test.com';
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post('/auth/reset-password')
        .set('X-Forwarded-For', freshIp())
        .send({ email, otp: String(100000 + i), password: 'NewValidPass1' });
      expect(res.statusCode).toBe(401);
    }
    const blocked = await request(app)
      .post('/auth/verify-email')
      .set('X-Forwarded-For', freshIp())
      .send({ email, otp: '999999' });
    expect(blocked.statusCode).toBe(429);
  });

  it('limits code-sending endpoints per email (email bombing)', async () => {
    const email = 'inbox@test.com';
    for (let i = 0; i < 2; i += 1) {
      const res = await request(app)
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', freshIp())
        .send({ email });
      expect(res.statusCode).toBe(200);
    }
    const blocked = await request(app)
      .post('/auth/resend-otp')
      .set('X-Forwarded-For', freshIp())
      .send({ email, purpose: 'password-reset' });
    expect(blocked.statusCode).toBe(429);
  });

  it('limits signups per IP', async () => {
    const ip = freshIp();
    // Validation failures still count toward the signup cap.
    for (let i = 0; i < 2; i += 1) {
      await request(app).post('/auth/signup').set('X-Forwarded-For', ip).send({ email: `n${i}@test.com` });
    }
    const res = await request(app)
      .post('/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({ email: 'n3@test.com', password: 'ValidPass1' });
    expect(res.statusCode).toBe(429);
  });

  it('limits social sign-in calls per IP', async () => {
    const ip = freshIp();
    for (let i = 0; i < 2; i += 1) {
      await request(app).post('/auth/google').set('X-Forwarded-For', ip).send({});
    }
    expect((await request(app).post('/auth/google').set('X-Forwarded-For', ip).send({})).statusCode).toBe(429);
  });

  it('limits the public contact form per IP', async () => {
    const ip = freshIp();
    db.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
    const body = { name: 'A', email: 'a@test.com', subject: 'Hi', country: 'IN', message: 'Hello' };
    for (let i = 0; i < 2; i += 1) {
      expect((await request(app).post('/api/contact').set('X-Forwarded-For', ip).send(body)).statusCode).toBe(200);
    }
    const blocked = await request(app).post('/api/contact').set('X-Forwarded-For', ip).send(body);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body.error).toBe('RATE_LIMITED');
  });

  it('leaves token refresh unthrottled (signature-checked, CGNAT-heavy)', async () => {
    const ip = freshIp();
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app)
        .post('/auth/refresh')
        .set('X-Forwarded-For', ip)
        .send({ refreshToken: 'not-a-jwt' });
      expect(res.statusCode).toBe(401);
    }
  });
});
