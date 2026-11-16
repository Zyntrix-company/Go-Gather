/**
 * Live Swee journey evaluation (runbook Rounds C and D) against real Gemini — not part of CI.
 *
 * Drives the REAL server code (ai.service chat() and executeAction()) with live Gemini,
 * while the database, conversations, trips/events/activities/notes services are in-memory
 * fakes installed before anything loads. NO database connection is ever made: the
 * config/database module is replaced, so this script cannot touch any database.
 *
 * Part C — Planner v2 journey (SWEE_PLANNER_V2 on, TRIP_TIMEZONES on):
 *   C1 discuss → travel question → itinerary (plan_trip) → refine → pre-filled form
 *      (confirm_trip) → create: the stored plan is used, the model copied no activities,
 *      the plan carries the destination's zone and createTrip gets it.
 *   C2 the form's dates changed → re-plan reply, no trip created.
 *   C3 "no" to planning → no action, offers help.
 *   C4 existing trip "plan my itinerary" → Planner v2 proposal (add_activities with durations).
 *   C5 legacy flow (SWEE_PLANNER_V2 off, TRIP_TIMEZONES on): the trip card carries the zone;
 *      Swee events, destination and venue changes carry the zone too (runbook §3.1 / §3.2).
 * Part D — Phase 3 (all flags on):
 *   D1 home city asked only when missing and travel is needed; offered to save; not asked again.
 *   D2 "I'm vegetarian" → offer to remember → saved; "forget that" → cleared.
 *   D3 saved preferences shape the next plan.
 *
 * Usage (from backend/):  node scripts/swee-journey-eval.js [--part=C|D] [--only=C1,C2]
 * Needs GEMINI_API_KEY (and optional GEMINI_MODEL) in the environment. Exit 1 on any failure.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ─── In-memory fakes (installed before the services load) ─────────────────────

const src = (p) => require.resolve(path.resolve(__dirname, '../src', p));
const fake = (p, exports) => {
  const id = src(p);
  require.cache[id] = { id, filename: id, loaded: true, exports };
  return exports;
};

const USER = '123e4567-e89b-12d3-a456-426614174000';
const GOA_TRIP = '9f1c2d3e-4b5a-4c6d-8e7f-001122334455';
const DUBAI_EVENT = 'eeee0001-0000-4000-8000-000000000001';

let state;
const resetState = (profile = {}) => {
  state = {
    profile: { full_name: 'Test User', country: 'India', timezone: 'Asia/Kolkata', ...profile },
    trips: [{ id: GOA_TRIP, name: 'Goa Dec 2026', location_name: 'Goa', start_date: '2026-12-10', end_date: '2026-12-14', member_names: 'Sam', role: 'admin' }],
    events: [{ id: DUBAI_EVENT, name: 'Team Offsite Dinner', event_date: '2026-12-18', event_type: 'Professional', location_name: 'Mumbai', member_names: 'Sam' }],
    conversations: new Map(),
    calls: { createTrip: [], updateTrip: [], createEvent: [], updateEvent: [], createActivity: [] },
    unknownSql: [],
  };
};
resetState();

const rows = (r) => ({ rows: r, rowCount: r.length });
async function fakeQuery(sql, params = []) {
  if (/FROM profiles p JOIN users u/.test(sql)) return rows([state.profile]);
  if (/FROM trips t\s+JOIN trip_members tm/.test(sql)) {
    if (/tm\.role/.test(sql)) {
      const [, key] = params;
      const like = typeof key === 'string' && key.startsWith('%') ? key.slice(1, -1) : null;
      return rows(state.trips.filter((t) => (like
        ? t.name.toLowerCase().includes(like) || (t.location_name || '').toLowerCase().includes(like)
        : t.id === key)));
    }
    return rows(state.trips);
  }
  if (/FROM events e\s+JOIN event_members/.test(sql)) {
    if (/member_names/.test(sql)) return rows(state.events);
    const [, key] = params;
    const like = typeof key === 'string' && key.startsWith('%') ? key.slice(1, -1) : null;
    return rows(state.events.filter((e) => (like ? e.name.toLowerCase().includes(like) : e.id === key)));
  }
  const profileUpdate = sql.match(/UPDATE profiles SET (\w+) = \$1/);
  if (profileUpdate) {
    const [value] = params;
    state.profile[profileUpdate[1]] = profileUpdate[1] === 'interests' && value ? JSON.parse(value) : value;
    return rows([]);
  }
  if (/trip_companions|COUNT\(\*\)::int AS trips_together|AVG\(amount\)|trip_activities|planning_metadata|SELECT timezone FROM trips/.test(sql)) return rows([]);
  state.unknownSql.push(sql.replace(/\s+/g, ' ').slice(0, 80));
  return rows([]);
}
fake('config/database.js', {
  query: fakeQuery,
  getClient: async () => ({ query: fakeQuery, release() {} }),
  pool: { end: async () => {}, connect: async () => { throw new Error('no database in this eval'); } },
});

let convSeq = 0;
const conv = (id) => state.conversations.get(id);
fake('modules/ai/conversations.service.js', {
  createConversation: async (userId, tripContext) => {
    const id = `conv-${++convSeq}`;
    state.conversations.set(id, { id, userId, tripContext, messages: [], metadata: {} });
    return { id, tripContext };
  },
  getConversation: async (userId, id) => {
    const c = conv(id);
    if (!c || c.userId !== userId) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
    return { id: c.id, tripContext: c.tripContext, metadata: c.metadata };
  },
  loadHistoryForGemini: async (id, max = 10) => {
    const visible = conv(id).messages.filter((m) => m.scope !== 'out');
    return { history: visible.slice(-max).map(({ role, content }) => ({ role, content })), memoryBlock: '', total: visible.length };
  },
  loadLastAssistantMessage: async (id) => {
    const last = [...conv(id).messages].reverse().find((m) => m.role === 'assistant');
    return last ? { content: last.content, refused: last.scope === 'out' } : null;
  },
  appendMessages: async (userId, id, { userContent, assistantContent, scope }) => {
    conv(id).messages.push({ role: 'user', content: userContent, scope }, { role: 'assistant', content: assistantContent, scope });
    return { id: `msg-${conv(id).messages.length}` };
  },
  appendAssistantMessage: async (userId, id, content) => {
    conv(id).messages.push({ role: 'assistant', content });
    return { id: `msg-${conv(id).messages.length}` };
  },
  savePlan: async (userId, id, plan) => { conv(id).metadata.plan = plan; },
});

fake('modules/trips/trips.service.js', {
  createTrip: async (userId, body, opts) => {
    state.calls.createTrip.push(opts ? [userId, body, opts] : [userId, body]);
    return { id: 'trip-new', name: body.name };
  },
  updateTrip: async (...args) => { state.calls.updateTrip.push(args); return {}; },
});
fake('modules/events/events.service.js', {
  createEvent: async (userId, body, opts) => {
    state.calls.createEvent.push(opts ? [userId, body, opts] : [userId, body]);
    return { id: 'event-new', name: body.name };
  },
  updateEvent: async (...args) => { state.calls.updateEvent.push(args); return {}; },
});
fake('modules/trips/submodules/activities/activities.service.js', {
  createActivity: async (tripId, userId, a) => { state.calls.createActivity.push(a); return { id: `act-${state.calls.createActivity.length}` }; },
  notifyItineraryUpdated: () => {},
});
fake('modules/shared/notes/notes.service.js', { createNote: async () => ({ id: 'note-id' }) });
fake('utils/fcm.util.js', {
  createAndSendNotifications: async () => {}, createAndSendNotification: async () => {}, notifySafely: async () => {},
  sendFCMNotification: async () => {}, isInQuietHours: () => false,
});

// ─── Real server code ─────────────────────────────────────────────────────────

const config = require('../src/config');
// Record the model's raw actions (plan_trip / confirm_trip never reach the caller) for --verbose.
const helpers = require('../src/modules/ai/ai.helpers');
const rawActions = [];
const realParse = helpers.parseActionBlock;
helpers.parseActionBlock = (...a) => { const r = realParse(...a); rawActions.push(r.pendingAction || null); return r; };
const aiService = require('../src/modules/ai/ai.service');

config.sweeScopeGuard.mode = 'off'; // scope is Round E (swee-scope-eval.js); saves one call per turn

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const ONLY = args.only ? String(args.only).split(',') : null;

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${String(detail).slice(0, 400)}`}`);
}
const setFlags = (f) => Object.assign(config.featureFlags, { tripTimezones: false, sweePlannerV2: false, profileTravelPrefs: false }, f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One /ai/chat turn through the real chat() handler. */
async function say(session, message, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await aiService.chat(USER, message, { conversationId: session.id, ...opts });
      session.id = r.conversationId;
      session.last = r;
      if (args.verbose) console.log(`      raw: ${JSON.stringify(rawActions[rawActions.length - 1])?.slice(0, 500)}`);
      if (args.verbose) console.log(`    > ${message}\n    < ${r.reply.replace(/\n/g, ' ⏎ ').slice(0, 300)}\n      ${JSON.stringify(r.pendingAction)?.slice(0, 300)}`);
      return r;
    } catch (err) {
      if (attempt < 2 && /503|overloaded|fetch failed|busy/i.test(err.message)) { await sleep(8000 * (attempt + 1)); continue; }
      throw err;
    }
  }
}
const intentOf = (r) => r.pendingAction?.intent || 'none';
const planOf = (session) => conv(session.id)?.metadata?.plan || null;
const isQuestion = (t) => /\?\s*$|\?\s*\n/.test(t);

// ─── Part C ───────────────────────────────────────────────────────────────────

async function c1c2() {
  setFlags({ tripTimezones: true, sweePlannerV2: true });
  resetState();
  const s = {};
  let r = await say(s, 'My wife and I want to spend a week in London from 10 May 2027, flying from Mumbai.');
  check('C1: no plan before travel is settled', !planOf(s) && intentOf(r) !== 'create_trip', `${intentOf(r)} — ${r.reply.slice(0, 160)}`);
  for (let i = 0; i < 3 && !planOf(s); i++) {
    const next = i === 0
      ? (/book|flight|ticket/i.test(r.reply) ? 'Not booked yet, any flight is fine. We like museums, markets and theatre.' : 'Yes please, plan it. Not booked yet, any flight is fine. We like museums, markets and theatre.')
      : 'Yes, go ahead and plan the itinerary.';
    r = await say(s, next);
  }
  const plan1 = planOf(s);
  check('C1: itinerary planned and stored on the conversation', Boolean(plan1), r.reply.slice(0, 200));
  if (!plan1) return;
  check('C1: preview shown in chat', /\*\*.+\*\*/.test(r.reply) && /Want any changes/.test(r.reply), r.reply.slice(0, 200));
  check('C1: plan carries the destination zone (Europe/London)', plan1.facts?.timeZone === 'Europe/London', plan1.facts?.timeZone);
  check('C1: international plan with origin Mumbai', plan1.international === true && /mumbai/i.test(plan1.facts?.origin || ''), JSON.stringify({ i: plan1.international, o: plan1.facts?.origin, oz: plan1.facts?.originTimeZone, z: plan1.facts?.timeZone, fi: plan1.facts?.international }));
  check('C1: plan covers the travel days and has travel legs', plan1.activities.filter((a) => a.kind === 'travel').length === 2,
    plan1.activities.filter((a) => a.kind === 'travel').map((a) => `${a.date} ${a.title}`).join(' | '));

  const refineDay = plan1.activities.find((a) => a.kind === 'activity' && a.date > plan1.startDate)?.date || '2027-05-12';
  const dayLabel = new Date(`${refineDay}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  r = await say(s, `On ${dayLabel}, please add a Thames river cruise.`);
  const plan2 = planOf(s);
  check('C1: refine re-plans and stores a new version', plan2 && plan2.version === plan1.version + 1, `v${plan1.version} → v${plan2?.version} · ${r.reply.slice(0, 160)}`);
  check('C1: refined day includes the Thames cruise', plan2 && plan2.activities.some((a) => a.date === refineDay && /thames|river cruise/i.test(`${a.title} ${a.locationName}`)),
    plan2?.activities.filter((a) => a.date === refineDay).map((a) => a.title).join('; '));
  const keptOther = plan2 && plan1.activities.filter((a) => a.kind === 'activity' && a.date !== refineDay)
    .every((a) => plan2.activities.some((b) => b.date === a.date && b.title === a.title));
  const shape = (f) => JSON.stringify([f?.destination, f?.startDate, f?.endDate, f?.timeZone, f?.origin, f?.travel, f?.busy]);
  check('C1: other days kept as they were', Boolean(keptOther), `same shape=${plan2 && shape(plan1.facts) === shape(plan2.facts)} · before ${shape(plan1.facts)} · after ${plan2 && shape(plan2.facts)}`);

  // Move a planned place to another day: moved (both days re-validated) or an honest "couldn't fit".
  const base = plan2 || plan1;
  const stops = base.activities.filter((a) => a.kind === 'activity');
  const moving = stops.find((a) => a.date !== refineDay) || stops[0];
  const toDay = stops.map((a) => a.date).find((d) => d !== moving?.date && d !== refineDay)
    || stops.map((a) => a.date).find((d) => d !== moving?.date);
  if (moving && toDay) {
    const place = moving.locationName.split(',')[0];
    const toLabel = new Date(`${toDay}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    r = await say(s, `Could you move ${place} to ${toLabel}?`);
    const plan3m = planOf(s);
    const moved = plan3m && plan3m.version === base.version + 1
      && plan3m.activities.some((a) => a.date === toDay && a.locationName === moving.locationName)
      && !plan3m.activities.some((a) => a.date === moving.date && a.locationName === moving.locationName);
    const honestNo = plan3m && plan3m.version === base.version && /nothing (was|has been) changed/i.test(r.reply);
    check('C1: move → place on the new day and off the old one, or an honest "couldn\'t fit"', Boolean(moved || honestNo),
      `${place} ${moving.date} → ${toDay} · v${base.version} → v${plan3m?.version} · ${r.reply.slice(0, 160)}`);
    check('C1: move keeps every other stop', !moved || stops.filter((a) => a !== moving)
      .every((a) => plan3m.activities.some((b) => b.date === a.date && b.locationName === a.locationName)));
  }

  r = await say(s, 'Perfect, that looks good — let\'s create the trip.');
  const form = r.pendingAction;
  check('C1: confirm → pre-filled trip form', form?.intent === 'create_trip' && form?.showForm === 'trip', JSON.stringify(form));
  if (!form?.draft) return;
  const finalPlan = planOf(s);
  check('C1: form pre-filled from the plan (destination, dates, version)',
    form.draft.startDate === finalPlan.startDate && form.draft.endDate === finalPlan.endDate && form.draft.planVersion === finalPlan.version && /london/i.test(form.draft.destination),
    JSON.stringify(form.draft));
  check('C1: the model copied no activities into the form', !Array.isArray(form.draft.activities), JSON.stringify(form.draft).slice(0, 200));

  // C2 — the user changes the end date on the form → re-plan, no trip.
  const newEnd = new Date(Date.parse(`${form.draft.endDate}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const changed = await aiService.executeAction(USER, { ...form, readyToCreate: true, draft: { ...form.draft, endDate: newEnd } }, { conversationId: s.id });
  check('C2: changed dates → re-plan reply, no trip created', !changed.created && state.calls.createTrip.length === 0 && /changed the dates/i.test(changed.reply), changed.reply.slice(0, 200));
  const plan3 = planOf(s);
  check('C2: stored plan moved to the new end date', plan3?.endDate === newEnd && plan3.version === finalPlan.version + 1, `${plan3?.endDate} v${plan3?.version}`);

  // Back to C1: confirm again and submit the form unchanged → created from the stored plan.
  r = await say(s, 'Looks good, bring the form back please.');
  const form2 = r.pendingAction;
  check('C1: form shown again with the new dates', form2?.showForm === 'trip' && form2.draft?.endDate === newEnd, JSON.stringify(form2));
  if (!form2?.draft) return;
  const created = await aiService.executeAction(USER, { ...form2, readyToCreate: true }, { conversationId: s.id });
  const plannedCount = plan3.activities.filter((a) => a.date >= form2.draft.startDate && a.date <= newEnd).length;
  check('C1: trip created', created.created?.type === 'trip', created.reply);
  check('C1: stored plan activities saved (none from the model)', state.calls.createActivity.length === plannedCount && plannedCount > 0,
    `${state.calls.createActivity.length} saved / ${plannedCount} planned`);
  check('C1: saved activities carry kind and duration', state.calls.createActivity.every((a) => ['activity', 'travel'].includes(a.kind) && a.durationMinutes > 0));
  check('C1/TZ: createTrip got timeZoneHint Europe/London', state.calls.createTrip[0]?.[2]?.timeZoneHint === 'Europe/London', JSON.stringify(state.calls.createTrip[0]?.[2]));
}

async function c3() {
  setFlags({ tripTimezones: true, sweePlannerV2: true });
  resetState();
  const s = {};
  let r = await say(s, 'Thinking about Jaipur sometime next month.');
  if (!/plan|set (this|it) up|itinerar|trip/i.test(r.reply)) r = await say(s, 'Maybe for a long weekend.');
  r = await say(s, 'No thanks, I don\'t want you to plan anything.');
  check('C3: "no" → no planning action', !['plan_trip', 'confirm_trip', 'create_trip'].includes(intentOf(r)) && !r.pendingAction?.showForm && !planOf(s),
    `${intentOf(r)} — ${r.reply.slice(0, 160)}`);
  check('C3: offers help instead', /help|anything|let me know|happy to|questions?|whenever/i.test(r.reply), r.reply.slice(0, 200));
}

async function c4() {
  setFlags({ tripTimezones: true, sweePlannerV2: true });
  resetState();
  const s = {};
  const r = await say(s, 'Plan my itinerary for the Goa trip.');
  const acts = r.pendingAction?.draft?.activities || [];
  check('C4: existing trip → add_activities proposal', intentOf(r) === 'add_activities' && r.pendingAction?.tripId === GOA_TRIP, `${intentOf(r)} — ${r.reply.slice(0, 160)}`);
  check('C4: Planner v2 proposal (durations + kinds)', acts.length > 0 && acts.every((a) => a.durationMinutes > 0 && ['activity', 'travel'].includes(a.kind)),
    JSON.stringify(acts[0]));
  check('C4: every proposed date inside the trip', acts.every((a) => a.date >= '2026-12-10' && a.date <= '2026-12-14'));
}

async function c5() {
  setFlags({ tripTimezones: true, sweePlannerV2: false });
  resetState();
  // Legacy trip card carries the destination zone.
  let s = {};
  let r = await say(s, 'Create a trip to Tokyo for me and my sister, I don\'t need an itinerary.');
  if (r.pendingAction?.showForm !== 'trip') r = await say(s, 'Yes, set it up please.');
  check('C5: legacy trip card shown', r.pendingAction?.showForm === 'trip', `${JSON.stringify(r.pendingAction)} — ${r.reply.slice(0, 120)}`);
  check('C5/TZ: legacy trip card draft has timeZone Asia/Tokyo', r.pendingAction?.draft?.timeZone === 'Asia/Tokyo', JSON.stringify(r.pendingAction?.draft));
  if (r.pendingAction?.draft) {
    const d = { ...r.pendingAction.draft, startDate: '2027-04-01', endDate: '2027-04-06', planItinerary: false };
    await aiService.executeAction(USER, { intent: 'create_trip', readyToCreate: true, draft: d }, { conversationId: s.id });
    check('C5/TZ: createTrip got the card zone', state.calls.createTrip[0]?.[2]?.timeZoneHint === 'Asia/Tokyo', JSON.stringify(state.calls.createTrip[0]));
  }

  // §3.1 — Swee event abroad carries the venue's zone.
  s = {};
  r = await say(s, 'Create an event: dinner with friends at a restaurant in Dubai Marina on 20 December 2026 at 8 pm.');
  if (r.pendingAction?.showForm !== 'event') r = await say(s, 'Yes, create it.');
  check('C5: event card shown', r.pendingAction?.showForm === 'event', `${JSON.stringify(r.pendingAction)} — ${r.reply.slice(0, 120)}`);
  check('C5/TZ: event card draft has timeZone Asia/Dubai', r.pendingAction?.draft?.timeZone === 'Asia/Dubai', JSON.stringify(r.pendingAction?.draft));
  if (r.pendingAction?.draft) {
    const d = { ...r.pendingAction.draft, eventDate: r.pendingAction.draft.eventDate || '2026-12-20' };
    await aiService.executeAction(USER, { intent: 'create_event', readyToCreate: true, draft: d }, { conversationId: s.id });
    check('C5/TZ: createEvent got the hint', state.calls.createEvent[0]?.[2]?.timeZoneHint === 'Asia/Dubai', JSON.stringify(state.calls.createEvent[0]));
  }

  // §3.2 — destination renamed through Swee carries the new zone.
  s = {};
  r = await say(s, 'Change the destination of my Goa trip to Lisbon.');
  for (let i = 0; i < 3 && intentOf(r) !== 'update_trip'; i++) r = await say(s, i === 0 ? 'Yes, that one.' : 'Yes, change the destination to Lisbon and save it.');
  check('C5: update_trip proposed', intentOf(r) === 'update_trip', `${intentOf(r)} — ${r.reply.slice(0, 120)}`);
  check('C5/TZ: update_trip draft has timeZone Europe/Lisbon', r.pendingAction?.draft?.timeZone === 'Europe/Lisbon', JSON.stringify(r.pendingAction?.draft));
  if (intentOf(r) === 'update_trip') {
    await aiService.executeAction(USER, { ...r.pendingAction, tripId: GOA_TRIP }, { conversationId: s.id });
    check('C5/TZ: updateTrip got the hint', state.calls.updateTrip[0]?.[2]?.timeZoneHint === r.pendingAction?.draft?.timeZone && Boolean(state.calls.updateTrip[0]?.[2]),
      JSON.stringify(state.calls.updateTrip[0]));
  }

  // Event venue moved abroad through Swee.
  s = {};
  r = await say(s, 'Move my Team Offsite Dinner to a venue in London.');
  for (let i = 0; i < 3 && intentOf(r) !== 'update_event'; i++) r = await say(s, i === 0 ? 'Yes, that one. The venue is Dishoom Covent Garden, London.' : 'Yes, save it.');
  check('C5: update_event proposed', intentOf(r) === 'update_event', `${intentOf(r)} — ${r.reply.slice(0, 120)}`);
  check('C5/TZ: update_event draft has timeZone Europe/London', r.pendingAction?.draft?.timeZone === 'Europe/London', JSON.stringify(r.pendingAction?.draft));
  if (intentOf(r) === 'update_event') {
    await aiService.executeAction(USER, { ...r.pendingAction, eventId: DUBAI_EVENT }, { conversationId: s.id });
    check('C5/TZ: updateEvent got the hint', state.calls.updateEvent[0]?.[2]?.timeZoneHint === 'Europe/London', JSON.stringify(state.calls.updateEvent[0]));
  }
}

// ─── Part D ───────────────────────────────────────────────────────────────────

const ALL_ON = { tripTimezones: true, sweePlannerV2: true, profileTravelPrefs: true };
const asksHomeCity = (t) => /where .*(travel(l)?ing|coming|starting|fly(ing)?|leav(e|ing)) from|from which city|which city .*from|your home city|where are you based|where do you live/i.test(t);

async function d1() {
  setFlags(ALL_ON);
  resetState({ home_city: null, travel_mode_pref: null, interests: null, dietary_needs: null, accessibility_needs: null });
  let s = {};
  let r = await say(s, 'I want to plan a 4-day trip to Udaipur from 15 January 2027.');
  if (!asksHomeCity(r.reply) && /plan|set (this|it) up/i.test(r.reply) && isQuestion(r.reply)) r = await say(s, 'Yes please, plan it.');
  check('D1: home city missing → Swee asks where they travel from', asksHomeCity(r.reply), r.reply.slice(0, 200));
  r = await say(s, 'From Pune.');
  let offer = intentOf(r) === 'save_profile_detail' ? r : null;
  for (let i = 0; i < 2 && !offer; i++) {
    r = await say(s, i === 0 ? 'Not booked yet, a flight is fine.' : 'Sounds good.');
    if (intentOf(r) === 'save_profile_detail') offer = r;
  }
  check('D1: offers to save Pune as home city', offer?.pendingAction?.draft?.field === 'homeCity' && /pune/i.test(offer?.pendingAction?.draft?.value || ''),
    JSON.stringify(offer?.pendingAction || r.pendingAction));
  if (offer) {
    const saved = await aiService.executeAction(USER, offer.pendingAction, { conversationId: s.id });
    check('D1: home city saved', /pune/i.test(state.profile.home_city || ''), saved.reply);
  }
  // A new chat: home city known → not asked again; used as the origin.
  state.profile.home_city = state.profile.home_city || 'Pune';
  s = {};
  r = await say(s, 'Plan a 3-day trip to Jaipur from 5 February 2027, not booked yet, train is fine.');
  for (let i = 0; i < 2 && !planOf(s); i++) r = await say(s, 'Yes, go ahead and plan it.');
  const all = conv(s.id).messages.filter((m) => m.role === 'assistant').map((m) => m.content).join('\n');
  check('D1: home city saved → never asked again', !asksHomeCity(all), all.slice(0, 200));
  check('D1: saved home city used as the origin', /pune/i.test(planOf(s)?.facts?.origin || '') || /pune/i.test(all), planOf(s)?.facts?.origin);
}

async function d2() {
  setFlags(ALL_ON);
  resetState({ home_city: 'Pune' });
  const s = {};
  let r = await say(s, 'By the way, I\'m vegetarian.');
  if (intentOf(r) !== 'save_profile_detail') r = await say(s, 'Can you remember that?');
  check('D2: offers to remember (dietaryNeeds)', intentOf(r) === 'save_profile_detail' && r.pendingAction?.draft?.field === 'dietaryNeeds' && /veg/i.test(r.pendingAction?.draft?.value || ''),
    JSON.stringify(r.pendingAction));
  if (intentOf(r) === 'save_profile_detail') {
    await aiService.executeAction(USER, r.pendingAction, { conversationId: s.id });
    check('D2: saved', /veg/i.test(state.profile.dietary_needs || ''), state.profile.dietary_needs);
  }
  state.profile.dietary_needs = state.profile.dietary_needs || 'vegetarian';
  r = await say(s, 'Actually, forget that I\'m vegetarian.');
  if (intentOf(r) !== 'save_profile_detail') r = await say(s, 'Yes, please forget it.');
  check('D2: "forget that" → clear action', intentOf(r) === 'save_profile_detail' && r.pendingAction?.draft?.field === 'dietaryNeeds' && !String(r.pendingAction?.draft?.value ?? '').trim(),
    JSON.stringify(r.pendingAction));
  if (intentOf(r) === 'save_profile_detail') {
    await aiService.executeAction(USER, r.pendingAction, { conversationId: s.id });
    check('D2: cleared', state.profile.dietary_needs == null, state.profile.dietary_needs);
  }
}

async function d3() {
  setFlags(ALL_ON);
  resetState({ home_city: 'Pune', travel_mode_pref: 'train', interests: ['history', 'street food'], dietary_needs: 'vegetarian' });
  const s = {};
  let r = await say(s, 'Plan a 3-day trip to Lucknow from 12 March 2027 for me, not booked yet.');
  for (let i = 0; i < 2 && !planOf(s); i++) r = await say(s, 'Yes, go ahead and plan it.');
  const plan = planOf(s);
  check('D3: planned without asking for saved details', Boolean(plan) && !asksHomeCity(r.reply), r.reply.slice(0, 200));
  if (!plan) return;
  const f = plan.facts || {};
  const prefsText = `${(f.interests || []).join(' ')} ${f.preferences || ''}`.toLowerCase();
  check('D3: saved origin + usual travel mode used', /pune/i.test(f.origin || '') && f.travel?.mode === 'train', JSON.stringify({ o: f.origin, m: f.travel?.mode }));
  check('D3: saved interests / diet passed to the planner', /history|street food|vegetarian|veg/.test(prefsText), prefsText);
  const text = plan.activities.map((a) => `${a.title} ${a.locationName} ${a.description || ''}`).join(' ').toLowerCase();
  check('D3: the plan reflects the interests (history / food)', /fort|museum|imambara|residency|histor|heritage|food|chaat|kebab|market|bazaar/.test(text), text.slice(0, 200));
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const CASES = { C1: c1c2, C3: c3, C4: c4, C5: c5, D1: d1, D2: d2, D3: d3 };

async function main() {
  if (!config.gemini.apiKey) {
    console.error('GEMINI_API_KEY is not set.');
    process.exit(2);
  }
  console.log(`Swee journey eval · model=${config.gemini.model}\n`);
  const names = Object.keys(CASES).filter((n) => (!args.part || n.startsWith(String(args.part))) && (!ONLY || ONLY.includes(n)));
  for (const n of names) {
    console.log(`── ${n} ──`);
    try {
      await CASES[n]();
    } catch (err) {
      check(`${n} run`, false, err.message);
    }
    if (state.unknownSql.length) console.log(`    (fake db: unhandled ${[...new Set(state.unknownSql)].join(' | ')})`);
  }
  console.log(`\n${failures === 0 ? 'All checks passed' : `${failures} check(s) failed`}`);
  process.exit(failures ? 1 : 0);
}

main();
