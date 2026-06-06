const { normalizeEmail, isEmail } = require('validator');

/**
 * Canonical normalization for auth (signup, login, OAuth lookup, OTP flows).
 * Aligns Gmail dot/subaddress aliases, Outlook/Yahoo subaddresses, etc.
 */
const AUTH_EMAIL_OPTIONS = {
  all_lowercase: true,
  gmail_lowercase: true,
  gmail_remove_dots: true,
  gmail_remove_subaddress: true,
  gmail_convert_googlemaildotcom: true,
  outlookdotcom_lowercase: true,
  outlookdotcom_remove_subaddress: true,
  yahoo_lowercase: true,
  yahoo_remove_subaddress: true,
  icloud_lowercase: true,
  icloud_remove_subaddress: true,
};

/**
 * @param {string | null | undefined} email
 * @returns {string | null} Canonical email, or null if input is not a valid address.
 */
const normalizeAuthEmail = (email) => {
  if (email == null || typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!trimmed || !isEmail(trimmed)) return null;
  return normalizeEmail(trimmed, AUTH_EMAIL_OPTIONS) || null;
};

module.exports = {
  AUTH_EMAIL_OPTIONS,
  normalizeAuthEmail,
};
