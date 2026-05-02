const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Sliding-window in-process request counter (resets on redeploy).
 * Used by GET /admin/health for load signal.
 */
const _timestamps = [];

function recordRequest(_req, _res, next) {
  _timestamps.push(Date.now());
  next();
}

function getCount30m() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  while (_timestamps.length && _timestamps[0] < cutoff) _timestamps.shift();
  return _timestamps.length;
}

/**
 * Must run after authenticateJWT.
 * Verifies the authenticated user has is_platform_admin = true in DB.
 */
async function requirePlatformAdmin(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT is_platform_admin FROM users WHERE id = $1',
      [req.user.id],
    );
    if (!rows.length || !rows[0].is_platform_admin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Platform admin access required',
        statusCode: 403,
      });
    }
    next();
  } catch (err) {
    logger.error('requirePlatformAdmin DB error', { error: err.message });
    next(err);
  }
}

module.exports = { recordRequest, getCount30m, requirePlatformAdmin };
