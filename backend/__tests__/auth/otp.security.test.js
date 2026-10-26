/**
 * SEC-02 — OTP brute-force protection: CSPRNG codes, keyed hashing,
 * per-code attempt limit, resend cooldown, no account enumeration.
 */
const crypto = require('crypto');
const request = require('supertest');
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

jest.mock('../../src/modules/invites/invites.service', () => ({
  linkPendingInvitesToUser: jest.fn().mockResolvedValue(undefined),
}));

const db = require('../../src/config/database');
const mailer = require('../../src/utils/mailer');
const { generateOTP, hashOTP, OTP_MAX_ATTEMPTS } = require('../../src/modules/auth/service');

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const EMAIL = 'victim@test.com';
const NEW_PASSWORD = 'NewValidPass1';
const userRow = { id: USER_ID, email: EMAIL, is_verified: false };

const otpRow = (code, attempts, purpose = 'password-reset') => ({
  id: 'otp-row-id',
  otp_hash: hashOTP(USER_ID, purpose, code),
  attempts,
});

const calledSql = () => db.query.mock.calls.map(([sql]) => sql);

describe('OTP security (SEC-02)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mailer.sendPasswordResetOTPEmail.mockResolvedValue(true);
    mailer.sendVerificationOTPEmail.mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('generateOTP', () => {
    it('always returns exactly six digits', () => {
      for (let i = 0; i < 2000; i += 1) {
        expect(generateOTP()).toMatch(/^\d{6}$/);
      }
    });

    it('uses crypto.randomInt and zero-pads small values', () => {
      const spy = jest.spyOn(crypto, 'randomInt').mockReturnValue(42);
      expect(generateOTP()).toBe('000042');
      expect(spy).toHaveBeenCalledWith(0, 1000000);
    });

    it('does not use Math.random', () => {
      const spy = jest.spyOn(Math, 'random');
      generateOTP();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('hashOTP', () => {
    it('binds the hash to user and purpose, and is not a bare SHA-256', () => {
      const base = hashOTP(USER_ID, 'password-reset', '123456');
      expect(hashOTP(USER_ID, 'email-verification', '123456')).not.toBe(base);
      expect(hashOTP('223e4567-e89b-12d3-a456-426614174001', 'password-reset', '123456')).not.toBe(base);
      expect(base).not.toBe(crypto.createHash('sha256').update('123456').digest('hex'));
    });
  });

  describe('POST /auth/reset-password', () => {
    const send = (otp) => request(app)
      .post('/auth/reset-password')
      .send({ email: EMAIL, otp, password: NEW_PASSWORD });

    it('reserves the attempt atomically, capped at OTP_MAX_ATTEMPTS', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [otpRow('123456', 1)] });

      await send('000000');

      const [sql, params] = db.query.mock.calls[1];
      expect(sql).toMatch(/UPDATE otps SET attempts = attempts \+ 1/);
      expect(sql).toMatch(/attempts < \$3/);
      expect(params).toEqual([USER_ID, 'password-reset', OTP_MAX_ATTEMPTS]);
    });

    it('rejects a wrong code with 401 and keeps the code alive', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [otpRow('123456', 2)] });

      const res = await send('000000');

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid or expired OTP');
      expect(calledSql().some((q) => /DELETE FROM otps/.test(q))).toBe(false);
      expect(calledSql().some((q) => /UPDATE users SET password_hash/.test(q))).toBe(false);
    });

    it('locks the code (429) and deletes it on the last allowed wrong guess', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [otpRow('123456', OTP_MAX_ATTEMPTS)] });

      const res = await send('000000');

      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe('OTP_LOCKED');
      expect(db.query).toHaveBeenCalledWith('DELETE FROM otps WHERE id = $1', ['otp-row-id']);
      expect(calledSql().some((q) => /UPDATE users SET password_hash/.test(q))).toBe(false);
    });

    it('rejects even the correct code once attempts are exhausted', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [] })                      // reservation refused (attempts >= max)
        .mockResolvedValueOnce({ rows: [{ id: 'otp-row-id' }] }); // spent code found and deleted

      const res = await send('123456');

      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe('OTP_LOCKED');
      expect(calledSql().some((q) => /UPDATE users SET password_hash/.test(q))).toBe(false);
    });

    it('returns 401 when there is no live code at all', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [] })   // nothing to reserve
        .mockResolvedValueOnce({ rows: [] });  // nothing spent

      const res = await send('123456');
      expect(res.statusCode).toBe(401);
    });

    it('accepts the correct code, consumes it, changes the password and signs out all sessions', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [otpRow('123456', 1)] });

      const res = await send('123456');

      expect(res.statusCode).toBe(200);
      expect(db.query).toHaveBeenCalledWith('DELETE FROM otps WHERE id = $1', ['otp-row-id']);
      expect(calledSql().some((q) => /UPDATE users SET password_hash/.test(q))).toBe(true);
      expect(db.query).toHaveBeenCalledWith('DELETE FROM refresh_tokens WHERE user_id = $1', [USER_ID]);
    });

    it('answers an unknown email exactly like a wrong code (no enumeration)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // no such user
      const unknown = await request(app)
        .post('/auth/reset-password')
        .send({ email: 'nobody@test.com', otp: '123456', password: NEW_PASSWORD });

      db.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [otpRow('654321', 1)] });
      const wrong = await send('123456');

      expect(unknown.statusCode).toBe(401);
      expect(unknown.body).toEqual(wrong.body);
    });
  });

  describe('POST /auth/verify-email', () => {
    it('answers an unknown email with 401, not 404', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/auth/verify-email')
        .send({ email: 'nobody@test.com', otp: '123456' });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid or expired OTP');
    });

    it('locks after the last allowed wrong guess', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [otpRow('123456', OTP_MAX_ATTEMPTS, 'email-verification')] });

      const res = await request(app)
        .post('/auth/verify-email')
        .send({ email: EMAIL, otp: '000000' });

      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe('OTP_LOCKED');
      expect(calledSql().some((q) => /UPDATE users SET is_verified/.test(q))).toBe(false);
    });
  });

  describe('resend cooldown', () => {
    it('forgot-password inside the cooldown answers normally but sends no email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: USER_ID, email: EMAIL }] }) // user lookup
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });            // recent code exists

      const res = await request(app).post('/auth/forgot-password').send({ email: EMAIL });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/If an account exists/);
      expect(mailer.sendPasswordResetOTPEmail).not.toHaveBeenCalled();
      expect(calledSql().some((q) => /INSERT INTO otps/.test(q))).toBe(false);
    });

    it('forgot-password outside the cooldown issues and sends a new code', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: USER_ID, email: EMAIL }] })
        .mockResolvedValueOnce({ rows: [] }); // no recent code

      const res = await request(app).post('/auth/forgot-password').send({ email: EMAIL });

      expect(res.statusCode).toBe(200);
      expect(mailer.sendPasswordResetOTPEmail).toHaveBeenCalledWith(EMAIL, expect.stringMatching(/^\d{6}$/));
      expect(calledSql().some((q) => /INSERT INTO otps/.test(q))).toBe(true);
    });

    it('resend-otp inside the cooldown answers with the normal message and sends nothing', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: USER_ID, email: EMAIL, is_verified: false }] })
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const res = await request(app)
        .post('/auth/resend-otp')
        .send({ email: EMAIL, purpose: 'email-verification' });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('A new code has been sent.');
      expect(mailer.sendVerificationOTPEmail).not.toHaveBeenCalled();
    });

    it('stores codes keyed with hashOTP, not the raw value', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: USER_ID, email: EMAIL }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).post('/auth/forgot-password').send({ email: EMAIL });

      const sentCode = mailer.sendPasswordResetOTPEmail.mock.calls[0][1];
      const insert = db.query.mock.calls.find(([sql]) => /INSERT INTO otps/.test(sql));
      expect(insert[1][1]).toBe(hashOTP(USER_ID, 'password-reset', sentCode));
      expect(insert[1]).not.toContain(sentCode);
    });
  });
});
