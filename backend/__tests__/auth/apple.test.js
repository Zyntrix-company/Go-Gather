jest.mock('axios');

const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const apple = require('../../src/modules/auth/apple');

const KID = 'test-kid';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const RAW_NONCE = 'raw-nonce-123';
const hashed = (s) => crypto.createHash('sha256').update(s).digest('hex');

const sign = (claims = {}, opts = {}) => jwt.sign(
  { sub: 'apple-user-1', email: 'me@privaterelay.appleid.com', email_verified: 'true', nonce: hashed(RAW_NONCE), ...claims },
  privateKey,
  { algorithm: 'RS256', keyid: KID, issuer: 'https://appleid.apple.com', audience: 'com.gathergo.app', expiresIn: '5m', ...opts },
);

describe('apple.verifyIdentityToken', () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({ data: { keys: [jwk] } });
  });

  it('accepts a valid token and returns its claims', async () => {
    const payload = await apple.verifyIdentityToken(sign(), RAW_NONCE);
    expect(payload.sub).toBe('apple-user-1');
  });

  it('rejects a nonce that does not match', async () => {
    await expect(apple.verifyIdentityToken(sign(), 'other-nonce'))
      .rejects.toMatchObject({ statusCode: 401, error: 'InvalidAppleToken' });
  });

  it('rejects a token issued for another app', async () => {
    await expect(apple.verifyIdentityToken(sign({}, { audience: 'com.someone.else' }), RAW_NONCE))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token signed by an unknown key', async () => {
    const forged = jwt.sign({ sub: 'x' }, privateKey, { algorithm: 'RS256', keyid: 'nope' });
    await expect(apple.verifyIdentityToken(forged, RAW_NONCE)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an expired token', async () => {
    const expired = sign({ iat: Math.floor(Date.now() / 1000) - 600 }, { expiresIn: '1s' });
    await expect(apple.verifyIdentityToken(expired, RAW_NONCE)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('apple refresh-token handling without a configured .p8 key', () => {
  it('skips the code exchange and revocation instead of failing', async () => {
    await expect(apple.exchangeAuthorizationCode('code')).resolves.toBeNull();
    await expect(apple.revokeRefreshToken('token')).resolves.toBeUndefined();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
