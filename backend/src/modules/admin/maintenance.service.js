const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * In-process cache of system_settings, refreshed on a timer so the hot-path
 * maintenanceGate middleware (backend/src/middleware/maintenanceMode.middleware.js)
 * never touches the DB. DB stays the source of truth so the flag survives
 * restarts and (within one refresh interval) applies across all instances.
 */
const REFRESH_INTERVAL_MS = 5000;
let cache = { active: false, reason: null };

async function refreshCache() {
  try {
    const { rows } = await query('SELECT maintenance_mode, reason FROM system_settings WHERE id = 1');
    if (rows.length) cache = { active: rows[0].maintenance_mode, reason: rows[0].reason };
  } catch (err) {
    logger.error('Failed to refresh maintenance mode cache', { error: err.message });
  }
}

refreshCache();
setInterval(refreshCache, REFRESH_INTERVAL_MS).unref();

function isMaintenanceActive() {
  return cache.active;
}

function getMaintenanceInfo() {
  return { ...cache };
}

/** Flips the kill switch. Persists to DB first, then updates the local cache immediately (no need to wait for the next refresh tick). */
async function setMaintenanceMode(active, { userId, reason } = {}) {
  const { rows } = await query(
    `INSERT INTO system_settings (id, maintenance_mode, reason, enabled_by, enabled_at, updated_at)
     VALUES (1, $1, $2, $3, CASE WHEN $1 THEN NOW() ELSE NULL END, NOW())
     ON CONFLICT (id) DO UPDATE SET
       maintenance_mode = $1,
       reason = $2,
       enabled_by = CASE WHEN $1 THEN $3 ELSE system_settings.enabled_by END,
       enabled_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
       updated_at = NOW()
     RETURNING maintenance_mode, reason, enabled_at`,
    [active, reason ?? null, userId ?? null],
  );
  const r = rows[0];
  cache = { active: r.maintenance_mode, reason: r.reason };
  return { active: r.maintenance_mode, reason: r.reason, enabledAt: r.enabled_at };
}

module.exports = { isMaintenanceActive, getMaintenanceInfo, setMaintenanceMode };
