/**
 * Live Swee itinerary evaluation against real Gemini (not part of CI — costs API calls).
 *
 * Part 1 — generator: plans 3-, 7- and 14-day trips and checks every day has exactly
 *          3 activities (morning/afternoon/evening), each with a named place, no repeats.
 * Part 2 — chat: checks Swee asks about an itinerary before the trip card, passes the answer
 *          through the card draft, hands existing trips to the planner, and writes every day
 *          when asked for an itinerary in chat.
 *
 * Usage:  node backend/scripts/swee-itinerary-eval.js [--part=1|2]
 * Needs GEMINI_API_KEY in backend/.env. No database access. Exit code 1 on any failure.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = require('../src/config');
const { buildSweetSystemPrompt } = require('../src/modules/ai/swee.config');
const { parseActionBlock } = require('../src/modules/ai/ai.helpers');
const { buildMessageParts } = require('../src/modules/ai/ai.service');
const { generateItinerary, enumerateDates } = require('../src/modules/ai/swee.itinerary');
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
      history.push({ role: 'user', content: message }, { role: 'assistant', content: parsed.reply });
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
  console.log(`\n${failures === 0 ? 'All checks passed' : `${failures} check(s) failed`}`);
  await pool.end().catch(() => {});
  process.exit(failures ? 1 : 0);
}

main();
