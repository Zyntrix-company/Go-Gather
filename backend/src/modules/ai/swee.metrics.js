/**
 * Rolling-window Swee chat metrics + high error-rate alerts (15 min window).
 */

const logger = require('../../utils/logger');

const WINDOW_MS = parseInt(process.env.SWEE_METRICS_WINDOW_MS, 10) || 15 * 60 * 1000;
const ALERT_ERROR_RATE = parseFloat(process.env.SWEE_ALERT_ERROR_RATE) || 0.05;
const ALERT_MIN_REQUESTS = parseInt(process.env.SWEE_ALERT_MIN_REQUESTS, 10) || 10;
const ALERT_COOLDOWN_MS = parseInt(process.env.SWEE_ALERT_COOLDOWN_MS, 10) || 5 * 60 * 1000;

/** @type {{ ts: number, ok: boolean, code?: string }[]} */
const events = [];
let lastAlertAt = 0;

function prune(now = Date.now()) {
  while (events.length > 0 && now - events[0].ts > WINDOW_MS) {
    events.shift();
  }
}

function recordChatResult(success, errorCode = null) {
  const now = Date.now();
  events.push({ ts: now, ok: success, code: errorCode || undefined });
  prune(now);
  maybeAlert(now);
}

function maybeAlert(now) {
  if (events.length < ALERT_MIN_REQUESTS) return;
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return;

  const failures = events.filter((e) => !e.ok);
  const errorRate = failures.length / events.length;

  if (errorRate <= ALERT_ERROR_RATE) return;

  lastAlertAt = now;
  const errorCodes = failures.reduce((acc, e) => {
    const key = e.code || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  logger.error('ALERT swee.chat.error_rate_high', {
    metric: 'swee.chat.error_rate',
    errorRate: Number(errorRate.toFixed(4)),
    errorPercent: Number((errorRate * 100).toFixed(1)),
    totalRequests: events.length,
    failedRequests: failures.length,
    windowMinutes: WINDOW_MS / 60_000,
    thresholdPercent: ALERT_ERROR_RATE * 100,
    errorCodes,
  });
}

function getSnapshot() {
  prune();
  const total = events.length;
  const failed = events.filter((e) => !e.ok).length;
  return {
    windowMinutes: WINDOW_MS / 60_000,
    totalRequests: total,
    failedRequests: failed,
    errorRate: total > 0 ? Number((failed / total).toFixed(4)) : 0,
    alertThreshold: ALERT_ERROR_RATE,
  };
}

function _resetForTests() {
  events.length = 0;
  lastAlertAt = 0;
}

module.exports = {
  recordChatResult,
  getSnapshot,
  _resetForTests,
};
