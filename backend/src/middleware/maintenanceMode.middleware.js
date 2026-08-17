const { isMaintenanceActive, getMaintenanceInfo } = require('../modules/admin/maintenance.service');

// /admin and /auth stay open so a platform admin can always sign in (or stay
// signed in) and flip the switch back off; /health stays open so the
// infra/orchestrator health check doesn't start killing the container.
const EXEMPT_PREFIXES = ['/admin', '/auth', '/.well-known', '/health'];

function isExempt(path) {
  return EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Global gate for the admin "emergency stop" kill switch (system_settings.maintenance_mode).
 * Must be mounted after CORS/body-parsing and before the API routes.
 */
function maintenanceGate(req, res, next) {
  if (isExempt(req.path) || !isMaintenanceActive()) return next();
  const { reason } = getMaintenanceInfo();
  res.status(503).json({
    error: 'ServiceUnavailable',
    message: 'GatherrGo is temporarily down for maintenance. Please try again shortly.',
    statusCode: 503,
    maintenance: true,
    ...(reason ? { reason } : {}),
  });
}

module.exports = { maintenanceGate };
