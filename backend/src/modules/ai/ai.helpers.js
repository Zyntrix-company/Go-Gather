/**
 * Pure Swee AI helpers — testable without Gemini or DB.
 */

const { EVENT_TYPE_MAP, APP_EVENT_TYPES } = require('./swee.config');

// ─── Action block extraction ───────────────────────────────────────────────────

function parseActionBlock(rawText) {
  const marker = '###ACTION';
  const idx = rawText.lastIndexOf(marker);
  if (idx === -1) return { reply: rawText.trim(), pendingAction: null };

  const visibleReply = rawText.slice(0, idx).trim();
  const jsonStr = rawText.slice(idx + marker.length).trim();

  try {
    const action = JSON.parse(jsonStr);
    const meaningful = action.readyToCreate || action.intent === 'identify_update';
    return {
      reply: visibleReply,
      pendingAction: meaningful ? action : null,
    };
  } catch {
    return { reply: visibleReply, pendingAction: null };
  }
}

// ─── Trip / event helpers ──────────────────────────────────────────────────────

function generateTripName(destination, startDate) {
  const dest = (destination || 'Trip').split(',')[0].trim();
  let suffix = '';
  if (startDate) {
    try {
      const d = new Date(startDate);
      suffix = ` ${d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
    } catch { /* ignore */ }
  }
  const raw = `${dest}${suffix}`;
  return raw.length > 20 ? raw.slice(0, 20) : raw;
}

function resolveEventType(userLabel) {
  if (!userLabel) return 'Other';
  const clean = userLabel.toLowerCase().trim();
  if (EVENT_TYPE_MAP[clean]) return EVENT_TYPE_MAP[clean];
  const match = APP_EVENT_TYPES.find((t) => t.toLowerCase() === clean);
  return match || 'Other';
}

function parseActivityTime(rawTime) {
  if (!rawTime) return null;
  if (typeof rawTime === 'object' && rawTime !== null) {
    const h = parseInt(rawTime.hour, 10);
    const m = parseInt(rawTime.minute ?? 0, 10);
    if (!isNaN(h)) return { hour: h, minute: isNaN(m) ? 0 : m };
  }
  if (typeof rawTime === 'string') {
    const match = rawTime.match(/^(\d{1,2}):(\d{2})$/);
    if (match) return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
  }
  if (typeof rawTime === 'number') {
    if (rawTime < 24) return { hour: rawTime, minute: 0 };
    const h = Math.floor(rawTime / 100);
    const m = rawTime % 100;
    if (h < 24 && m < 60) return { hour: h, minute: m };
  }
  return null;
}

function parseEventTime(rawTime) {
  if (!rawTime) return null;
  if (typeof rawTime === 'string') {
    const match = rawTime.trim().match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
    }
  }
  const parsed = parseActivityTime(rawTime);
  if (parsed) {
    return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
  }
  return null;
}

// ─── Execute validation ────────────────────────────────────────────────────────

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function requireIsoDate(value, label) {
  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw badRequest(`${label} is required (YYYY-MM-DD)`);
  }
  const d = new Date(`${value.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw badRequest(`${label} must be a valid date`);
  return value.trim();
}

function requireNonEmptyString(value, label) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) throw badRequest(`${label} is required`);
  return v;
}

// ─── Personalization ─────────────────────────────────────────────────────────

/** Rough tier from average expense amount (mixed currencies — indicative only). */
function inferBudgetTier(avgAmount) {
  const avg = parseFloat(avgAmount);
  if (!avg || avg <= 0) return null;
  if (avg < 30) return 'Saver';
  if (avg < 100) return 'Comfort';
  if (avg < 300) return 'Premium';
  return 'Luxury';
}

// ─── Planning metadata ─────────────────────────────────────────────────────────

const PLANNING_META_KEYS = [
  'groupType', 'travelFocus', 'budgetTier', 'currency',
  'adults', 'kids', 'seniors', 'notes', 'budget', 'numPeople', 'activities',
  'eventType', 'eventTime', 'description',
];

function buildPlanningMetadata(draft = {}) {
  const meta = {
    source: 'swee',
    updatedAt: new Date().toISOString(),
  };
  for (const key of PLANNING_META_KEYS) {
    const val = draft[key];
    if (val !== undefined && val !== null && val !== '') {
      meta[key] = val;
    }
  }
  return meta;
}

module.exports = {
  parseActionBlock,
  generateTripName,
  resolveEventType,
  parseActivityTime,
  parseEventTime,
  badRequest,
  requireIsoDate,
  requireNonEmptyString,
  inferBudgetTier,
  buildPlanningMetadata,
};
