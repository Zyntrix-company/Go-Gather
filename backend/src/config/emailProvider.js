/**
 * Active transactional email provider.
 *
 * Toggle here in code — not via environment variables.
 *   'brevo' — Brevo Transactional API (https://www.brevo.com)
 *   'ses'   — AWS SES (legacy; kept for rollback)
 */
const EMAIL_PROVIDER = 'brevo';

module.exports = { EMAIL_PROVIDER };
