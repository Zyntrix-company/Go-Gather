/**
 * Sign in with Apple — identity-token verification plus the refresh-token
 * exchange/revocation Apple requires for account deletion.
 * https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api
 */
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');

const APPLE_ISSUER = 'https://appleid.apple.com';
const KEYS_URL = `${APPLE_ISSUER}/auth/keys`;
const KEYS_TTL_MS = 60 * 60 * 1000;

let cachedKeys = null;
let cachedAt = 0;

const fetchKeys = async (force = false) => {
  if (!force && cachedKeys && Date.now() - cachedAt < KEYS_TTL_MS) return cachedKeys;
  try {
    const { data } = await axios.get(KEYS_URL, { timeout: 5000 });
    cachedKeys = data.keys;
    cachedAt = Date.now();
    return cachedKeys;
  } catch (err) {
    // Serve stale keys over failing every Apple sign-in during an Apple outage
    if (cachedKeys) return cachedKeys;
    logger.error('Could not fetch Apple sign-in keys', { error: err.message });
    const e = new Error('Apple sign in is temporarily unavailable. Please try again in a moment.');
    e.statusCode = 503;
    e.error = 'AppleUnavailable';
    throw e;
  }
};

const invalidToken = (message) => {
  const err = new Error(message);
  err.statusCode = 401;
  err.error = 'InvalidAppleToken';
  return err;
};

/**
 * Verify an identity token from the iOS app and return its claims.
 * `rawNonce` is the unhashed nonce the app generated; the token carries its SHA-256.
 */
const verifyIdentityToken = async (identityToken, rawNonce) => {
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded?.header?.kid) throw invalidToken('Malformed Apple identity token');

  let jwk = (await fetchKeys()).find((k) => k.kid === decoded.header.kid);
  if (!jwk) {
    // Apple rotates keys; refetch once before rejecting.
    jwk = (await fetchKeys(true)).find((k) => k.kid === decoded.header.kid);
  }
  if (!jwk) throw invalidToken('Unknown Apple signing key');

  let payload;
  try {
    payload = jwt.verify(identityToken, crypto.createPublicKey({ key: jwk, format: 'jwk' }), {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience: config.apple.bundleId,
    });
  } catch (err) {
    throw invalidToken(`Apple identity token rejected: ${err.message}`);
  }

  if (rawNonce) {
    const expected = crypto.createHash('sha256').update(rawNonce).digest('hex');
    if (payload.nonce !== expected) throw invalidToken('Apple identity token nonce mismatch');
  }

  return payload;
};

const isRevocationConfigured = () =>
  Boolean(config.apple.teamId && config.apple.keyId && config.apple.privateKey);

/** Short-lived ES256 client secret signed with the Sign in with Apple key (.p8). */
const clientSecret = () =>
  jwt.sign({}, config.apple.privateKey, {
    algorithm: 'ES256',
    keyid: config.apple.keyId,
    issuer: config.apple.teamId,
    subject: config.apple.bundleId,
    audience: APPLE_ISSUER,
    expiresIn: '5m',
  });

/**
 * Trade the one-time authorization code for a refresh token so the account can
 * later be revoked. Returns null when the .p8 key isn't configured or Apple refuses.
 */
const exchangeAuthorizationCode = async (authorizationCode) => {
  if (!authorizationCode || !isRevocationConfigured()) return null;
  try {
    const { data } = await axios.post(
      `${APPLE_ISSUER}/auth/token`,
      new URLSearchParams({
        client_id: config.apple.bundleId,
        client_secret: clientSecret(),
        code: authorizationCode,
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 },
    );
    return data.refresh_token || null;
  } catch (err) {
    logger.warn('Apple authorization code exchange failed', {
      error: err.response?.data?.error || err.message,
    });
    return null;
  }
};

/** Revoke the user's Apple grant — required when they delete their account. */
const revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return;
  if (!isRevocationConfigured()) {
    logger.warn('Apple revocation skipped — APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY not set');
    return;
  }
  await axios.post(
    `${APPLE_ISSUER}/auth/revoke`,
    new URLSearchParams({
      client_id: config.apple.bundleId,
      client_secret: clientSecret(),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 },
  );
};

module.exports = { verifyIdentityToken, exchangeAuthorizationCode, revokeRefreshToken };
