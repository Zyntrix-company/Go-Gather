/**
 * Live Swee itinerary evaluation against real Gemini (not part of CI — costs API calls).
 *
 * Part 1 — generator: plans 3-, 7- and 14-day trips and checks every day has exactly
 *          3 activities (morning/afternoon/evening), each with a named place, no repeats.
 * Part 2 — chat: checks Swee asks about an itinerary before the trip card, passes the answer
 *          through the card draft, hands existing trips to the planner, and writes every day
 *          when asked for an itinerary in chat.
 * Part 3 — Planner v2 (SWEE_PLANNER_V2): Delhi 14-day work trip (0 weekday activities 09:00–17:00),
 *          Goa holiday, London international (dual times + visa line), booked flight times,
 *          overnight train, Kerala 7 days. Every activity inside its free window, no overlaps
 *          incl. travel, legs on the first/last day, no repeats.
 * Part 4 — Planner v2 chat journey: discuss → plan_trip with structured facts → confirm_trip.
 *
 * Usage:  node backend/scripts/swee-itinerary-eval.js [--part=1|2|3|4]
 * Needs GEMINI_API_KEY in backend/.env. No database access. Exit code 1 on any failure.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = require('../src/config');
const { buildSweetSystemPrompt } = require('../src/modules/ai/swee.config');
const { parseActionBlock } = require('../src/modules/ai/ai.helpers');
const { buildMessageParts } = require('../src/modules/ai/ai.service');
const {
  generateItinerary, enumerateDates, generatePlan, sanitizePlanFacts, formatPlanPreview,
} = require('../src/modules/ai/swee.itinerary');
const { pool } = require('../src/config/database');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const TRIP_ID = '9f1c2d3e-4b5a-4c6d-8e7f-001122334455';
const USER_CONTEXT = {
  profile: { full_name: 'Test User', country: 'India', timezone: 'Asia/Kolkata' },
  trips: [{ id: TRIP_ID, name: 'Goa Dec 2026', location_name: 'Goa', start_date: '2026-12-10', end_date: '2026-12-14', member_names: 'Sam' }],
  events: [],
  frequentCompanions: [],
  budgetTier: 'Comfort',
};

let failures = 0;
/** Quality signal only — printed, never fails the run. */
function soft(label, ok, detail = '') {
  console.log(`${ok ? '·' : '~'} (soft) ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── Part 1: generator ────────────────────────────────────────────────────────

const WINDOWS = { morning: ['08:00', '11:30'], afternoon: ['12:30', '16:30'], evening: ['17:30', '21:30'] };
const slotOf = (t) => Object.keys(WINDOWS).find((s) => t >= WINDOWS[s][0] && t <= WINDOWS[s][1]);

async function evalGenerator(name, trip, start, end) {
  const dates = enumerateDates(start, end);
  const t0 = Date.now();
  let plan;
  try {
    plan = await generateItinerary({ ...trip, dates, tripStart: start, tripEnd: end });
  } catch (err) {
    check(`${name}: generated`, false, err.message);
    return;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const acts = plan.activities;
  check(`${name}: ${dates.length} days → ${acts.length} activities in ${secs}s`, acts.length === dates.length * 3,
    `expected ${dates.length * 3}, missing ${plan.missing.length}`);

  const badDays = dates.filter((d) => {
    const day = acts.filter((a) => a.date === d);
    const slots = day.map((a) => slotOf(a.time));
    return day.length !== 3 || !['morning', 'afternoon', 'evening'].every((s) => slots.includes(s));
  });
  check(`${name}: every day has morning + afternoon + evening`, badDays.length === 0, badDays.join(', '));
  check(`${name}: every activity has a named place`, acts.every((a) => a.locationName && a.locationName.length >= 3));
  check(`${name}: all dates inside the trip`, acts.every((a) => a.date >= start && a.date <= end));
  const places = acts.map((a) => a.locationName.toLowerCase());
  check(`${name}: no repeated places`, new Set(places).size === places.length,
    places.filter((p, i) => places.indexOf(p) !== i).join('; '));
  check(`${name}: titles ≤ 35 chars`, acts.every((a) => a.title.length <= 35));
  console.log(`    sample: ${acts.slice(0, 3).map((a) => `${a.time} ${a.title} @ ${a.locationName}`).join(' | ')}`);
}

// ─── Part 2: chat behaviour ───────────────────────────────────────────────────

let _genAI = null;
function mainModel(systemPrompt) {
  if (!_genAI) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    _genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return _genAI.getGenerativeModel({ model: config.gemini.model, systemInstruction: systemPrompt });
}

function toGeminiHistory(history) {
  return history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
}

async function turn(history, message, tripContext = null) {
  const systemPrompt = buildSweetSystemPrompt(USER_CONTEXT, tripContext, history.length, '');
  for (let attempt = 0; ; attempt++) {
    try {
      const chat = mainModel(systemPrompt).startChat({ history: toGeminiHistory(history) });
      const res = await chat.sendMessage(buildMessageParts(message, []));
      const raw = res.response.text();
      const actionMatch = raw.match(/###ACTION(\{.*\})\s*$/s);
      let action = null;
      try { action = actionMatch ? JSON.parse(actionMatch[1]) : null; } catch { /* reported below */ }
      const parsed = parseActionBlock(raw);
      // Like /ai/chat: after plan_trip the server appends the itinerary preview to Swee's message.
      const stored = config.featureFlags.sweePlannerV2 && action?.intent === 'plan_trip'
        ? `${parsed.reply}\n\n**Sun 6 Dec** — 06:00 Flight Pune → Delhi · 12:30 India Gate\n**Mon 7 Dec** — 18:30 Dinner at Connaught Place\n\nWant any changes? When it looks right, tell me and I'll set up the trip.`
        : parsed.reply;
      history.push({ role: 'user', content: message }, { role: 'assistant', content: stored });
      return { reply: parsed.reply, action };
    } catch (err) {
      if (attempt < 2 && /429|503|overloaded|fetch failed/i.test(err.message)) {
        await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

async function evalChat() {
  config.featureFlags.sweePlannerV2 = false; // today's flow (b00f5f5)
  // a/b. New trip: asks about an itinerary first, then passes the answer through the card.
  let h = [];
  // (Kerala — the test user already has a Goa trip, which Swee rightly offers to plan instead.)
  let r = await turn(h, 'Plan a trip to Kerala');
  check('create: asks about an itinerary before the card', /itinerar/i.test(r.reply) && r.action?.showForm !== 'trip',
    `showForm=${r.action?.showForm} reply="${r.reply.slice(0, 120)}"`);
  r = await turn(h, 'yes please, we love backwaters and seafood, must see Munnar tea gardens');
  const d = r.action?.draft || {};
  check('create: card shown with planItinerary true', r.action?.showForm === 'trip' && d.planItinerary === true,
    JSON.stringify(r.action));
  check('create: preferences passed in itineraryPrefs', typeof d.itineraryPrefs === 'string' && /backwater|seafood|munnar/i.test(d.itineraryPrefs),
    d.itineraryPrefs);
  check('create: Swee did not write activities herself', !Array.isArray(d.activities) || d.activities.length === 0);

  // c. User already said no → straight to the card, no itinerary.
  h = [];
  r = await turn(h, 'Create a trip to Jaipur for me, I don\'t need an itinerary');
  check('create (no itinerary): card shown directly with planItinerary false/absent',
    r.action?.showForm === 'trip' && r.action?.draft?.planItinerary !== true, JSON.stringify(r.action));

  // d. Existing trip → handed to the planner.
  h = [];
  r = await turn(h, 'Plan the full itinerary for my Goa trip');
  check('existing trip: emits plan_itinerary with the trip id',
    r.action?.intent === 'plan_itinerary' && r.action?.tripId === TRIP_ID, JSON.stringify(r.action));
  check('existing trip: no activity list written by Swee', !/\|\s*Day\s*\|/.test(r.reply) && r.reply.split('\n').length <= 4,
    r.reply.slice(0, 160));
  check('existing trip: no question asked alongside the plan', !r.reply.trim().endsWith('?'), r.reply.slice(0, 160));

  // e. Chat-only itinerary covers every day with 3 activities.
  h = [];
  r = await turn(h, 'Suggest a 4-day itinerary for Jaipur, just ideas for now');
  const mentionsDay4 = /day\s*4|4th day|fourth day/i.test(r.reply);
  const timeOrSlotLines = r.reply.split('\n').filter((l) => /(morning|afternoon|evening|\d{1,2}:\d{2})/i.test(l)).length;
  check('chat itinerary: covers all 4 days', mentionsDay4, r.reply.slice(-200));
  check('chat itinerary: ~3 activities per day (≥ 12 slot lines)', timeOrSlotLines >= 12, `${timeOrSlotLines} lines`);
  console.log(`    words: ${r.reply.split(/\s+/).length}`);
}

// ─── Part 3: Planner v2 generator ─────────────────────────────────────────────

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const weekday = (d) => new Date(`${d}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat

async function evalPlanner(name, draft, extraChecks = () => {}) {
  const facts = sanitizePlanFacts(draft);
  const t0 = Date.now();
  let plan;
  try {
    plan = await generatePlan(facts);
  } catch (err) {
    check(`${name}: planned`, false, err.message);
    return;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const acts = plan.activities.filter((a) => a.kind === 'activity');
  const legs = plan.activities.filter((a) => a.kind === 'travel');
  check(`${name}: ${acts.length} activities + ${legs.length} legs in ${secs}s (repaired ${plan.repaired}, dropped ${plan.droppedDates.length})`,
    acts.length > 0 && plan.droppedDates.length <= Math.ceil(plan.plannedDates.length / 7), plan.droppedDates.join(', '));

  const windows = new Map(plan.windows.map((d) => [d.date, d.windows]));
  const outside = acts.filter((a) => {
    const s = toMin(a.time);
    return !(windows.get(a.date) || []).some((w) => s >= w.from && s + a.durationMinutes <= w.to);
  });
  check(`${name}: every activity inside a free window`, outside.length === 0, outside.map((a) => `${a.date} ${a.time} ${a.title}`).join('; '));

  const overlaps = [];
  const sorted = [...plan.activities].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1];
    const c = sorted[i];
    if (p.date === c.date && toMin(c.time) < toMin(p.time) + p.durationMinutes + (c.travelMinutesFromPrevious || 0)) {
      overlaps.push(`${c.date} ${p.time}/${c.time}`);
    }
  }
  check(`${name}: no overlaps incl. travel time`, overlaps.length === 0, overlaps.join('; '));
  check(`${name}: all dates inside the trip`, plan.activities.every((a) => a.date >= plan.startDate && a.date <= plan.endDate));
  const places = acts.map((a) => a.locationName.toLowerCase());
  check(`${name}: no repeated places`, new Set(places).size === places.length, places.filter((x, i) => places.indexOf(x) !== i).join('; '));
  check(`${name}: durations set (15–600 min)`, acts.every((a) => a.durationMinutes >= 15 && a.durationMinutes <= 600));
  const words = (t) => t.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4);
  const named = acts.filter((a) => words(a.title).some((w) => words(a.locationName).includes(w)));
  soft(`${name}: titles name their place (≥ 60%; the preview adds the place when they don't)`, named.length >= acts.length * 0.6,
    acts.filter((a) => !named.includes(a)).map((a) => `${a.title} @ ${a.locationName}`).slice(0, 5).join('; '));
  if (facts.purpose === 'holiday') {
    const full = plan.windows.filter((d) => d.windows.reduce((m, w) => m + w.to - w.from, 0) >= 600);
    const avg = full.length ? full.reduce((n, d) => n + acts.filter((a) => a.date === d.date).length, 0) / full.length : 0;
    // Multi-base trips (Kerala) spend part of some days moving between towns.
    soft(`${name}: full free days hold 2.5+ activities on average`, full.length === 0 || avg >= 2.5, avg.toFixed(1));
  }
  if (facts.origin && facts.travel) {
    check(`${name}: travel legs on the first and last day`,
      legs.length === 2 && legs[0].date === plan.startDate && legs[1].date === plan.endDate,
      legs.map((l) => `${l.date} ${l.time} ${l.title}`).join(' | '));
  }
  extraChecks(plan, acts, legs);
  const preview = formatPlanPreview(plan, facts.destination);
  console.log(`    ${preview.split('\n').slice(0, 4).join('\n    ')}`);
  return plan;
}

async function evalPlannerV2() {
  config.featureFlags.sweePlannerV2 = true;

  await evalPlanner('Delhi 14-day work trip', {
    destination: 'Delhi', startDate: '2026-12-06', endDate: '2026-12-19', timeZone: 'Asia/Kolkata',
    origin: 'Pune', originTimeZone: 'Asia/Kolkata', purpose: 'work',
    busy: [{ days: 'weekdays', from: '09:00', to: '17:00' }],
    travel: { mode: 'flight', booked: false, onboardMinutes: 130 }, adults: 1, pace: 'moderate',
    preferences: 'history, street food, markets',
  }, (plan, acts) => {
    const clash = acts.filter((a) => {
      const wd = weekday(a.date);
      const s = toMin(a.time);
      return wd >= 1 && wd <= 5 && s < 17 * 60 && s + a.durationMinutes > 9 * 60;
    });
    check('Delhi: 0 weekday activities between 09:00 and 17:00', clash.length === 0, clash.map((a) => `${a.date} ${a.time}`).join('; '));
    const perDay = (d) => acts.filter((a) => a.date === d).length;
    const weekdays = enumerateDates('2026-12-07', '2026-12-18').filter((d) => weekday(d) >= 1 && weekday(d) <= 5);
    check('Delhi: weekday evenings hold 1–2 activities', weekdays.every((d) => perDay(d) <= 2), weekdays.map((d) => perDay(d)).join(','));
    check('Delhi: free Saturdays hold 3+ activities', ['2026-12-12'].every((d) => perDay(d) >= 3), `${perDay('2026-12-12')}`);
  });

  await evalPlanner('Goa holiday 4 days', {
    destination: 'Goa', startDate: '2026-12-10', endDate: '2026-12-13', timeZone: 'Asia/Kolkata',
    origin: 'Mumbai', originTimeZone: 'Asia/Kolkata', purpose: 'holiday',
    travel: { mode: 'flight', booked: false, onboardMinutes: 75 }, adults: 4, groupType: 'Friends',
    interests: ['beaches', 'seafood', 'nightlife'],
  });

  await evalPlanner('London international 7 days', {
    destination: 'London, UK', startDate: '2027-05-10', endDate: '2027-05-16', timeZone: 'Europe/London',
    origin: 'Mumbai', originTimeZone: 'Asia/Kolkata', international: true, purpose: 'holiday',
    travel: { mode: 'flight', booked: false, onboardMinutes: 600 }, adults: 2, groupType: 'Couple',
  }, (plan, acts, legs) => {
    check('London: legs show both local times', legs.every((l) => /Departs .+\(.+\), arrives .+\(.+\)/.test(l.description)),
      legs.map((l) => l.description).join(' | '));
    check('London: visa line in the preview', /visa requirements/.test(formatPlanPreview(plan, 'London, UK')));
  });

  await evalPlanner('Booked flight times (Jaipur)', {
    destination: 'Jaipur', startDate: '2027-01-15', endDate: '2027-01-18', timeZone: 'Asia/Kolkata',
    origin: 'Bengaluru', originTimeZone: 'Asia/Kolkata', purpose: 'holiday',
    travel: {
      mode: 'flight', booked: true,
      outbound: { departDate: '2027-01-15', departTime: '13:00', arriveDate: '2027-01-15', arriveTime: '15:40' },
      return: { departDate: '2027-01-18', departTime: '19:30', arriveDate: '2027-01-18', arriveTime: '22:10' },
    },
    adults: 2,
  }, (plan, acts, legs) => {
    check('Booked: outbound leg leaves 2 h before the 13:00 flight', legs[0]?.time === '11:00', legs[0]?.time);
    check('Booked: nothing on arrival day before 16:55 (15:40 + transfer + settle)',
      acts.filter((a) => a.date === '2027-01-15').every((a) => toMin(a.time) >= toMin('16:55')));
    check('Booked: nothing on departure day after the 17:30 leave-by',
      acts.filter((a) => a.date === '2027-01-18').every((a) => toMin(a.time) + a.durationMinutes <= toMin('17:00')));
  });

  await evalPlanner('Overnight train Delhi → Mumbai', {
    destination: 'Mumbai', startDate: '2027-02-05', endDate: '2027-02-08', timeZone: 'Asia/Kolkata',
    origin: 'Delhi', originTimeZone: 'Asia/Kolkata', purpose: 'holiday',
    travel: { mode: 'train', booked: false, onboardMinutes: 960 }, adults: 2,
  }, (plan, acts, legs) => {
    check('Overnight: outbound leg starts the evening before arrival', legs[0]?.date === '2027-02-04' && toMin(legs[0].time) >= 18 * 60,
      `${legs[0]?.date} ${legs[0]?.time}`);
    check('Overnight: trip start includes the travel day', plan.startDate === '2027-02-04', plan.startDate);
  });

  await evalPlanner('Kerala 7 days', {
    destination: 'Kerala (Kochi, Munnar, Alleppey)', startDate: '2027-03-01', endDate: '2027-03-07', timeZone: 'Asia/Kolkata',
    origin: 'Chennai', originTimeZone: 'Asia/Kolkata', purpose: 'holiday',
    travel: { mode: 'flight', booked: false, onboardMinutes: 80 }, adults: 2, kids: 1, groupType: 'Family',
    interests: ['backwaters', 'tea gardens', 'seafood'],
  });
}

// ─── Part 4: Planner v2 chat journey ──────────────────────────────────────────

async function evalJourney() {
  config.featureFlags.sweePlannerV2 = true;
  const h = [];
  let r = await turn(h, 'I have an office visit in Delhi for two weeks from 6 December. Office is 9 to 5, but I want to explore in the evenings and on weekends.');
  check('journey: no plan before travel is discussed', r.action?.intent !== 'plan_trip' && r.action?.showForm !== 'trip',
    `${JSON.stringify(r.action)} — "${r.reply.slice(0, 140)}"`);
  // Ask-first: Swee may offer to plan before asking about travel — accept the offer.
  check('journey: asks about travel or offers to plan', /from|travel|book|flight|train|plan|set this up/i.test(r.reply), r.reply.slice(0, 160));
  if (!/from|book|flight|train/i.test(r.reply)) r = await turn(h, 'Yes please, plan it.');
  r = await turn(h, 'From Pune. Not booked yet.');
  if (r.action?.intent !== 'plan_trip') {
    r = await turn(h, 'A morning flight is fine, go ahead and plan it.');
  }
  const d = r.action?.draft || {};
  check('journey: sends plan_trip with structured facts', r.action?.intent === 'plan_trip'
    && d.destination && d.startDate === '2026-12-06' && d.endDate >= '2026-12-19', JSON.stringify(r.action));
  check('journey: busy hours sent (weekdays 09:00–17:00)', Array.isArray(d.busy)
    && d.busy.some((b) => b.days === 'weekdays' && /^0?9:00$/.test(b.from) && b.to === '17:00'), JSON.stringify(d.busy));
  check('journey: travel mode flight from Pune', d.travel?.mode === 'flight' && /pune/i.test(d.origin || ''), JSON.stringify({ origin: d.origin, travel: d.travel }));
  check('journey: Swee wrote only a short lead-in', r.reply.split('\n').filter(Boolean).length <= 3, r.reply.slice(0, 200));
  check('journey: no invented preferences (the user gave none)', !/history|street food/i.test(d.preferences || ''), d.preferences);
  check('journey: no prices', !/₹|\$\s?\d|€\s?\d|INR|price/i.test(r.reply), r.reply.slice(0, 200));

  r = await turn(h, 'Looks good, let\'s create the trip.');
  check('journey: confirm_trip on "looks good"', r.action?.intent === 'confirm_trip', JSON.stringify(r.action));

  const h2 = [];
  r = await turn(h2, 'What\'s Kerala like in March?');
  check('ideas only: no planning action', !['plan_trip', 'confirm_trip'].includes(r.action?.intent), JSON.stringify(r.action));
}

async function main() {
  if (!config.gemini.apiKey) {
    console.error('GEMINI_API_KEY is not set (backend/.env).');
    process.exit(2);
  }
  console.log(`Swee itinerary eval · model=${config.gemini.model}\n`);
  if (!args.part || args.part === '1') {
    console.log('── Part 1: generator ──');
    await evalGenerator('Goa 3 days', { destination: 'Goa', travellers: { adults: 4 }, groupType: 'Friends', travelFocus: ['Beaches', 'Nightlife'] }, '2026-12-10', '2026-12-12');
    await evalGenerator('Bali 7 days', { destination: 'Bali', travellers: { adults: 2 }, groupType: 'Couple', budgetTier: 'Premium', preferences: 'temples, rice terraces, sunsets' }, '2027-03-01', '2027-03-07');
    await evalGenerator('Japan 14 days', { destination: 'Japan (Tokyo, Kyoto, Osaka)', travellers: { adults: 2, kids: 1 }, groupType: 'Family' }, '2027-04-01', '2027-04-14');
  }
  if (!args.part || args.part === '2') {
    console.log('\n── Part 2: chat behaviour ──');
    try {
      await evalChat();
    } catch (err) {
      check('chat run', false, err.message);
    }
  }
  if (!args.part || args.part === '3') {
    console.log('\n── Part 3: Planner v2 ──');
    try {
      await evalPlannerV2();
    } catch (err) {
      check('planner v2 run', false, err.message);
    }
  }
  if (!args.part || args.part === '4') {
    console.log('\n── Part 4: Planner v2 chat journey ──');
    try {
      await evalJourney();
    } catch (err) {
      check('journey run', false, err.message);
    }
  }
  console.log(`\n${failures === 0 ? 'All checks passed' : `${failures} check(s) failed`}`);
  await pool.end().catch(() => {});
  process.exit(failures ? 1 : 0);
}

main();
