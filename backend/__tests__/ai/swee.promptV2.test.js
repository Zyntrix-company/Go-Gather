/**
 * Swee prompt with SWEE_PLANNER_V2:
 *  - flag off → byte-identical to the prompt before Planner v2 (fixture captured from b00f5f5-era code)
 *  - flag on  → the six-stage planning journey, plan_trip / confirm_trip, scope rules unchanged
 * Also locks the flag-aware add_activities cap (90 off, appLimits on).
 */
const config = require('../../src/config');
const { limits } = require('../../src/config/appLimits');
const { buildSweetSystemPrompt } = require('../../src/modules/ai/swee.config');
const { validatePendingAction, parseActionBlock } = require('../../src/modules/ai/ai.helpers');
const fixture = require('./fixtures/swee-prompt-legacy.json');

const TRIP_ID = '9f1c2d3e-4b5a-4c6d-8e7f-001122334455';
const CTX = {
  profile: { full_name: 'Asha Rao', country: 'India', timezone: 'Asia/Kolkata' },
  trips: [{ id: TRIP_ID, name: 'Goa Dec 2026', location_name: 'Goa', start_date: '2026-12-10', end_date: '2026-12-14', member_names: 'Sam' }],
  events: [{ id: '8f1c2d3e-4b5a-4c6d-8e7f-001122334455', name: 'Dinner', location_name: 'Pune', event_date: '2026-12-20', member_names: null }],
  frequentCompanions: [{ full_name: 'Sam', trips_together: 2 }],
  budgetTier: 'Comfort',
};
const TRIP_CONTEXT = {
  id: TRIP_ID, name: 'Goa Dec 2026', destination: 'Goa', startDate: '2026-12-10', endDate: '2026-12-14', memberCount: 2, contextType: 'trip',
};

const prompts = () => ({
  empty: buildSweetSystemPrompt(null, null, 0, '', ''),
  full: buildSweetSystemPrompt(CTX, TRIP_CONTEXT, 4, 'User: hi', 'Not my thing'),
});

describe('Swee prompt — Planner v2 flag', () => {
  const saved = { ...config.featureFlags };

  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-11-15T06:00:00Z'), doNotFake: ['setTimeout', 'setImmediate', 'nextTick'] });
  });
  afterAll(() => {
    jest.useRealTimers();
    Object.assign(config.featureFlags, saved);
  });
  afterEach(() => { Object.assign(config.featureFlags, saved); });

  it('flag off: prompt is byte-identical to today\'s', () => {
    config.featureFlags.sweePlannerV2 = false;
    config.featureFlags.tripTimezones = false;
    config.featureFlags.profileTravelPrefs = false;
    const p = prompts();
    expect(p.empty).toBe(fixture.empty);
    expect(p.full).toBe(fixture.full);
  });

  it('flag on: six-stage journey and the new intents; scope section unchanged', () => {
    config.featureFlags.sweePlannerV2 = true;
    const { full } = prompts();
    for (const stage of ['STAGE 1 — DISCUSS', 'STAGE 2 — TRAVEL', 'STAGE 3 — ITINERARY', 'STAGE 4 — REFINE', 'STAGE 5 — CONFIRM', 'STAGE 6 — CREATE']) {
      expect(full).toContain(stage);
    }
    expect(full).toMatch(/"plan_trip" \| "confirm_trip"/);
    expect(full).toMatch(/Do NOT ask about pace/);
    expect(full).toMatch(/Never show prices and never offer to book/);
    expect(full).not.toContain('CREATE FLOW — TRIPS (form-driven)');
    expect(full).not.toMatch(/\$\{|LEGACY_|PLANNER_/);
    const scope = (s) => s.slice(s.indexOf('SCOPE (HIGHEST PRIORITY'), s.indexOf('WHAT YOU CAN ACTUALLY DO'));
    expect(scope(full)).toBe(scope(fixture.full));
  });
});

describe('add_activities cap follows the flag', () => {
  const saved = { ...config.featureFlags };
  afterEach(() => { Object.assign(config.featureFlags, saved); });
  const acts = (n) => Array.from({ length: n }, (_, i) => ({ title: `A${i}`, date: '2026-12-01', time: '10:00' }));
  const action = (n) => ({ intent: 'add_activities', readyToCreate: true, tripId: TRIP_ID, draft: { activities: acts(n) } });

  it('flag off: 90 max (today)', () => {
    config.featureFlags.sweePlannerV2 = false;
    expect(validatePendingAction(action(90)).valid).toBe(true);
    expect(validatePendingAction(action(91)).reason).toBe('add_activities_too_many');
  });

  it('flag on: itineraryMaxActivities from appLimits', () => {
    config.featureFlags.sweePlannerV2 = true;
    expect(validatePendingAction(action(limits.itineraryMaxActivities)).valid).toBe(true);
    const parsed = parseActionBlock(`Table\n###ACTION${JSON.stringify(action(limits.itineraryMaxActivities + 1))}`);
    expect(parsed.pendingAction).toBeNull();
    expect(parsed.reply).toMatch(new RegExp(`up to ${limits.itineraryMaxActivities} activities at a time`));
  });

  it('planner intents are valid only with the flag on', () => {
    const plan = { intent: 'plan_trip', readyToCreate: false, draft: { destination: 'Goa', startDate: '2026-12-01', endDate: '2026-12-03' } };
    config.featureFlags.sweePlannerV2 = false;
    expect(validatePendingAction(plan).reason).toBe('invalid_intent');
    expect(validatePendingAction({ intent: 'confirm_trip', readyToCreate: false }).reason).toBe('invalid_intent');
    config.featureFlags.sweePlannerV2 = true;
    expect(validatePendingAction(plan).valid).toBe(true);
    expect(validatePendingAction({ intent: 'confirm_trip', readyToCreate: false }).valid).toBe(true);
  });
});
