const { normalizeEmail, isEmail } = require('validator');

/**
 * Canonical normalization for duplicate detection (Gmail dots, +tags, etc.).
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
 * Lowercase + trim only — preserves dots/subaddresses as the user typed them.
 * Used for storage and outbound email delivery.
 * @param {string | null | undefined} email
 * @returns {string | null}
 */
const sanitizeAuthEmail = (email) => {
  if (email == null || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !isEmail(trimmed)) return null;
  return trimmed;
};

/**
 * Canonical form for duplicate detection and login lookup.
 * @param {string | null | undefined} email
 * @returns {string | null}
 */
const normalizeAuthEmail = (email) => {
  if (email == null || typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!trimmed || !isEmail(trimmed)) return null;
  return normalizeEmail(trimmed, AUTH_EMAIL_OPTIONS) || null;
};

/**
 * @param {string | null | undefined} email
 * @returns {{ display: string, normalized: string } | null}
 */
const resolveAuthEmail = (email) => {
  const display = sanitizeAuthEmail(email);
  const normalized = normalizeAuthEmail(email);
  if (!display || !normalized) return null;
  return { display, normalized };
};

// Deleted accounts keep a placeholder address on this unroutable domain.
const DELETED_EMAIL_DOMAIN = 'removed.gatherrgo.local';

module.exports = {
  DELETED_EMAIL_DOMAIN,
  AUTH_EMAIL_OPTIONS,
  sanitizeAuthEmail,
  normalizeAuthEmail,
  resolveAuthEmail,
};
