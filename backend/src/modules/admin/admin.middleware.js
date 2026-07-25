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
 * Kept as the strict full-access gate — used directly on routes that only
 * full admins may reach (Users, Storage, Trips & Events, Feedback, Legal,
 * Security, Health, AI Usage).
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
    req.adminRole = 'full';
    next();
  } catch (err) {
    logger.error('requirePlatformAdmin DB error', { error: err.message });
    next(err);
  }
}

/**
 * Must run after authenticateJWT.
 * Allows either full platform admins or content admins (Business/Employee
 * access — Insights view, Blogs, Promo Video, Deals) into the /admin router,
 * and attaches req.adminRole so individual routes can enforce full-only access.
 */
async function requireAnyAdmin(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT is_platform_admin, is_content_admin FROM users WHERE id = $1',
      [req.user.id],
    );
    const row = rows[0];
    if (!row || (!row.is_platform_admin && !row.is_content_admin)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin panel access required',
        statusCode: 403,
      });
    }
    req.adminRole = row.is_platform_admin ? 'full' : 'content';
    next();
  } catch (err) {
    logger.error('requireAnyAdmin DB error', { error: err.message });
    next(err);
  }
}

/** Must run after requireAnyAdmin. Rejects content admins from full-only routes. */
function requireFullAdminRole(req, res, next) {
  if (req.adminRole !== 'full') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Full admin access required',
      statusCode: 403,
    });
  }
  next();
}

module.exports = {
  recordRequest, getCount30m,
  requirePlatformAdmin, requireAnyAdmin, requireFullAdminRole,
};
