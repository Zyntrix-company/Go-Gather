const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

/**
 * Generate an access token (15-min expiry).
 * @param {{ id: string, email: string }} payload
 * @returns {string}
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    { id: payload.id, email: payload.email },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn },
  );
};

/**
 * Generate a refresh token (30-day expiry).
 * @param {{ id: string }} payload
 * @returns {string}
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    { id: payload.id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn },
  );
};

/**
 * Generate a password-reset token (15-min expiry).
 * @param {{ id: string, email: string }} payload
 * @returns {string}
 */
const generateResetToken = (payload) => {
  return jwt.sign(
    { id: payload.id, email: payload.email, purpose: 'password-reset' },
    config.jwt.secret,
    { expiresIn: config.jwt.resetExpiresIn },
  );
};

/**
 * Verify an access token.
 * @param {string} token
 * @returns {object}
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {object}
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

/**
 * Verify a password-reset token.
 * @param {string} token
 * @returns {object}
 */
const verifyResetToken = (token) => {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (decoded.purpose !== 'password-reset') {
    throw new Error('Invalid token purpose');
  }
  return decoded;
};

/**
 * Hash a token string with SHA-256 for safe DB storage.
 * @param {string} token
 * @returns {string}
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  hashToken,
};
