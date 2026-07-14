/**
 * Swee AI Service — powered by Google Gemini 2.5 Flash
 * April 2026 Configuration Guide — full implementation.
 */

const { query: db } = require('../../config/database');
const config = require('../../config');
const logger = require('../../utils/logger');
const {
  loadUserContext,
  buildSweetSystemPrompt,
} = require('./swee.config');
const {
  parseActionBlock,
  generateTripName,
  resolveEventType,
  parseActivityTime,
  parseEventTime,
  badRequest,
  requireIsoDate,
  requireNonEmptyString,
  buildPlanningMetadata,
} = require('./ai.helpers');
const conversationsService = require('./conversations.service');
const circuitBreaker = require('./swee.circuitBreaker');
const { geminiRateLimitMessage, serviceBusyMessage } = require('./swee.messages');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// 10 messages = ~5 back-and-forth exchanges (one user + one assistant each)
const MAX_HISTORY_MESSAGES = 10;

// ─── Lazy Gemini client ────────────────────────────────────────────────────────

let _geminiGenAI = null;

function getGeminiModel(systemPrompt) {
  if (!_geminiGenAI) {
    if (!config.gemini?.apiKey) {
      const err = new Error('Gemini API key not configured. Set GEMINI_API_KEY in .env');
      err.statusCode = 503;
      throw err;
    }
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    _geminiGenAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return _geminiGenAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trimHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES);
}

function toGeminiHistory(history) {
  const converted = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  while (converted.length > 0 && converted[0].role === 'model') {
    converted.shift();
  }

  const cleaned = [];
  for (const turn of converted) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === turn.role) {
      last.parts[0].text += '\n' + turn.parts[0].text;
    } else {
      cleaned.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
    }
  }
  return cleaned;
}

// ─── Find user trip by name / tripId ─────────────────────────────────────────

async function findUserTrip(userId, { tripId, targetTripName }) {
  let sql;
  let params;

  if (tripId) {
    sql = `SELECT t.id, t.name, t.start_date, t.end_date, t.location_name
           FROM trips t
           JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
           WHERE t.id = $2 AND t.archived_at IS NULL`;
    params = [userId, tripId];
  } else if (targetTripName) {
    sql = `SELECT t.id, t.name, t.start_date, t.end_date, t.location_name
           FROM trips t
           JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
           WHERE t.archived_at IS NULL
             AND (
               LOWER(t.name) LIKE $2
               OR LOWER(t.location_name) LIKE $2
             )
           ORDER BY t.start_date DESC
           LIMIT 5`;
    params = [userId, `%${targetTripName.toLowerCase()}%`];
  } else {
    return { trips: [] };
  }

  const result = await db(sql, params);
  return { trips: result.rows };
}

async function findUserEvent(userId, { eventId, targetEventName }) {
  let sql;
  let params;

  if (eventId) {
    sql = `SELECT e.id, e.name, e.event_date, e.event_type, e.location_name
           FROM events e
           JOIN event_members em ON em.event_id = e.id AND em.user_id = $1
           WHERE e.id = $2 AND e.archived_at IS NULL`;
    params = [userId, eventId];
  } else if (targetEventName) {
    sql = `SELECT e.id, e.name, e.event_date, e.event_type, e.location_name
           FROM events e
           JOIN event_members em ON em.event_id = e.id AND em.user_id = $1
           WHERE e.archived_at IS NULL
             AND LOWER(e.name) LIKE $2
           ORDER BY e.event_date DESC
           LIMIT 5`;
    params = [userId, `%${targetEventName.toLowerCase()}%`];
  } else {
    return { events: [] };
  }

  const result = await db(sql, params);
  return { events: result.rows };
}

// ─── Planning note writer ─────────────────────────────────────────────────────

async function writePlanningNote(parentType, parentId, userId, planningData) {
  const sharedNotes = require('../shared/notes/notes.service');
  try {
    const lines = [];
    if (planningData.adults != null || planningData.kids != null || planningData.seniors != null) {
      const parts = [];
      if (planningData.adults) parts.push(`${planningData.adults} adults`);
      if (planningData.kids) parts.push(`${planningData.kids} kids`);
      if (planningData.seniors) parts.push(`${planningData.seniors} seniors`);
      if (parts.length) lines.push(`Travellers: ${parts.join(', ')}`);
    }
    if (planningData.groupType) lines.push(`Group type: ${planningData.groupType}`);
    if (planningData.travelFocus?.length) lines.push(`Travel focus: ${Array.isArray(planningData.travelFocus) ? planningData.travelFocus.join(', ') : planningData.travelFocus}`);
    if (planningData.budgetTier) lines.push(`Budget tier: ${planningData.budgetTier}`);
    if (planningData.currency) lines.push(`Currency: ${planningData.currency}`);
    if (planningData.notes) lines.push(`Notes: ${planningData.notes}`);
    if (planningData.eventTime) lines.push(`Event time: ${planningData.eventTime}`);
    if (planningData.numPeople) lines.push(`Guests: ${planningData.numPeople}`);
    if (planningData.budget) lines.push(`Budget: ${planningData.budget}`);

    if (lines.length > 0) {
      await sharedNotes.createNote(
        { parentType, parentId },
        userId,
        { title: 'Swee Planning Details', content: lines.join('\n'), category: 'general' },
      );
    }
  } catch (err) {
    logger.warn('writePlanningNote failed (non-critical)', { error: err.message });
  }
}

// ─── Activity bulk creator ────────────────────────────────────────────────────

async function bulkCreateActivities(tripId, userId, activities) {
  const activitiesService = require('../trips/submodules/activities/activities.service');
  for (const act of activities) {
    if (!act.title) continue;
    try {
      await activitiesService.createActivity(tripId, userId, {
        title: String(act.title).slice(0, 255),
        date: act.date || null,
        time: parseActivityTime(act.time),
        locationName: act.locationName || null,
        description: act.description || null,
      });
    } catch (err) {
      logger.warn('bulkCreateActivities: activity skipped', { title: act.title, error: err.message });
    }
  }
}

/**
 * Build smart default notes for a newly created trip or event.
 * Returns an array of note objects { title, content }.
 */
function buildSmartNotes(type, draft) {
  const notes = [];

  if (type === 'trip') {
    notes.push({ title: 'Documents checklist', content: 'Passport / ID, Visa (if needed), Travel insurance, Hotel confirmations, Flight tickets' });
    notes.push({ title: 'Packing essentials', content: 'Chargers, Adapters, Medications, Sunscreen, Comfortable footwear' });
    if (draft.destination) {
      notes.push({ title: 'Local tips', content: `Things to research before visiting ${draft.destination}: local currency, emergency contacts, transport options, tipping customs` });
    }
    if (draft.notes && String(draft.notes).trim()) {
      notes.push({ title: 'Special preferences', content: String(draft.notes).trim() });
    }
  }

  if (type === 'event') {
    notes.push({ title: 'Event checklist', content: 'Confirm venue booking, Notify guests, Arrange transport, Prepare any materials/gifts' });
    if (draft.notes && String(draft.notes).trim()) {
      notes.push({ title: 'Notes', content: String(draft.notes).trim() });
    }
  }

  return notes;
}

/**
 * Write smart default notes + any planning notes for a trip or event.
 */
async function writeAllNotes(type, parentId, userId, draft) {
  const smartNotes = buildSmartNotes(type, draft);
  await writePlanningNote(type, parentId, userId, draft); // existing planning meta note

  try {
    const sharedNotes = require('../shared/notes/notes.service');
    for (const n of smartNotes) {
      await sharedNotes.createNote(
        { parentType: type, parentId },
        userId,
        { title: n.title, content: n.content, category: 'general' },
      );
    }
  } catch (err) {
    logger.warn('writeAllNotes: smart notes skipped', { parentId, error: err.message });
  }
}

/** Persist Swee draft extras to planning_metadata JSONB (non-critical). */
async function writePlanningMetadata(parentType, parentId, draft) {
  try {
    const table = parentType === 'trip' ? 'trips' : 'events';
    const metadata = buildPlanningMetadata(draft);
    await db(
      `UPDATE ${table}
       SET planning_metadata = COALESCE(planning_metadata, '{}'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify(metadata), parentId],
    );
  } catch (err) {
    logger.warn('writePlanningMetadata failed (non-critical)', { parentId, error: err.message });
  }
}

// ─── Gemini chat ──────────────────────────────────────────────────────────────

function classifyGeminiError(err) {
  const msg = String(err?.message || '').toLowerCase();
  const status = err?.status || err?.statusCode || err?.response?.status;

  const isRateLimit = status === 429
    || msg.includes('429')
    || msg.includes('resource exhausted')
    || msg.includes('quota exceeded')
    || msg.includes('rate limit');

  if (isRateLimit) {
    return Object.assign(new Error(geminiRateLimitMessage()), {
      statusCode: 429,
      sweeErrorCode: 'GEMINI_RATE_LIMIT',
    });
  }

  const isUnavailable = status === 503
    || msg.includes('503')
    || msg.includes('unavailable')
    || msg.includes('overloaded');

  if (isUnavailable) {
    return Object.assign(new Error(serviceBusyMessage()), {
      statusCode: 503,
      sweeErrorCode: 'SERVICE_UNAVAILABLE',
    });
  }

  return err;
}

/** Build the current-turn payload for Gemini: text plus any inline attachments. */
function buildMessageParts(message, attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return message;
  }
  const parts = [];
  parts.push({ text: message || 'The user attached the file(s) below. Read them and respond per your instructions.' });
  for (const a of attachments) {
    parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
  }
  return parts;
}

async function geminiChatOnce(message, history, systemPrompt, attachments) {
  const model = getGeminiModel(systemPrompt);
  const geminiHistory = toGeminiHistory(history);
  const chatSession = model.startChat({ history: geminiHistory });
  const result = await chatSession.sendMessage(buildMessageParts(message, attachments));
  return result.response.text();
}

async function geminiChat(message, history, systemPrompt, attachments) {
  const attempt = async () => {
    try {
      return await geminiChatOnce(message, history, systemPrompt, attachments);
    } catch (err) {
      throw classifyGeminiError(err);
    }
  };

  try {
    const text = await attempt();
    circuitBreaker.recordSuccess();
    return text;
  } catch (err) {
    if (err.sweeErrorCode === 'GEMINI_RATE_LIMIT') {
      logger.info('Swee Gemini retrying after rate limit', { delayMs: '2000-5000' });
      await sleep(2000 + Math.floor(Math.random() * 3000));
      try {
        const text = await attempt();
        circuitBreaker.recordSuccess();
        return text;
      } catch (retryErr) {
        if (retryErr.sweeErrorCode === 'GEMINI_RATE_LIMIT' || retryErr.sweeErrorCode === 'SERVICE_UNAVAILABLE') {
          circuitBreaker.recordFailure();
        }
        throw retryErr;
      }
    }
    if (err.sweeErrorCode === 'SERVICE_UNAVAILABLE') {
      circuitBreaker.recordFailure();
    }
    throw err;
  }
}

async function geminiChatStream(message, history, systemPrompt, res) {
  const model = getGeminiModel(systemPrompt);
  const geminiHistory = toGeminiHistory(history);
  const chatSession = model.startChat({ history: geminiHistory });
  const result = await chatSession.sendMessageStream(message);

  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main chat handler. Loads history from DB when conversationId is set,
 * calls Gemini, persists messages, returns { reply, pendingAction, conversationId, messageId }.
 */
const chat = async (userId, message, { conversationId, conversationHistory, tripContext, attachments = [] } = {}) => {
  let resolvedConversationId = conversationId;
  let resolvedTripContext = tripContext || null;

  if (resolvedConversationId) {
    const conv = await conversationsService.getConversation(userId, resolvedConversationId);
    if (!resolvedTripContext && conv.tripContext) {
      resolvedTripContext = conv.tripContext;
    }
  } else {
    const created = await conversationsService.createConversation(userId, tripContext || null);
    resolvedConversationId = created.id;
    resolvedTripContext = created.tripContext || tripContext || null;
  }

  let history;
  let memoryBlock = '';

  if (resolvedConversationId) {
    const msgCount = await conversationsService.countMessages(resolvedConversationId);
    if (msgCount > 0) {
      const loaded = await conversationsService.loadHistoryForGemini(
        resolvedConversationId,
        MAX_HISTORY_MESSAGES,
      );
      history = trimHistory(loaded.history);
      memoryBlock = loaded.memoryBlock;
    } else {
      history = trimHistory(conversationHistory);
    }
  } else {
    history = trimHistory(conversationHistory);
  }

  const historyLength = history.length;
  const [userContext] = await Promise.all([loadUserContext(userId)]);

  const systemPrompt = buildSweetSystemPrompt(
    userContext,
    resolvedTripContext,
    historyLength,
    memoryBlock,
  );

  const startedAt = Date.now();

  if (circuitBreaker.isOpen()) {
    throw Object.assign(new Error(serviceBusyMessage()), {
      statusCode: 503,
      sweeErrorCode: 'CIRCUIT_OPEN',
    });
  }

  let rawReply;
  try {
    rawReply = await geminiChat(message, history, systemPrompt, attachments);
  } catch (err) {
    if (err.sweeErrorCode === 'GEMINI_RATE_LIMIT') {
      logger.warn('Swee Gemini rate_limited', { userId, code: 429, conversationId: resolvedConversationId });
    } else if (err.sweeErrorCode === 'SERVICE_UNAVAILABLE' || err.sweeErrorCode === 'CIRCUIT_OPEN') {
      logger.warn('Swee Gemini unavailable', {
        userId,
        code: err.sweeErrorCode === 'CIRCUIT_OPEN' ? 'circuit_open' : 503,
        conversationId: resolvedConversationId,
      });
    }
    throw err;
  }

  logger.info('Swee chat completed', {
    userId,
    conversationId: resolvedConversationId,
    latencyMs: Date.now() - startedAt,
    historyMessages: historyLength,
    hasMemory: Boolean(memoryBlock),
  });

  const parsed = parseActionBlock(rawReply, { logInvalid: true, logger });
  if (parsed.actionParseError) {
    logger.warn('Swee action_parse_failed', {
      userId,
      conversationId: resolvedConversationId,
      reason: parsed.actionParseError,
    });
  }
  const { reply, pendingAction } = parsed;

  // Persist a readable marker for attachment-carrying turns (binaries are not stored).
  let persistedUserContent = message;
  if (attachments.length > 0) {
    const names = attachments.map((a) => a.name || 'file').join(', ');
    const marker = `📎 ${attachments.length === 1 ? 'Attached' : 'Attached'}: ${names}`;
    persistedUserContent = message ? `${message}\n\n${marker}` : marker;
  }

  const savedMessage = await conversationsService.appendMessages(userId, resolvedConversationId, {
    userContent: persistedUserContent,
    assistantContent: reply,
    pendingAction: pendingAction || null,
    tripContext: tripContext || null,
  });

  return {
    reply,
    pendingAction: pendingAction || null,
    conversationId: resolvedConversationId,
    messageId: savedMessage.id,
  };
};

const chatStream = async (userId, message, conversationHistory, tripContext, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const history = trimHistory(conversationHistory);
  const historyLength = history.length;

  const [userContext] = await Promise.all([loadUserContext(userId)]);

  const systemPrompt = buildSweetSystemPrompt(userContext, tripContext, historyLength);
  await geminiChatStream(message, history, systemPrompt, res);
};

/**
 * Execute a confirmed Swee action (create_trip, create_event, update_trip, update_event, add_note).
 * Called after user taps "Yes" / "Confirm" in the chat UI.
 * Returns { reply, created: { id, type, name } }.
 */
const executeAction = async (userId, pendingAction) => {
  if (!pendingAction || !pendingAction.intent) {
    throw Object.assign(new Error('No pending action to execute'), { statusCode: 400 });
  }

  const { intent, draft = {}, tripId, targetTripName, noteContent } = pendingAction;

  if (intent === 'identify_update' || intent === 'none') {
    throw badRequest('This step cannot be executed directly — continue the conversation with Swee');
  }

  // ── create_trip ──────────────────────────────────────────────────────────────
  if (intent === 'create_trip') {
    const destination = requireNonEmptyString(draft.destination, 'Destination');
    const startDate = requireIsoDate(draft.startDate, 'Start date');
    const endDate = requireIsoDate(draft.endDate, 'End date');
    if (new Date(`${endDate}T12:00:00`) < new Date(`${startDate}T12:00:00`)) {
      throw badRequest('End date must be on or after start date');
    }

    const tripsService = require('../trips/trips.service');

    let name = (draft.name || generateTripName(destination, startDate)).trim();
    if (name.length > 255) name = name.slice(0, 255);
    if (name.length < 3) throw badRequest('Trip name must be at least 3 characters');

    const body = {
      name,
      startDate,
      endDate,
      location: { name: destination },
      reminders: true,
    };

    // createTrip returns the enriched trip object directly
    const trip = await tripsService.createTrip(userId, body);

    // Create suggested activities if Swee collected them during the conversation
    if (Array.isArray(draft.activities) && draft.activities.length > 0) {
      await bulkCreateActivities(trip.id, userId, draft.activities);
    }

    await writeAllNotes('trip', trip.id, userId, draft);
    await writePlanningMetadata('trip', trip.id, draft);

    return {
      reply: 'Trip created! Add places and invite friends now.',
      created: { id: trip.id, type: 'trip', name: trip.name },
    };
  }

  // ── create_event ─────────────────────────────────────────────────────────────
  if (intent === 'create_event') {
    const name = requireNonEmptyString(draft.name, 'Event name').slice(0, 255);
    const eventDate = requireIsoDate(draft.eventDate, 'Event date');
    // Location is optional — the user may not have decided a venue yet.
    const location = typeof draft.location === 'string' ? draft.location.trim() : '';

    const eventsService = require('../events/events.service');

    const eventType = resolveEventType(draft.eventType);
    const eventTime = parseEventTime(draft.eventTime);

    const body = {
      name,
      eventDate,
      eventTime: eventTime || undefined,
      eventType,
      description: draft.description || undefined,
      location: location ? { name: location } : undefined,
      reminders: true,
    };

    // createEvent returns the enriched event object directly
    const event = await eventsService.createEvent(userId, body);

    await writeAllNotes('event', event.id, userId, draft);
    await writePlanningMetadata('event', event.id, draft);

    return {
      reply: 'Event created! You can invite your friends directly from the event page.',
      created: { id: event.id, type: 'event', name: event.name },
    };
  }

  // ── update_trip ───────────────────────────────────────────────────────────────
  if (intent === 'update_trip') {
    const { trips } = await findUserTrip(userId, { tripId, targetTripName });
    if (trips.length === 0) {
      throw Object.assign(new Error('Trip not found. Please go to your Trips tab to find it.'), { statusCode: 404 });
    }
    if (trips.length > 1) {
      const list = trips.map((t) => `• ${t.name} (${t.location_name || 'TBD'})`).join('\n');
      throw Object.assign(
        new Error(`Found multiple trips matching that name. Which one?\n${list}`),
        { statusCode: 409 },
      );
    }

    const tripsService = require('../trips/trips.service');
    const targetTrip = trips[0];
    const updates = {};
    if (draft.startDate) updates.startDate = requireIsoDate(draft.startDate, 'Start date');
    if (draft.endDate) updates.endDate = requireIsoDate(draft.endDate, 'End date');
    if (draft.destination) updates.location = { name: requireNonEmptyString(draft.destination, 'Destination') };

    if (updates.startDate && updates.endDate && new Date(`${updates.endDate}T12:00:00`) < new Date(`${updates.startDate}T12:00:00`)) {
      throw badRequest('End date must be on or after start date');
    }

    const hasFieldUpdate = Object.keys(updates).length > 0;
    const hasMetaUpdate = draft.notes || draft.travelFocus || draft.budgetTier;
    if (!hasFieldUpdate && !hasMetaUpdate) {
      throw badRequest('No changes to save');
    }

    if (hasFieldUpdate) {
      await tripsService.updateTrip(targetTrip.id, updates);
    }

    if (draft.notes || draft.travelFocus || draft.budgetTier) {
      await writePlanningNote('trip', targetTrip.id, userId, draft);
    }
    await writePlanningMetadata('trip', targetTrip.id, draft);

    return {
      reply: `Done! ${targetTrip.name} updated.`,
      created: { id: targetTrip.id, type: 'trip', name: targetTrip.name },
    };
  }

  // ── update_event ──────────────────────────────────────────────────────────────
  if (intent === 'update_event') {
    const { events } = await findUserEvent(userId, {
      eventId: pendingAction.eventId,
      targetEventName: pendingAction.targetEventName,
    });
    if (events.length === 0) {
      throw Object.assign(new Error('Event not found. Please go to your Events tab to find it.'), { statusCode: 404 });
    }
    const eventsService = require('../events/events.service');
    const targetEvent = events[0];
    const updates = {};
    if (draft.eventDate) updates.eventDate = requireIsoDate(draft.eventDate, 'Event date');
    if (draft.eventTime) updates.eventTime = parseEventTime(draft.eventTime);
    if (draft.location) updates.location = { name: requireNonEmptyString(draft.location, 'Location') };
    if (draft.description) updates.description = draft.description;

    if (Object.keys(updates).length === 0) {
      throw badRequest('No changes to save');
    }

    await eventsService.updateEvent(targetEvent.id, updates);
    await writePlanningMetadata('event', targetEvent.id, draft);

    return {
      reply: `Done! ${targetEvent.name} updated.`,
      created: { id: targetEvent.id, type: 'event', name: targetEvent.name },
    };
  }

  // ── add_note ──────────────────────────────────────────────────────────────────
  if (intent === 'add_note') {
    const sharedNotes = require('../shared/notes/notes.service');
    // Determine parent type: tripId present → trip, else event
    const parentType = pendingAction.tripId ? 'trip' : 'event';
    const parentId = pendingAction.tripId || pendingAction.eventId;

    if (!parentId) {
      throw badRequest('Trip or event ID required to add a note');
    }

    const content = requireNonEmptyString(noteContent || draft.notes, 'Note content');

    await sharedNotes.createNote(
      { parentType, parentId },
      userId,
      { title: 'Swee Note', content, category: 'general' },
    );

    return {
      reply: 'Done! Note saved.',
      created: null,
    };
  }

  throw Object.assign(new Error(`Unknown action intent: ${intent}`), { statusCode: 400 });
};

const reportIssue = async (userId, messageId, reason) => {
  await db(
    `INSERT INTO feedback (user_id, type, message, status, created_at)
     VALUES ($1, 'swee_report', $2, 'open', NOW())`,
    [userId, `[messageId: ${messageId || 'unknown'}] ${reason}`],
  );
};

module.exports = { chat, chatStream, executeAction, reportIssue };
