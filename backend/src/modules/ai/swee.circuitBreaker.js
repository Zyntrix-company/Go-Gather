/**
 * In-memory circuit breaker for Gemini API failures (429/503 bursts).
 * Opens after repeated failures; fast-fails chat while cooling down.
 */

const logger = require('../../utils/logger');

const FAILURE_THRESHOLD = parseInt(process.env.SWEE_CIRCUIT_FAILURE_THRESHOLD, 10) || 5;
const FAILURE_WINDOW_MS = parseInt(process.env.SWEE_CIRCUIT_FAILURE_WINDOW_MS, 10) || 60_000;
const COOLDOWN_MS = parseInt(process.env.SWEE_CIRCUIT_COOLDOWN_MS, 10) || 90_000;

let state = 'closed';
let openedAt = 0;
const failureTimestamps = [];

function pruneFailures(now) {
  while (failureTimestamps.length > 0 && now - failureTimestamps[0] > FAILURE_WINDOW_MS) {
    failureTimestamps.shift();
  }
}

function isOpen() {
  const now = Date.now();
  if (state === 'open' && now - openedAt >= COOLDOWN_MS) {
    state = 'half-open';
    return false;
  }
  return state === 'open';
}

function recordFailure() {
  const now = Date.now();

  if (state === 'half-open') {
    state = 'open';
    openedAt = now;
    logger.warn('Swee Gemini circuit_reopened', { cooldownSec: COOLDOWN_MS / 1000 });
    return;
  }

  failureTimestamps.push(now);
  pruneFailures(now);

  if (failureTimestamps.length >= FAILURE_THRESHOLD && state !== 'open') {
    state = 'open';
    openedAt = now;
    logger.warn('Swee Gemini circuit_open', {
      failures: failureTimestamps.length,
      windowSec: FAILURE_WINDOW_MS / 1000,
      cooldownSec: COOLDOWN_MS / 1000,
    });
  }
}

function recordSuccess() {
  failureTimestamps.length = 0;
  if (state !== 'closed') {
    logger.info('Swee Gemini circuit_closed');
  }
  state = 'closed';
}

function getStatus() {
  pruneFailures(Date.now());
  return {
    state,
    recentFailures: failureTimestamps.length,
    failureThreshold: FAILURE_THRESHOLD,
    cooldownMs: COOLDOWN_MS,
    open: isOpen(),
  };
}

function _resetForTests() {
  state = 'closed';
  openedAt = 0;
  failureTimestamps.length = 0;
}

module.exports = {
  isOpen,
  recordFailure,
  recordSuccess,
  getStatus,
  _resetForTests,
};
