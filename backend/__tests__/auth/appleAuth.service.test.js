jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));
jest.mock('../../src/modules/auth/apple', () => ({
  verifyIdentityToken: jest.fn(),
  exchangeAuthorizationCode: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../src/utils/fcm.util', () => ({ registerDeviceToken: jest.fn().mockResolvedValue() }));
jest.mock('../../src/utils/mailer', () => ({}));
jest.mock('../../src/modules/legal/legal.service', () => ({ syncUserLegalAckFromCurrent: jest.fn() }));
jest.mock('../../src/modules/invites/invites.service', () => ({ linkPendingInvitesToUser: jest.fn() }));
jest.mock('../../src/utils/encrypt.util', () => ({ encrypt: (v) => `enc:${v}` }));

const db = require('../../src/config/database');
const apple = require('../../src/modules/auth/apple');
const { appleAuth } = require('../../src/modules/auth/service');

const APPLE_ID = '001234.apple';
const base = { identityToken: 'tok', nonce: 'n', authorizationCode: 'code', fullName: null, deviceToken: 'fcm', platform: 'ios' };
const claims = (extra = {}) => ({ sub: APPLE_ID, email: 'jane@example.com', email_verified: 'true', ...extra });

/** Route db.query by SQL text; records every call for assertions. */
const mockDb = (handlers) => {
  db.query.mockImplementation(async (sql, params) => {
    for (const [match, result] of handlers) {
      if (sql.includes(match)) {
        if (result instanceof Error) throw result;
        return typeof result === 'function' ? result(params) : result;
      }
    }
    return { rows: [] };
  });
};
const sqlCalls = () => db.query.mock.calls.map(([sql, params]) => ({ sql, params }));

describe('appleAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apple.exchangeAuthorizationCode.mockResolvedValue(null);
  });

  it('signs in a returning Apple user by apple_id, even when Apple omits the email', async () => {
    apple.verifyIdentityToken.mockResolvedValue({ sub: APPLE_ID });
    mockDb([['WHERE apple_id = $1 AND deleted_at IS NULL', { rows: [{ id: 'u1', email: 'jane@example.com', is_profile_complete: true }] }]]);

    const res = await appleAuth(base);

    expect(res.user).toMatchObject({ id: 'u1', isNewUser: false, isProfileComplete: true });
    expect(res.accessToken).toBeTruthy();
    expect(sqlCalls().some((c) => c.sql.includes('INSERT INTO users'))).toBe(false);
  });

  it('creates a new account with the name Apple shares on first sign-in', async () => {
    apple.verifyIdentityToken.mockResolvedValue(claims());
    mockDb([['INSERT INTO users', { rows: [{ id: 'new', email: 'jane@example.com', is_profile_complete: false }] }]]);

    const res = await appleAuth({ ...base, fullName: { givenName: 'Jane', familyName: 'Doe' } });

    expect(res.user).toMatchObject({ id: 'new', isNewUser: true, isProfileComplete: false });
    const profile = sqlCalls().find((c) => c.sql.includes('INSERT INTO profiles'));
    expect(profile.params).toEqual(['new', 'Jane Doe']);
  });

  it('works with a Hide My Email relay address', async () => {
    apple.verifyIdentityToken.mockResolvedValue(claims({ email: 'abc123@privaterelay.appleid.com' }));
    mockDb([['INSERT INTO users', { rows: [{ id: 'relay', email: 'abc123@privaterelay.appleid.com' }] }]]);

    const res = await appleAuth(base);
    expect(res.user.email).toBe('abc123@privaterelay.appleid.com');
  });

  it('links Apple to an existing verified account (e.g. made with Google) without touching its password', async () => {
    apple.verifyIdentityToken.mockResolvedValue(claims());
    mockDb([['WHERE email_normalized = $1', { rows: [{ id: 'g1', email: 'jane@example.com', is_verified: true, password_hash: 'hash' }] }]]);

    const res = await appleAuth(base);

    expect(res.user.id).toBe('g1');
    const calls = sqlCalls();
    expect(calls.find((c) => c.sql.includes('SET apple_id')).params).toEqual([APPLE_ID, 'g1']);
    expect(calls.some((c) => c.sql.includes('password_hash = NULL'))).toBe(false);
  });

  it('claims an unverified account safely: verifies it and wipes the unproven password', async () => {
    apple.verifyIdentityToken.mockResolvedValue(claims());
    mockDb([['WHERE email_normalized = $1', { rows: [{ id: 'squat', email: 'jane@example.com', is_verified: false, password_hash: 'attacker' }] }]]);

    await appleAuth(base);

    const calls = sqlCalls();
    expect(calls.find((c) => c.sql.includes('password_hash = NULL')).params).toEqual(['squat']);
    expect(calls.some((c) => c.sql.includes('DELETE FROM refresh_tokens WHERE user_id'))).toBe(true);
  });

  it('does not overwrite a different apple_id already on the account', async () => {
    apple.verifyIdentityToken.mockResolvedValue(claims());
    mockDb([['WHERE email_normalized = $1', { rows: [{ id: 'u2', is_verified: true, apple_id: 'other.apple' }] }]]);

    await appleAuth(base);
    expect(sqlCalls().some((c) => c.sql.includes('SET apple_id'))).toBe(false);
  });

  it.each([
    ['no email at all', { sub: APPLE_ID }],
    ['an unverified email', claims({ email_verified: 'false' })],
  ])('rejects a first sign-in with %s', async (_label, payload) => {
    apple.verifyIdentityToken.mockResolvedValue(payload);
    mockDb([]);
    await expect(appleAuth(base)).rejects.toMatchObject({ statusCode: 400, error: 'NoEmail' });
  });

  it('recovers when a double-tap already created the account', async () => {
    apple.verifyIdentityToken.mockResolvedValue(claims());
    let emailLookups = 0;
    mockDb([
      ['INSERT INTO users', Object.assign(new Error('duplicate'), { code: '23505' })],
      ['WHERE email_normalized = $1', () => (++emailLookups === 1
        ? { rows: [] }
        : { rows: [{ id: 'dup', email: 'jane@example.com', is_verified: true }] })],
    ]);

    const res = await appleAuth(base);
    expect(res.user).toMatchObject({ id: 'dup', isNewUser: false });
  });

  it('stores the Apple refresh token encrypted when the code exchange succeeds', async () => {
    apple.verifyIdentityToken.mockResolvedValue({ sub: APPLE_ID });
    apple.exchangeAuthorizationCode.mockResolvedValue('apple-refresh');
    mockDb([['WHERE apple_id = $1 AND deleted_at IS NULL', { rows: [{ id: 'u1' }] }]]);

    await appleAuth(base);
    const store = sqlCalls().find((c) => c.sql.includes('SET apple_refresh_token'));
    expect(store.params).toEqual(['enc:apple-refresh', 'u1']);
  });

  it('propagates token rejection (bad signature, nonce, audience) as 401', async () => {
    apple.verifyIdentityToken.mockRejectedValue(Object.assign(new Error('bad'), { statusCode: 401 }));
    await expect(appleAuth(base)).rejects.toMatchObject({ statusCode: 401 });
    expect(db.query).not.toHaveBeenCalled();
  });
});
