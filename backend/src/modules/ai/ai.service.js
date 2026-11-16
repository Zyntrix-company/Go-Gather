/**
 * Swee AI Service — powered by Google Gemini (model id from config.gemini.model)
 * April 2026 Configuration Guide — full implementation.
 */

const { DateTime } = require('luxon');
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
  maxAddActivities,
  ACTION_FALLBACK_REPLY,
  PROFILE_DETAIL_FIELDS,
} = require('./ai.helpers');
const { limits } = require('../../config/appLimits');
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
        // Planner v2 fields (validated in createActivity; absent for every other caller).
        ...(act.kind ? { kind: act.kind } : {}),
        ...(act.durationMinutes ? { durationMinutes: act.durationMinutes } : {}),
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
    return { ok: false, notFound: true, text: 'I couldn\'t find that trip. Which trip should I plan?' };
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

  if (config.featureFlags.sweePlannerV2) {
    return buildItineraryProposalV2({
      trip, draft, meta, dates, places, tripStart, tripEnd, freshTrip: busyDates.size === 0,
    });
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

/**
 * Planner v2 for an EXISTING trip: free-time windows, durations and travel time, the same
 * rules as a new trip. Travel legs are only added to a trip that has no activities yet.
 */
async function buildItineraryProposalV2({
  trip, draft, meta, dates, places, tripStart, tripEnd, freshTrip,
}) {
  const tz = await db('SELECT timezone FROM trips WHERE id = $1', [trip.id])
    .then((r) => r.rows[0]?.timezone)
    .catch(() => null);
  const facts = itinerary.sanitizePlanFacts({
    ...draft,
    destination: trip.location_name || trip.name,
    startDate: tripStart,
    endDate: tripEnd,
    timeZone: draft.timeZone || tz,
    origin: freshTrip ? draft.origin || meta.origin : undefined,
    travel: freshTrip ? draft.travel || (meta.travelMode ? { mode: meta.travelMode } : undefined) : undefined,
    adults: meta.adults,
    kids: meta.kids,
    seniors: meta.seniors,
    groupType: meta.groupType,
    travelFocus: meta.travelFocus,
    budgetTier: meta.budgetTier,
    preferences: typeof draft.preferences === 'string' ? draft.preferences : meta.itineraryPrefs,
  });
  const plan = await itinerary.generatePlan(facts, { dates, avoidPlaces: places });
  const wanted = new Set(dates);
  const activities = plan.activities.filter((a) => wanted.has(a.date));
  if (!activities.some((a) => a.kind === 'activity')) {
    return {
      ok: false,
      text: plan.plannedDates.length === 0
        ? `There's no free time left to plan on those days of ${trip.name}. Tell me when you're free and I'll plan around it.`
        : ITINERARY_FAILED_REPLY,
    };
  }

  const notes = [];
  if (plan.truncated) notes.push(`That's the first ${limits.itineraryMaxDays} days — save these and ask me for the rest.`);
  if (plan.droppedDates.length > 0) notes.push('A few days are still open — you can add your own in the trip\'s Activities tab.');
  const preview = itinerary.formatPlanPreview({ ...plan, activities }, facts.destination);
  return {
    ok: true,
    text: `${preview}${notes.length ? `\n\n${notes.join(' ')}` : ''}\n\nAdd these to your itinerary?`,
    pendingAction: {
      intent: 'add_activities',
      readyToCreate: true,
      scope: 'in',
      tripId: trip.id,
      draft: { activities },
    },
  };
}

// ─── Planning journey (SWEE_PLANNER_V2) ───────────────────────────────────────

const REPLAN_BUDGET_MS = 20000;
const daysBetween = (from, to) => Math.round(DateTime.fromISO(to, { zone: 'UTC' })
  .diff(DateTime.fromISO(from, { zone: 'UTC' }), 'days').days);

/** Chat text for a stored plan, with notes for truncated or open days. */
function planPreviewText(plan) {
  const notes = [];
  if (plan.truncated) {
    notes.push(`I've planned the first ${limits.itineraryMaxDays} days — once the trip is created, ask me to plan the rest.`);
  }
  const open = plan.droppedDates?.length || 0;
  if (open > 0) {
    notes.push(`I've left ${open === 1 ? 'one day' : `${open} days`} open — tell me what you'd like there and I'll fill ${open === 1 ? 'it' : 'them'}.`);
  }
  const preview = itinerary.formatPlanPreview(plan, plan.facts?.destination);
  return `${preview}${notes.length ? `\n\n${notes.join(' ')}` : ''}`;
}

/** Run Planner v2 (whole trip, or only `refineDates`) and store it as the conversation's plan. */
async function planAndStore(userId, conversationId, facts, prev, { refineDates = [], budgetMs } = {}) {
  let activities;
  let plan;
  if (prev && refineDates.length > 0) {
    // Refine: keep the other days as they are, re-plan only the dates asked for.
    const kept = prev.activities.filter((a) => a.kind !== 'travel' && !refineDates.includes(a.date));
    plan = await itinerary.generatePlan(facts, { dates: refineDates, avoidPlaces: kept.map((a) => a.locationName), budgetMs });
    activities = [...plan.activities, ...kept].sort(itinerary.byDateTime);
  } else {
    plan = await itinerary.generatePlan(facts, { budgetMs });
    activities = plan.activities;
  }
  if (!activities.some((a) => a.kind === 'activity')) return null;

  const stored = {
    version: (prev?.version || 0) + 1,
    facts,
    startDate: plan.startDate,
    endDate: plan.endDate,
    timeZone: plan.timeZone,
    international: plan.international,
    activities,
    droppedDates: plan.droppedDates,
    truncated: plan.truncated,
    updatedAt: new Date().toISOString(),
  };
  await conversationsService.savePlan(userId, conversationId, stored);
  return stored;
}

const ACTION_NOT_DONE_REPLY = 'I couldn\'t make that change — nothing was updated. Could you try again?';
const MOVE_WORDS = /\b(?:move|moving|shift|reschedule|swap)\b/i;
const SHAPE_KEYS = ['destination', 'startDate', 'endDate', 'timeZone', 'origin', 'travel', 'busy'];

/** "London, UK" and "london" are the same destination. */
const sameDestination = (a, b) => String(a || '').split(',')[0].trim().toLowerCase()
  === String(b || '').split(',')[0].trim().toLowerCase();

/**
 * Move a planned stop to another day (no model call). Returns the chat result, or null when
 * neither `draft.move` nor the user's message names a planned stop.
 */
async function movePlannedStop(userId, conversationId, prev, draft, message, named) {
  const act = itinerary.findPlannedActivity(typeof draft.move === 'string' ? draft.move : '', prev.activities)
    || itinerary.findPlannedActivity(message, prev.activities);
  if (!act) return null;
  const place = act.locationName ? act.locationName.split(',')[0] : act.title;
  const targets = named.filter((d) => d !== act.date);
  if (targets.length !== 1) {
    return { reply: `Which day should I move ${place} to? Nothing has been changed yet.`, pendingAction: null };
  }
  const label = DateTime.fromISO(targets[0], { zone: 'UTC' }).toFormat('ccc d LLL');
  const moved = itinerary.moveActivity(prev, act, targets[0]);
  if (!moved.ok) {
    return {
      reply: `I couldn't fit ${place} into ${label} — there's no free time left that day, so nothing was changed. Want me to swap something out instead?`,
      pendingAction: null,
    };
  }
  const stored = {
    ...prev, version: (prev.version || 0) + 1, activities: moved.activities, updatedAt: new Date().toISOString(),
  };
  await conversationsService.savePlan(userId, conversationId, stored);
  return {
    reply: `I've moved ${place} to ${label}.\n\n${planPreviewText(stored)}\n\nWant any changes? When it looks right, tell me and I'll set up the trip.`,
    pendingAction: null,
  };
}

/** plan_trip: plan (or refine) the trip from the facts Swee gathered and show it in chat. */
async function handlePlanTrip(userId, conversationId, action, lead, message = '') {
  const draft = action.draft || {};
  let facts = itinerary.sanitizePlanFacts(draft);
  const conv = await conversationsService.getConversation(userId, conversationId);
  const prev = conv.metadata?.plan || null;

  // A plan already exists: it is the base, and a change to named days refines only those days.
  let named = [];
  if (prev?.facts) {
    facts = itinerary.mergePlanFacts(prev.facts, facts);
    const basicsChanged = !sameDestination(facts.destination, prev.facts.destination)
      || facts.startDate !== prev.facts.startDate || facts.endDate !== prev.facts.endDate;
    if (!basicsChanged) {
      const tripDates = itinerary.enumerateDates(prev.facts.startDate, prev.facts.endDate);
      const fromModel = Array.isArray(draft.dates) ? draft.dates.filter((d) => tripDates.includes(d)) : [];
      // The model sometimes leaves "dates" out — read the days from the user's own words.
      named = fromModel.length ? [...new Set(fromModel)].sort() : itinerary.datesNamedIn(message, tripDates);
    }
    if (named.length > 0 && (typeof draft.move === 'string' || MOVE_WORDS.test(message))) {
      const moved = await movePlannedStop(userId, conversationId, prev, draft, message, named);
      if (moved) return moved;
    }
  }

  // Refine only when nothing that shapes the windows or travel legs changed; otherwise kept
  // days could clash with the new legs, so re-plan everything.
  const shape = (f) => JSON.stringify(SHAPE_KEYS.map((k) => f?.[k]));
  const sameTrip = prev && shape(prev.facts) === shape(facts);
  const refineDates = sameTrip ? named : [];

  const stored = await planAndStore(userId, conversationId, facts, prev, { refineDates });
  if (!stored) return { reply: ITINERARY_FAILED_REPLY, pendingAction: null };
  return {
    reply: `${lead ? `${lead}\n\n` : ''}${planPreviewText(stored)}\n\nWant any changes? When it looks right, tell me and I'll set up the trip.`,
    pendingAction: null,
  };
}

/** confirm_trip: show today's trip form, pre-filled from the stored plan. */
async function handleConfirmTrip(userId, conversationId, lead) {
  const conv = await conversationsService.getConversation(userId, conversationId);
  const plan = conv.metadata?.plan;
  if (!plan) {
    return { reply: lead || 'Let\'s plan the itinerary first — where are you going, and when?', pendingAction: null };
  }
  const f = plan.facts || {};
  const t = f.travellers || {};
  const draft = {
    destination: f.destination,
    name: generateTripName(f.destination, plan.startDate),
    startDate: plan.startDate,
    endDate: plan.endDate,
    adults: t.adults || undefined,
    kids: t.kids || undefined,
    seniors: t.seniors || undefined,
    groupType: f.groupType,
    budgetTier: f.budgetTier,
    travelFocus: f.travelFocus,
    currency: f.currency,
    planVersion: plan.version,
  };
  Object.keys(draft).forEach((k) => draft[k] === undefined && delete draft[k]);
  return {
    reply: lead || 'Here are your trip details — check them and tap Create My Trip.',
    pendingAction: { intent: 'create_trip', readyToCreate: false, showForm: 'trip', scope: 'in', draft },
  };
}

/**
 * The form's dates differ from the plan: re-plan for the new dates (travel legs and booked
 * times move with them), store it, and ask the user to confirm again. Nothing is created.
 */
async function replanForFormDates(userId, conversationId, plan, startDate, endDate) {
  const f = plan.facts || {};
  const startShift = daysBetween(plan.startDate, startDate);
  const endShift = daysBetween(plan.endDate, endDate);
  const shift = (leg, n) => leg && {
    ...leg,
    departDate: leg.departDate && itinerary.addDays(leg.departDate, n),
    arriveDate: leg.arriveDate && itinerary.addDays(leg.arriveDate, n),
  };
  let facts = {
    ...f,
    startDate: itinerary.addDays(f.startDate, startShift),
    endDate: itinerary.addDays(f.endDate, endShift),
    travel: f.travel && { ...f.travel, outbound: shift(f.travel.outbound, startShift), return: shift(f.travel.return, endShift) },
  };
  if (facts.endDate < facts.startDate) facts = { ...facts, startDate, endDate };

  let stored = null;
  try {
    // The app waits 30 s for /ai/execute.
    stored = await planAndStore(userId, conversationId, facts, plan, { budgetMs: REPLAN_BUDGET_MS });
  } catch (err) {
    logger.warn('Swee re-plan for new dates failed', { userId, conversationId, error: err.message });
  }
  if (!stored) {
    return {
      reply: 'Your dates changed, but I couldn\'t update the itinerary just now. Tell me the dates you\'d like and I\'ll re-plan it before we create the trip.',
      created: null,
    };
  }
  return {
    reply: `You changed the dates, so I've updated the itinerary to fit:\n\n${planPreviewText(stored)}\n\nTell me if it looks good and I'll bring the trip form back with the new dates.`,
    created: null,
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

/**
 * Planner v2, chat with a stored plan: plan_itinerary with no saved trip, or plan_trip missing
 * its basics, becomes a plan_trip refine with the plan's destination and dates filled in.
 */
function asPlanRefine(action, plan) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return action;
  const hasTrip = isUuid(action.tripId) || (typeof action.targetTripName === 'string' && action.targetTripName.trim());
  const toRefine = action.intent === 'plan_trip' || (action.intent === 'plan_itinerary' && !hasTrip);
  if (!toRefine) return action;
  const d = action.draft && typeof action.draft === 'object' && !Array.isArray(action.draft) ? action.draft : {};
  const f = plan.facts || {};
  const iso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  return {
    ...action,
    intent: 'plan_trip',
    draft: {
      ...d,
      destination: typeof d.destination === 'string' && d.destination.trim() ? d.destination : f.destination,
      startDate: iso(d.startDate) ? d.startDate : f.startDate,
      endDate: iso(d.endDate) ? d.endDate : f.endDate,
    },
  };
}

/** The intent named in a reply's ACTION line, even when the line was rejected. */
function attemptedIntent(rawReply) {
  const text = String(rawReply || '');
  const idx = text.lastIndexOf('###ACTION');
  const m = idx === -1 ? null : text.slice(idx).match(/"intent"\s*:\s*"([a-z_]+)"/);
  return m ? m[1] : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main chat handler. Loads history from DB when conversationId is set,
 * calls Gemini, persists messages, returns { reply, pendingAction, conversationId, messageId }.
 */
const chat = async (userId, message, { conversationId, tripContext, attachments = [] } = {}) => {
  let resolvedConversationId = conversationId;
  let resolvedTripContext = tripContext || null;
  let currentPlan = null; // Planner v2: the plan stored on this conversation, shown to the model

  if (resolvedConversationId) {
    const conv = await conversationsService.getConversation(userId, resolvedConversationId);
    if (config.featureFlags.sweePlannerV2) currentPlan = conv.metadata?.plan || null;
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
    ...(currentPlan ? [currentPlan] : []),
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

  // Planner v2: on a chat that already has a plan, a planning action is a refine of that plan.
  const parsed = currentPlan
    ? parseActionBlock(rawReply, { logInvalid: true, logger, prepareAction: (a) => asPlanRefine(a, currentPlan) })
    : parseActionBlock(rawReply, { logInvalid: true, logger });
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
  } else if (config.featureFlags.sweePlannerV2 && parsed.actionParseError && parsed.scope !== 'out'
    && parsed.actionParseError !== 'add_activities_too_many' && attemptedIntent(rawReply) !== 'none') {
    // The action was rejected, so nothing changed — never show text that claims it did.
    reply = ACTION_NOT_DONE_REPLY;
  }

  // "Plan my itinerary" for an existing trip: the server plans every day and shows a preview
  // the user confirms. plan_itinerary itself never reaches the app.
  if (pendingAction?.intent === 'plan_itinerary') {
    try {
      const proposal = await buildItineraryProposal(userId, pendingAction);
      if (!proposal.ok && proposal.notFound && currentPlan) {
        // Not a saved trip — it's the plan in this chat: refine that instead.
        pendingAction = asPlanRefine({ ...pendingAction, tripId: undefined, targetTripName: undefined }, currentPlan);
      } else {
        reply = proposal.ok ? `${reply ? `${reply}\n\n` : ''}${proposal.text}` : proposal.text;
        pendingAction = proposal.ok ? proposal.pendingAction : null;
      }
    } catch (err) {
      logger.warn('Swee plan_itinerary failed', { userId, conversationId: resolvedConversationId, error: err.message });
      reply = ITINERARY_FAILED_REPLY;
      pendingAction = null;
    }
  }
  // Planning journey: plan_trip / confirm_trip are handled here and never reach the app.
  if (config.featureFlags.sweePlannerV2 && (pendingAction?.intent === 'plan_trip' || pendingAction?.intent === 'confirm_trip')) {
    const { intent } = pendingAction;
    // An action line with no text of its own gets the parser's "hiccup" fallback — not a lead-in.
    const lead = reply === ACTION_FALLBACK_REPLY ? '' : reply;
    try {
      ({ reply, pendingAction } = intent === 'plan_trip'
        ? await handlePlanTrip(userId, resolvedConversationId, pendingAction, lead, message)
        : await handleConfirmTrip(userId, resolvedConversationId, lead));
    } catch (err) {
      logger.warn(`Swee ${intent} failed`, { userId, conversationId: resolvedConversationId, error: err.message });
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

    // Planner v2: the form came from confirm_trip — read the agreed plan from the conversation
    // (owner only; another user's conversation is a 404). Changed dates → re-plan, don't create.
    let plan = null;
    if (config.featureFlags.sweePlannerV2 && draft.planVersion != null && conversationId) {
      const conv = await conversationsService.getConversation(userId, conversationId);
      plan = conv.metadata?.plan || null;
      if (plan && (plan.startDate !== startDate || plan.endDate !== endDate)) {
        return replanForFormDates(userId, conversationId, plan, startDate, endDate);
      }
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

    // TRIP_TIMEZONES: Swee trips have no coordinates, so pass the destination's zone (from the
    // agreed plan, or the legacy draft); createTrip validates it and falls back as before.
    const timeZoneHint = config.featureFlags.tripTimezones
      ? (plan ? plan.facts?.timeZone : draft.timeZone)
      : null;

    // createTrip returns the enriched trip object directly
    const trip = typeof timeZoneHint === 'string' && timeZoneHint
      ? await tripsService.createTrip(userId, body, { timeZoneHint })
      : await tripsService.createTrip(userId, body);

    if (plan) {
      const planned = (plan.activities || [])
        .filter((a) => a && typeof a.date === 'string' && a.date >= startDate && a.date <= endDate)
        .slice(0, maxAddActivities());
      const { added } = planned.length > 0
        ? await bulkCreateActivities(trip.id, userId, planned, { notify: false })
        : { added: 0 };
      await writeAllNotes('trip', trip.id, userId, draft);
      await writePlanningMetadata('trip', trip.id, {
        ...draft, origin: plan.facts?.origin, travelMode: plan.facts?.travel?.mode,
      });
      const days = new Set(planned.map((a) => a.date)).size;
      return {
        reply: added > 0
          ? `Trip created with your itinerary — ${added} activities across ${days} days. Invite friends from the trip page.`
          : 'Trip created! Add places and invite friends now.',
        created: { id: trip.id, type: 'trip', name: trip.name },
      };
    }

    // Activities Swee already has (e.g. read from an attached itinerary) — only those that fall
    // inside the dates chosen on the card; they were drafted before the dates were picked.
    const provided = (Array.isArray(draft.activities) ? draft.activities : [])
      .filter((a) => a && typeof a.date === 'string' && a.date >= startDate && a.date <= endDate)
      .slice(0, maxAddActivities());
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

    // TRIP_TIMEZONES: Swee events have no coordinates, so pass the place's zone from the draft;
    // createEvent validates it and falls back as before.
    const timeZoneHint = config.featureFlags.tripTimezones ? draft.timeZone : null;

    // createEvent returns the enriched event object directly
    const event = typeof timeZoneHint === 'string' && timeZoneHint
      ? await eventsService.createEvent(userId, body, { timeZoneHint })
      : await eventsService.createEvent(userId, body);

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
      // TRIP_TIMEZONES: a destination renamed by Swee has no coordinates — pass its zone so the
      // trip and its unsent reminders move to it (updateTrip validates it, falls back as before).
      const timeZoneHint = config.featureFlags.tripTimezones && updates.location ? draft.timeZone : null;
      if (typeof timeZoneHint === 'string' && timeZoneHint) {
        await tripsService.updateTrip(targetTrip.id, updates, { timeZoneHint });
      } else {
        await tripsService.updateTrip(targetTrip.id, updates);
      }
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

    // TRIP_TIMEZONES: same as update_trip — a location changed by name carries its zone.
    const timeZoneHint = config.featureFlags.tripTimezones && updates.location ? draft.timeZone : null;
    if (typeof timeZoneHint === 'string' && timeZoneHint) {
      await eventsService.updateEvent(targetEvent.id, updates, { timeZoneHint });
    } else {
      await eventsService.updateEvent(targetEvent.id, updates);
    }
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
    if (requested.length > maxAddActivities()) {
      throw badRequest(`I can add up to ${maxAddActivities()} activities at a time — ask me for fewer days.`);
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

  // ── save_profile_detail ("remember this", PROFILE_TRAVEL_PREFS) ────────────────
  // Writes ONE whitelisted field of the CURRENT user's profile; an empty value clears it.
  if (intent === 'save_profile_detail' && config.featureFlags.profileTravelPrefs) {
    const spec = Object.prototype.hasOwnProperty.call(PROFILE_DETAIL_FIELDS, draft.field)
      ? PROFILE_DETAIL_FIELDS[draft.field] : null;
    if (!spec) {
      throw badRequest('I can only remember your home city, usual way of travelling, interests, and dietary or accessibility needs.');
    }
    const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
    let value;
    if (draft.field === 'interests') {
      const list = (Array.isArray(draft.value) ? draft.value : clean(draft.value).split(',')).map(clean).filter(Boolean);
      if (list.length > 10 || list.some((i) => i.length > 40)) {
        throw badRequest('That\'s a lot to remember — keep it to a few short interests.');
      }
      value = list.length ? JSON.stringify(list) : null;
    } else {
      // A list for a text field would clean to '' and silently clear it — reject instead.
      if (typeof draft.value !== 'string') throw badRequest('I can only remember that as a short piece of text.');
      const text = clean(draft.value);
      if (text.length > spec.max) throw badRequest(`That's too long to remember (max ${spec.max} characters).`);
      if (draft.field === 'travelMode' && text && !['flight', 'train', 'road'].includes(text.toLowerCase())) {
        throw badRequest('I can remember flight, train or road as your usual way of travelling.');
      }
      value = text ? (draft.field === 'travelMode' ? text.toLowerCase() : text) : null;
    }
    await db(`UPDATE profiles SET ${spec.column} = $1, updated_at = NOW() WHERE user_id = $2`, [value, userId]);
    return {
      reply: value ? `Saved — I'll remember ${spec.label} for next time.` : `Done — I've forgotten ${spec.label}.`,
      created: null,
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
