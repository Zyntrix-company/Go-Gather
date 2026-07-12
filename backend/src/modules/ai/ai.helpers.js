/**
 * Pure Swee AI helpers — testable without Gemini or DB.
 */

const { EVENT_TYPE_MAP, APP_EVENT_TYPES, APP_BRAND_NAME } = require('./swee.config');

const VALID_INTENTS = new Set([
  'none',
  'create_trip',
  'create_event',
  'update_trip',
  'update_event',
  'identify_update',
  'add_note',
]);

const ACTION_FALLBACK_REPLY = 'I had a hiccup processing that — could you say it again in a few words?';

function stripHtmlTableArtifacts(text) {
  return text
    .replace(/<\/?t[rhd][^>]*>/gi, '')
    .replace(/<\/?table[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?tbody[^>]*>/gi, '')
    .replace(/<\/?thead[^>]*>/gi, '');
}

function fixBrandName(text) {
  return text.replace(/GatherGo/gi, APP_BRAND_NAME);
}

function isTableLine(line) {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isSeparatorLine(line) {
  return /^\|[\s\-|:]+\|$/.test(line.trim());
}

function parseTableCells(line) {
  const parts = line.trim().split('|');
  return parts.slice(1, parts.length - 1).map((c) => c.trim());
}

function normalizeTableBlock(lines) {
  const dataLines = lines.filter((l) => !isSeparatorLine(l));
  if (dataLines.length === 0) return ['| Field | Details |', '| --- | --- |'];

  const rows = dataLines.map(parseTableCells);
  const firstLabel = (rows[0]?.[0] || '').toLowerCase();
  const isConfirmationTable = firstLabel === 'field'
    || rows.some((r) => /^(trip name|event name|destination|start date|end date|date|type|location)$/i.test(r[0] || ''));

  if (!isConfirmationTable) {
    const header = `| ${rows[0].join(' | ')} |`;
    const sep = `| ${rows[0].map(() => '---').join(' | ')} |`;
    const body = rows.slice(1).map((r) => `| ${r.join(' | ')} |`);
    return [header, sep, ...body];
  }

  const out = ['| Field | Details |', '| --- | --- |'];
  const startIdx = firstLabel === 'field' ? 1 : 0;
  for (let i = startIdx; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length >= 2) {
      out.push(`| ${cells[0]} | ${cells.slice(1).join(' · ')} |`);
    } else if (cells.length === 1 && cells[0]) {
      out.push(`| ${cells[0]} | |`);
    }
  }
  return out;
}

function normalizeMarkdownTables(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableLine(lines[i]) || isSeparatorLine(lines[i])) {
      const block = [];
      while (i < lines.length && (isTableLine(lines[i]) || isSeparatorLine(lines[i]))) {
        block.push(lines[i]);
        i++;
      }
      out.push(...normalizeTableBlock(block));
      continue;
    }
    out.push(lines[i]);
    i++;
  }
  return out.join('\n');
}

/** Normalize Swee reply text before parsing ACTION / sending to client. */
function normalizeSweeReply(rawText) {
  if (!rawText || typeof rawText !== 'string') return rawText;
  let text = stripHtmlTableArtifacts(rawText);
  text = fixBrandName(text);
  text = normalizeMarkdownTables(text);
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function validatePendingAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return { valid: false, reason: 'not_object' };
  }
  if (!VALID_INTENTS.has(action.intent)) {
    return { valid: false, reason: 'invalid_intent' };
  }
  if (typeof action.readyToCreate !== 'boolean') {
    return { valid: false, reason: 'missing_readyToCreate' };
  }
  if (action.draft != null && (typeof action.draft !== 'object' || Array.isArray(action.draft))) {
    return { valid: false, reason: 'invalid_draft' };
  }
  if (action.readyToCreate && action.intent === 'none') {
    return { valid: false, reason: 'ready_none_intent' };
  }
  if (action.readyToCreate && ['create_trip', 'create_event'].includes(action.intent)) {
    const draft = action.draft || {};
    if (action.intent === 'create_trip' && !draft.destination && !draft.name) {
      return { valid: false, reason: 'create_trip_missing_draft' };
    }
    if (action.intent === 'create_event' && !draft.name && !draft.eventDate) {
      return { valid: false, reason: 'create_event_missing_draft' };
    }
  }
  if (action.showForm != null && action.showForm !== 'trip' && action.showForm !== 'event') {
    return { valid: false, reason: 'invalid_showForm' };
  }
  return { valid: true };
}

function parseActionBlock(rawText, { logInvalid = false, logger = null } = {}) {
  const normalized = normalizeSweeReply(rawText);
  const marker = '###ACTION';
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return { reply: normalized.trim(), pendingAction: null };

  let visibleReply = normalized.slice(0, idx).trim();
  const jsonStr = normalized.slice(idx + marker.length).trim();
  const hadMarker = true;

  try {
    const action = JSON.parse(jsonStr);
    const validation = validatePendingAction(action);
    if (!validation.valid) {
      if (logInvalid && logger) {
        logger.warn('Swee invalid ACTION block', {
          reason: validation.reason,
          intent: action?.intent,
          preview: jsonStr.slice(0, 200),
        });
      }
      if (!visibleReply) visibleReply = ACTION_FALLBACK_REPLY;
      return {
        reply: visibleReply,
        pendingAction: null,
        actionParseError: validation.reason,
        hadActionMarker: hadMarker,
      };
    }

    const meaningful = action.readyToCreate
      || action.intent === 'identify_update'
      || action.showForm === 'trip'
      || action.showForm === 'event';
    return {
      reply: visibleReply || (meaningful ? ACTION_FALLBACK_REPLY : ''),
      pendingAction: meaningful ? action : null,
      hadActionMarker: hadMarker,
    };
  } catch (parseErr) {
    if (logInvalid && logger) {
      logger.warn('Swee ACTION JSON parse failed', {
        error: parseErr.message,
        preview: jsonStr.slice(0, 200),
      });
    }
    if (!visibleReply) visibleReply = ACTION_FALLBACK_REPLY;
    return {
      reply: visibleReply,
      pendingAction: null,
      actionParseError: 'json_parse_failed',
      hadActionMarker: hadMarker,
    };
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
  VALID_INTENTS,
  ACTION_FALLBACK_REPLY,
  normalizeSweeReply,
  validatePendingAction,
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
