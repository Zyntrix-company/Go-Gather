/**
 * Swee AI Service — powered by Google Gemini (model id from config.gemini.model)
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
  shortenActivityTitle,
  generateTripName,
  resolveEventType,
  parseActivityTime,
  parseEventTime,
  badRequest,
  requireIsoDate,
  toIsoDateString,
  isUuid,
  requireNonEmptyString,
  buildPlanningMetadata,
  MAX_ADD_ACTIVITIES,
} = require('./ai.helpers');
const conversationsService = require('./conversations.service');
const circuitBreaker = require('./swee.circuitBreaker');
const scopeGuard = require('./swee.scopeGuard');
const itinerary = require('./swee.itinerary');
const {
  geminiRateLimitMessage,
  serviceBusyMessage,
  outOfScopeMessage,
  scopeReminderText,
} = require('./swee.messages');

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
    model: config.gemini.model,
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
    sql = `SELECT t.id, t.name, t.start_date, t.end_date, t.location_name, tm.role
           FROM trips t
           JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
           WHERE t.id = $2 AND t.archived_at IS NULL`;
    params = [userId, tripId];
  } else if (targetTripName) {
    sql = `SELECT t.id, t.name, t.start_date, t.end_date, t.location_name, tm.role
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

const BULK_ACTIVITY_CONCURRENCY = 5;

/**
 * Creates each activity (a few at a time — the list is shown sorted by date/time, so insert
 * order doesn't matter). A failing one is counted, not fatal. Returns { added, failed }.
 * `notify:false` suppresses the per-activity "Itinerary Updated" notification so the caller can
 * send a single summary.
 */
async function bulkCreateActivities(tripId, userId, activities, { notify = true } = {}) {
  const activitiesService = require('../trips/submodules/activities/activities.service');
  let added = 0;
  let failed = 0;
  let firstId = null;

  const createOne = async (act) => {
    if (!act || !act.title) { failed += 1; return; }
    try {
      const created = await activitiesService.createActivity(tripId, userId, {
        title: shortenActivityTitle(act.title),
        date: act.date || null,
        time: parseActivityTime(act.time),
        locationName: act.locationName || null,
        description: act.description || null,
      }, { notify });
      added += 1;
      if (!firstId) firstId = created?.id || null;
    } catch (err) {
      failed += 1;
      logger.warn('bulkCreateActivities: activity skipped', { title: act.title, error: err.message });
    }
  };

  for (let i = 0; i < activities.length; i += BULK_ACTIVITY_CONCURRENCY) {
    await Promise.all(activities.slice(i, i + BULK_ACTIVITY_CONCURRENCY).map(createOne));
  }
  return { added, failed, firstId };
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

// ─── Itinerary planning ───────────────────────────────────────────────────────

const ITINERARY_FAILED_REPLY = 'I couldn\'t plan the itinerary just now — please ask me again in a moment.';

/** Dates that already have activities, plus the places on them (so a new plan doesn't repeat them). */
async function loadTripActivitySummary(tripId) {
  const result = await db(
    `SELECT activity_date, title, location_name FROM trip_activities WHERE trip_id = $1`,
    [tripId],
  );
  const busyDates = new Set();
  const places = [];
  for (const row of result.rows) {
    const date = toIsoDateString(row.activity_date);
    if (date) busyDates.add(date);
    places.push(row.location_name || row.title);
  }
  return { busyDates, places: places.filter(Boolean) };
}

async function loadTripPlanningMetadata(tripId) {
  try {
    const result = await db('SELECT planning_metadata FROM trips WHERE id = $1', [tripId]);
    return result.rows[0]?.planning_metadata || {};
  } catch (err) {
    logger.warn('loadTripPlanningMetadata failed (non-critical)', { tripId, error: err.message });
    return {};
  }
}

function travellersFrom(source = {}) {
  const n = (v) => (Number(v) > 0 ? Number(v) : 0);
  return { adults: n(source.adults), kids: n(source.kids), seniors: n(source.seniors) };
}

/**
 * Turn Swee's plan_itinerary request for an EXISTING trip into a confirmable add_activities
 * proposal: the server plans every requested (or still-empty) day, 3 activities each.
 * Returns { ok, text, pendingAction }. `text` is the preview (ok) or a plain message (not ok).
 */
async function buildItineraryProposal(userId, action) {
  const draft = action.draft && typeof action.draft === 'object' ? action.draft : {};
  const safeTripId = isUuid(action.tripId) ? action.tripId : undefined;
  const { trips } = await findUserTrip(userId, {
    tripId: safeTripId,
    targetTripName: safeTripId ? undefined : action.targetTripName,
  });
  if (trips.length === 0) {
    return { ok: false, text: 'I couldn\'t find that trip. Which trip should I plan?' };
  }
  if (trips.length > 1) {
    const list = trips.map((t) => `- ${t.name} (${t.location_name || 'TBD'})`).join('\n');
    return { ok: false, text: `Which trip should I plan?\n${list}` };
  }

  const trip = trips[0];
  const tripStart = toIsoDateString(trip.start_date);
  const tripEnd = toIsoDateString(trip.end_date);
  const allDates = itinerary.enumerateDates(tripStart, tripEnd);
  if (allDates.length === 0) {
    return { ok: false, text: `${trip.name} doesn't have dates yet — set its dates first and I'll plan every day.` };
  }

  const requested = Array.isArray(draft.dates)
    ? [...new Set(draft.dates.filter((d) => allDates.includes(d)))]
    : [];
  const [{ busyDates, places }, meta] = await Promise.all([
    loadTripActivitySummary(trip.id),
    loadTripPlanningMetadata(trip.id),
  ]);
  // Specific days the user asked for are planned even if they have activities; otherwise only empty days.
  const dates = requested.length ? requested : allDates.filter((d) => !busyDates.has(d));
  if (dates.length === 0) {
    return {
      ok: false,
      text: `Every day of ${trip.name} already has activities. Tell me which day you'd like more ideas for and I'll plan it.`,
    };
  }

  const plan = await itinerary.generateItinerary({
    destination: trip.location_name || trip.name,
    dates,
    travellers: travellersFrom(meta),
    groupType: meta.groupType,
    travelFocus: meta.travelFocus,
    budgetTier: meta.budgetTier,
    preferences: typeof draft.preferences === 'string' ? draft.preferences : meta.itineraryPrefs,
    avoidPlaces: places,
    tripStart,
    tripEnd,
  });
  if (plan.activities.length === 0) return { ok: false, text: ITINERARY_FAILED_REPLY };

  const notes = [];
  if (plan.truncated) {
    notes.push(`That's the first ${itinerary.MAX_ITINERARY_DAYS} days — save these and ask me for the rest.`);
  }
  if (plan.missing.length > 0) {
    notes.push('A few slots are still open — you can add your own in the trip\'s Activities tab.');
  }
  const preview = itinerary.formatItineraryPreview(plan.activities);
  return {
    ok: true,
    text: `${preview}${notes.length ? `\n\n${notes.join(' ')}` : ''}\n\nAdd these to your itinerary?`,
    pendingAction: {
      intent: 'add_activities',
      readyToCreate: true,
      scope: 'in',
      tripId: trip.id,
      draft: { activities: plan.activities },
    },
  };
}

// Background itinerary jobs for newly created trips. Tracked so tests (and shutdown) can wait.
const backgroundJobs = new Set();

function runInBackground(fn) {
  const job = Promise.resolve().then(fn).catch((err) => {
    logger.error('Swee background job failed', { error: err.message });
  });
  backgroundJobs.add(job);
  job.finally(() => backgroundJobs.delete(job));
  return job;
}

function waitForBackgroundJobs() {
  return Promise.all([...backgroundJobs]);
}

/**
 * Plan and save a full itinerary for a trip Swee just created, using the form's final
 * dates and preferences. Tells the creator when it's ready (push + a message in the chat).
 */
async function planNewTripItinerary({
  userId, trip, draft, startDate, endDate, skipDates, conversationId, chatReady = Promise.resolve(),
}) {
  const { createAndSendNotifications } = require('../../utils/fcm.util');
  const activitiesService = require('../trips/submodules/activities/activities.service');
  const dates = itinerary.enumerateDates(startDate, endDate).filter((d) => !skipDates.has(d));

  const tell = async (title, body, chatText) => {
    try {
      await createAndSendNotifications(
        [{ id: userId }],
        { title, body },
        'ITINERARY_UPDATED',
        { tripId: trip.id, tripName: trip.name },
      );
    } catch (err) {
      logger.warn('Swee itinerary notification failed', { tripId: trip.id, error: err.message });
    }
    if (conversationId) {
      try {
        // Wait until the controller has saved the "Trip created" exchange so this message lands after it.
        await chatReady;
        await conversationsService.appendAssistantMessage(userId, conversationId, chatText);
      } catch (err) {
        logger.warn('Swee itinerary chat message failed', { tripId: trip.id, error: err.message });
      }
    }
  };

  if (dates.length === 0) return;

  let added = 0;
  let plan = null;
  try {
    plan = await itinerary.generateItinerary({
      destination: draft.destination,
      dates,
      travellers: travellersFrom(draft),
      groupType: draft.groupType,
      travelFocus: draft.travelFocus,
      budgetTier: draft.budgetTier,
      preferences: typeof draft.itineraryPrefs === 'string' ? draft.itineraryPrefs : undefined,
      tripStart: startDate,
      tripEnd: endDate,
    });
    if (plan.activities.length > 0) {
      ({ added } = await bulkCreateActivities(trip.id, userId, plan.activities, { notify: false }));
    }
  } catch (err) {
    logger.warn('Swee new-trip itinerary failed', { tripId: trip.id, error: err.message });
  }

  if (added === 0) {
    await tell(
      'Itinerary not ready',
      `Swee couldn't plan "${trip.name}" this time. Ask Swee to plan it again.`,
      `I couldn't plan the itinerary for ${trip.name} this time. Just ask me "plan my ${trip.name} itinerary" and I'll try again.`,
    );
    return;
  }

  activitiesService.notifyItineraryUpdated(trip.id, userId, null, added);
  const days = new Set(plan.activities.map((a) => a.date)).size;
  const rest = plan.truncated
    ? ` I planned the first ${itinerary.MAX_ITINERARY_DAYS} days — ask me for the rest.`
    : '';
  await tell(
    'Your itinerary is ready',
    `Swee planned ${added} activities across ${days} days for "${trip.name}".`,
    `Your ${trip.name} itinerary is ready — ${added} activities across ${days} days. Open the trip's Activities to see it.${rest}`,
  );
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

/**
 * Build the current-turn payload for Gemini: text, any inline attachments, then the
 * per-turn scope reminder. The reminder only goes to Gemini — it is never persisted.
 */
function buildMessageParts(message, attachments = []) {
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const parts = [];
  parts.push({
    text: message || (hasAttachments
      ? 'The user attached the file(s) below. Read them and respond per your instructions.'
      : ''),
  });
  if (hasAttachments) {
    for (const a of attachments) {
      parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
    }
  }
  parts.push({ text: scopeReminderText() });
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main chat handler. Loads history from DB when conversationId is set,
 * calls Gemini, persists messages, returns { reply, pendingAction, conversationId, messageId }.
 */
const chat = async (userId, message, { conversationId, tripContext, attachments = [] } = {}) => {
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

  // History always comes from the server. Client-sent conversationHistory is ignored: it
  // could be forged, and on a new chat it only duplicated the current message.
  const loaded = await conversationsService.loadHistoryForGemini(
    resolvedConversationId,
    MAX_HISTORY_MESSAGES,
  );
  const history = trimHistory(loaded.history);
  const memoryBlock = loaded.memoryBlock;

  // Swee's latest message, even if it was a refused turn (those are hidden from history).
  // Best-effort: failing to read it must never break the chat.
  const lastAssistantLookup = conversationId
    ? Promise.resolve(conversationsService.loadLastAssistantMessage(resolvedConversationId)).catch((err) => {
      logger.warn('Swee loadLastAssistantMessage failed', { conversationId: resolvedConversationId, error: err.message });
      return null;
    })
    : Promise.resolve(null);

  const historyLength = history.length;
  const [userContext, lastAssistantRow] = await Promise.all([
    loadUserContext(userId),
    lastAssistantLookup,
  ]);

  const systemPrompt = buildSweetSystemPrompt(
    userContext,
    resolvedTripContext,
    historyLength,
    memoryBlock,
    lastAssistantRow?.refused ? lastAssistantRow.content : '',
  );

  const startedAt = Date.now();

  if (circuitBreaker.isOpen()) {
    throw Object.assign(new Error(serviceBusyMessage()), {
      statusCode: 503,
      sweeErrorCode: 'CIRCUIT_OPEN',
    });
  }

  // Independent scope check runs in parallel with the main call (never rejects, fails open).
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  const scopePromise = scopeGuard.checkScope({
    message,
    attachments,
    lastAssistantMessage: lastAssistantRow?.content ?? lastAssistant?.content,
    tripContext: resolvedTripContext,
  });

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
  const scopeVerdict = await scopeGuard.awaitVerdict(scopePromise);
  const guardMode = config.sweeScopeGuard?.mode || 'shadow';
  let blockedBy = null;
  if (scopeVerdict.scope === 'out') blockedBy = 'classifier';
  else if (parsed.scope === 'out') blockedBy = 'self_report';

  if (blockedBy) {
    logger.info('Swee scope_out', {
      userId,
      conversationId: resolvedConversationId,
      mode: guardMode,
      blockedBy,
      category: scopeVerdict.category || null,
      classifier: scopeVerdict.scope,
      selfReport: parsed.scope,
    });
  }

  const enforceBlock = guardMode === 'enforce' && Boolean(blockedBy);
  let { reply, pendingAction } = parsed;
  if (enforceBlock) {
    reply = outOfScopeMessage(resolvedTripContext);
    pendingAction = null;
  }

  // "Plan my itinerary" for an existing trip: the server plans every day and shows a preview
  // the user confirms. plan_itinerary itself never reaches the app.
  if (pendingAction?.intent === 'plan_itinerary') {
    try {
      const proposal = await buildItineraryProposal(userId, pendingAction);
      reply = proposal.ok ? `${reply ? `${reply}\n\n` : ''}${proposal.text}` : proposal.text;
      pendingAction = proposal.ok ? proposal.pendingAction : null;
    } catch (err) {
      logger.warn('Swee plan_itinerary failed', { userId, conversationId: resolvedConversationId, error: err.message });
      reply = ITINERARY_FAILED_REPLY;
      pendingAction = null;
    }
  }
  // Keep refused turns out of future Gemini history. Outside enforce mode only Swee's own
  // refusals are flagged, so a classifier false positive never costs the user context.
  const persistedScope = enforceBlock || parsed.scope === 'out' ? 'out' : 'in';

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
    scope: persistedScope,
  });

  return {
    reply,
    pendingAction: pendingAction || null,
    conversationId: resolvedConversationId,
    messageId: savedMessage.id,
  };
};

/**
 * Execute a confirmed Swee action (create_trip, create_event, update_trip, update_event, add_note, add_activities).
 * Called after user taps "Yes" / "Confirm" in the chat UI.
 * Returns { reply, created: { id, type, name } }.
 */
const executeAction = async (userId, pendingAction, { conversationId = null, chatReady } = {}) => {
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

    // Activities Swee already has (e.g. read from an attached itinerary) — only those that fall
    // inside the dates chosen on the card; they were drafted before the dates were picked.
    const provided = (Array.isArray(draft.activities) ? draft.activities : [])
      .filter((a) => a && typeof a.date === 'string' && a.date >= startDate && a.date <= endDate)
      .slice(0, MAX_ADD_ACTIVITIES);
    if (provided.length > 0) {
      await bulkCreateActivities(trip.id, userId, provided, { notify: false });
    }

    await writeAllNotes('trip', trip.id, userId, draft);
    await writePlanningMetadata('trip', trip.id, draft);

    // The user asked Swee to plan the itinerary: plan it in the background with the card's final
    // dates and preferences, so the card doesn't wait on a long Gemini call.
    const planItinerary = draft.planItinerary === true || draft.planItinerary === 'true';
    if (planItinerary) {
      const skipDates = new Set(provided.map((a) => a.date));
      const days = itinerary.enumerateDates(startDate, endDate).filter((d) => !skipDates.has(d)).length;
      if (days > 0) {
        runInBackground(() => planNewTripItinerary({
          userId,
          trip: { id: trip.id, name: trip.name },
          draft: { ...draft, destination },
          startDate,
          endDate,
          skipDates,
          conversationId,
          chatReady,
        }));
        return {
          reply: `Trip created! I'm planning your ${days}-day itinerary now — it'll appear in the trip's Activities in about a minute, and I'll let you know when it's ready.`,
          created: { id: trip.id, type: 'trip', name: trip.name },
        };
      }
    }

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
    // Same rule as PUT /trips/:id (tripAdmin middleware).
    if (targetTrip.role !== 'admin') {
      throw Object.assign(new Error('Only trip admins can change trip details.'), { statusCode: 403 });
    }
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
      created: { id: targetTrip.id, type: 'trip', name: targetTrip.name, action: 'updated' },
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
      created: { id: targetEvent.id, type: 'event', name: targetEvent.name, action: 'updated' },
    };
  }

  // ── add_activities ────────────────────────────────────────────────────────────
  if (intent === 'add_activities') {
    const requested = Array.isArray(draft.activities) ? draft.activities : [];
    if (requested.length === 0) throw badRequest('There are no activities to add');
    if (requested.length > MAX_ADD_ACTIVITIES) {
      throw badRequest(`I can add up to ${MAX_ADD_ACTIVITIES} activities at a time — ask me for fewer days.`);
    }

    // The id comes from the client/model: only write into a trip the caller belongs to.
    // Same rule as POST /trips/:id/activities (any trip member, not just admins).
    // A non-UUID id (the model sometimes writes a name there) would make Postgres throw.
    const safeTripId = isUuid(tripId) ? tripId : undefined;
    if (!safeTripId && !targetTripName) throw badRequest('Which trip should I add these to?');
    const { trips } = await findUserTrip(userId, { tripId: safeTripId, targetTripName });
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
    const targetTrip = trips[0];
    const tripStart = toIsoDateString(targetTrip.start_date);
    const tripEnd = toIsoDateString(targetTrip.end_date);

    const valid = [];
    let rejected = 0;
    for (const act of requested) {
      const title = typeof act?.title === 'string' ? act.title.trim() : '';
      const date = typeof act?.date === 'string' ? act.date.trim() : '';
      const inFormat = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime());
      const inRange = inFormat
        && (!tripStart || date >= tripStart)
        && (!tripEnd || date <= tripEnd);
      if (!title || !inRange) { rejected += 1; continue; }
      valid.push({ ...act, title, date });
    }
    if (valid.length === 0) {
      throw badRequest(
        tripStart && tripEnd
          ? `Those activities fall outside ${targetTrip.name}'s dates (${tripStart} to ${tripEnd}).`
          : 'None of those activities had a valid date.',
      );
    }

    // One summary notification for the whole batch instead of one per activity.
    const { added, failed, firstId } = await bulkCreateActivities(targetTrip.id, userId, valid, { notify: false });
    if (added === 0) {
      throw badRequest('I couldn\'t save those activities. Please try again in a moment.');
    }
    require('../trips/submodules/activities/activities.service')
      .notifyItineraryUpdated(targetTrip.id, userId, firstId, added);

    const noun = (n) => `${n} activit${n === 1 ? 'y' : 'ies'}`;
    const notes = [];
    if (rejected > 0) notes.push(`${noun(rejected)} left out (date outside the trip or invalid)`);
    if (failed > 0) notes.push(`${noun(failed)} couldn't be saved`);
    const reply = `Added ${noun(added)} to ${targetTrip.name}.${notes.length ? ` ${notes.join('; ')}.` : ''}`;

    return {
      reply,
      created: { id: targetTrip.id, type: 'trip', name: targetTrip.name, action: 'updated' },
    };
  }

  // ── add_note ──────────────────────────────────────────────────────────────────
  if (intent === 'add_note') {
    const sharedNotes = require('../shared/notes/notes.service');
    // Determine parent type: tripId present → trip, else event
    const parentType = pendingAction.tripId ? 'trip' : 'event';
    const requestedId = pendingAction.tripId || pendingAction.eventId;

    if (!requestedId) {
      throw badRequest('Trip or event ID required to add a note');
    }

    // The id comes from the client: only write into a trip/event the caller belongs to.
    const { trips = [], events = [] } = parentType === 'trip'
      ? await findUserTrip(userId, { tripId: requestedId })
      : await findUserEvent(userId, { eventId: requestedId });
    const parent = parentType === 'trip' ? trips[0] : events[0];
    if (!parent) {
      throw Object.assign(new Error(`${parentType === 'trip' ? 'Trip' : 'Event'} not found.`), { statusCode: 404 });
    }
    const parentId = parent.id;

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

module.exports = {
  chat,
  executeAction,
  reportIssue,
  buildMessageParts,
  waitForBackgroundJobs,
};
