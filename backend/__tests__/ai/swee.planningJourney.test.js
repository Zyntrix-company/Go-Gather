/**
 * Swee planning journey (SWEE_PLANNER_V2) in ai.service:
 *  - chat(): plan_trip plans + stores the plan on the conversation and shows the preview;
 *    refine re-plans only the asked days; confirm_trip returns the pre-filled trip form
 *  - executeAction(create_trip): reads the stored plan (owner only), saves its activities;
 *    changed dates → re-plan and ask again, no trip
 *  - plan_itinerary (existing trip) uses Planner v2
 *  - flag off: the new intents are invalid and create_trip ignores any plan (today's flow)
 */

const mockSendMessage = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(() => ({ startChat: jest.fn(() => ({ sendMessage: mockSendMessage })) })),
  })),
}));

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

jest.mock('../../src/config/aws', () => ({
  s3Client: {},
  sesClient: { send: jest.fn() },
  snsClient: { send: jest.fn() },
}));

jest.mock('../../src/modules/ai/conversations.service', () => ({
  getConversation: jest.fn(),
  createConversation: jest.fn(),
  loadHistoryForGemini: jest.fn(),
  loadLastAssistantMessage: jest.fn(),
  appendMessages: jest.fn(),
  appendAssistantMessage: jest.fn(),
  savePlan: jest.fn(),
}));

jest.mock('../../src/modules/ai/swee.scopeGuard', () => ({
  checkScope: jest.fn(),
  awaitVerdict: jest.fn((p) => p),
}));

jest.mock('../../src/modules/ai/swee.config', () => {
  const actual = jest.requireActual('../../src/modules/ai/swee.config');
  return { ...actual, loadUserContext: jest.fn().mockResolvedValue({ profile: null, trips: [], events: [] }) };
});

jest.mock('../../src/modules/ai/swee.itinerary', () => {
  const actual = jest.requireActual('../../src/modules/ai/swee.itinerary');
  return { ...actual, generateItinerary: jest.fn(), generatePlan: jest.fn() };
});

jest.mock('../../src/utils/fcm.util', () => ({
  createAndSendNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/modules/trips/trips.service', () => ({
  createTrip: jest.fn(),
}));

jest.mock('../../src/modules/shared/notes/notes.service', () => ({
  createNote: jest.fn().mockResolvedValue({ id: 'note-id' }),
}));

jest.mock('../../src/modules/trips/submodules/activities/activities.service', () => ({
  createActivity: jest.fn().mockResolvedValue({ id: 'act-id' }),
  notifyItineraryUpdated: jest.fn(),
}));

const config = require('../../src/config');
const db = require('../../src/config/database');
const conversationsService = require('../../src/modules/ai/conversations.service');
const scopeGuard = require('../../src/modules/ai/swee.scopeGuard');
const itinerary = require('../../src/modules/ai/swee.itinerary');
const tripsService = require('../../src/modules/trips/trips.service');
const activitiesService = require('../../src/modules/trips/submodules/activities/activities.service');
const aiService = require('../../src/modules/ai/ai.service');

const USER = '123e4567-e89b-12d3-a456-426614174000';
const CONV = 'aaaa0001-0000-4000-8000-000000000001';
const TRIP = 'cccc0001-0000-4000-8000-000000000001';
const MSG = 'bbbb0001-0000-4000-8000-000000000001';

const leg = (date, time, title) => ({
  title, date, time, durationMinutes: 295, travelMinutesFromPrevious: 0, locationName: title, kind: 'travel', description: 'about 5 h door to door',
});
const stop = (date, time, n) => ({
  title: `Stop ${n}`, date, time, durationMinutes: 90, travelMinutesFromPrevious: 0, locationName: `Place ${n}`, kind: 'activity', description: 'about 1.5 h',
});

/** A Planner v2 result for the given span, one stop per planned date plus legs. */
function planResult(startDate, endDate, { dates } = {}) {
  const all = itinerary.enumerateDates(startDate, endDate);
  const planned = dates || all;
  return {
    activities: [
      leg(startDate, '06:00', 'Flight Pune → Delhi'),
      ...planned.map((d, i) => stop(d, '18:00', `${d}-${i}`)),
      leg(endDate, '15:00', 'Flight Delhi → Pune'),
    ],
    startDate,
    endDate,
    timeZone: 'Asia/Kolkata',
    international: false,
    windows: [],
    plannedDates: planned,
    droppedDates: [],
    truncated: false,
    repaired: 0,
  };
}

const FACTS = {
  destination: 'Delhi',
  startDate: '2026-12-06',
  endDate: '2026-12-08',
  timeZone: 'Asia/Kolkata',
  origin: 'Pune',
  purpose: 'work',
  busy: [{ days: 'weekdays', from: '09:00', to: '17:00' }],
  travel: { mode: 'flight', booked: false, onboardMinutes: 130 },
  adults: 2,
  groupType: 'Work',
  budgetTier: 'Comfort',
};

function geminiReplies(text) {
  mockSendMessage.mockResolvedValueOnce({ response: { text: () => text } });
}

const action = (obj) => `###ACTION${JSON.stringify({ readyToCreate: false, scope: 'in', ...obj })}`;

function storedPlan(overrides = {}) {
  const p = planResult('2026-12-06', '2026-12-08');
  return {
    version: 1,
    facts: itinerary.sanitizePlanFacts(FACTS),
    startDate: p.startDate,
    endDate: p.endDate,
    timeZone: 'Asia/Kolkata',
    international: false,
    activities: p.activities,
    droppedDates: [],
    truncated: false,
    ...overrides,
  };
}

describe('Swee planning journey (SWEE_PLANNER_V2)', () => {
  const original = { gemini: { ...config.gemini }, guard: { ...config.sweeScopeGuard }, flags: { ...config.featureFlags } };

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    config.gemini.apiKey = 'test-key';
    config.sweeScopeGuard.mode = 'enforce';
    config.featureFlags.sweePlannerV2 = true;
    scopeGuard.awaitVerdict.mockImplementation((p) => p);
    scopeGuard.checkScope.mockResolvedValue({ scope: 'in' });
    conversationsService.getConversation.mockResolvedValue({ id: CONV, tripContext: null, metadata: {} });
    conversationsService.loadHistoryForGemini.mockResolvedValue({ history: [], memoryBlock: '', total: 0 });
    conversationsService.loadLastAssistantMessage.mockResolvedValue(null);
    conversationsService.appendMessages.mockResolvedValue({ id: MSG });
    conversationsService.savePlan.mockResolvedValue(undefined);
    itinerary.generatePlan.mockImplementation(async (facts, opts = {}) => planResult(facts.startDate, facts.endDate, opts));
    tripsService.createTrip.mockResolvedValue({ id: TRIP, name: 'Delhi Dec 2026' });
  });

  afterAll(() => {
    Object.assign(config.gemini, original.gemini);
    Object.assign(config.sweeScopeGuard, original.guard);
    Object.assign(config.featureFlags, original.flags);
  });

  describe('chat → plan_trip', () => {
    it('plans from the facts, stores the plan on the conversation and appends the preview', async () => {
      geminiReplies(`Here's a plan that fits around your office hours:\n${action({ intent: 'plan_trip', draft: FACTS })}`);

      const result = await aiService.chat(USER, 'Not booked, plan with a morning flight', { conversationId: CONV });

      expect(itinerary.generatePlan).toHaveBeenCalledWith(expect.objectContaining({
        destination: 'Delhi', startDate: '2026-12-06', endDate: '2026-12-08', origin: 'Pune', purpose: 'work',
        busy: [{ days: 'weekdays', from: 540, to: 1020 }],
      }), { budgetMs: undefined });
      expect(conversationsService.savePlan).toHaveBeenCalledWith(USER, CONV, expect.objectContaining({
        version: 1, startDate: '2026-12-06', endDate: '2026-12-08', activities: expect.any(Array),
      }));
      expect(result.pendingAction).toBeNull(); // plan_trip never reaches the app
      expect(result.reply).toMatch(/^Here's a plan that fits around your office hours:\n\n\*\*Sun 6 Dec\*\*\n- 06:00 Flight Pune → Delhi · about 5 h door to door/);
      expect(result.reply).toMatch(/When it looks right, tell me and I'll set up the trip\.$/);
      expect(conversationsService.appendMessages).toHaveBeenCalledWith(USER, CONV, expect.objectContaining({
        assistantContent: result.reply, pendingAction: null,
      }));
    });

    it('refine: re-plans only the asked days and keeps the rest', async () => {
      const prev = storedPlan();
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: prev } });
      geminiReplies(`Lighter Monday:\n${action({ intent: 'plan_trip', draft: { ...FACTS, dates: ['2026-12-07'], preferences: 'keep Monday light' } })}`);

      await aiService.chat(USER, 'keep monday light', { conversationId: CONV });

      expect(itinerary.generatePlan).toHaveBeenCalledWith(
        expect.objectContaining({ preferences: 'keep Monday light' }),
        { dates: ['2026-12-07'], avoidPlaces: ['Place 2026-12-06-0', 'Place 2026-12-08-2'], budgetMs: undefined },
      );
      const saved = conversationsService.savePlan.mock.calls[0][2];
      expect(saved.version).toBe(2);
      expect(saved.activities.map((a) => a.locationName)).toEqual([
        'Flight Pune → Delhi', 'Place 2026-12-06-0', 'Place 2026-12-07-0', 'Flight Delhi → Pune', 'Place 2026-12-08-2',
      ]);
    });

    it('changed travel is a full re-plan even when dates are given (kept days could clash with new legs)', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });
      geminiReplies(`Updated:\n${action({ intent: 'plan_trip', draft: { ...FACTS, travel: { mode: 'train', booked: false }, dates: ['2026-12-07'] } })}`);

      await aiService.chat(USER, 'make it a train', { conversationId: CONV });
      expect(itinerary.generatePlan).toHaveBeenCalledWith(
        expect.objectContaining({ travel: expect.objectContaining({ mode: 'train' }) }),
        { budgetMs: undefined },
      );
    });

    it('changed dates are a full re-plan, not a refine', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });
      geminiReplies(`Updated:\n${action({ intent: 'plan_trip', draft: { ...FACTS, endDate: '2026-12-09', dates: ['2026-12-07'] } })}`);

      await aiService.chat(USER, 'one more day', { conversationId: CONV });
      expect(itinerary.generatePlan).toHaveBeenCalledWith(expect.objectContaining({ endDate: '2026-12-09' }), { budgetMs: undefined });
    });

    it('planner failure → friendly reply, nothing stored', async () => {
      itinerary.generatePlan.mockRejectedValueOnce(new Error('Itinerary generation failed'));
      geminiReplies(`Here you go:\n${action({ intent: 'plan_trip', draft: FACTS })}`);

      const result = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(result.reply).toMatch(/couldn't plan the itinerary just now/);
      expect(result.pendingAction).toBeNull();
      expect(conversationsService.savePlan).not.toHaveBeenCalled();
    });

    it.each([
      ['without dates', { destination: 'Delhi' }],
      ['with non-ISO dates', { destination: 'Delhi', startDate: '6 Dec', endDate: '19 Dec' }],
    ])('plan_trip %s is rejected at parse time (no planner call)', async (_label, draft) => {
      geminiReplies(`Sure!\n${action({ intent: 'plan_trip', draft })}`);
      const result = await aiService.chat(USER, 'plan delhi', { conversationId: CONV });
      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      expect(result.pendingAction).toBeNull();
      expect(result.reply).toBe('Sure!');
    });
  });

  describe('chat → confirm_trip', () => {
    it('returns today\'s trip form, pre-filled from the stored plan', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });
      geminiReplies(`Great — check the details below.\n${action({ intent: 'confirm_trip' })}`);

      const result = await aiService.chat(USER, 'looks good, create it', { conversationId: CONV });

      expect(result.reply).toBe('Great — check the details below.');
      expect(result.pendingAction).toEqual({
        intent: 'create_trip',
        readyToCreate: false,
        showForm: 'trip',
        scope: 'in',
        draft: {
          destination: 'Delhi',
          name: expect.stringMatching(/^Delhi/),
          startDate: '2026-12-06',
          endDate: '2026-12-08',
          adults: 2,
          groupType: 'Work',
          budgetTier: 'Comfort',
          planVersion: 1,
        },
      });
    });

    it('an action line with no text gets the default lead-in, not the "hiccup" fallback', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });
      geminiReplies(action({ intent: 'confirm_trip' }));
      const result = await aiService.chat(USER, 'yes', { conversationId: CONV });
      expect(result.reply).toBe('Here are your trip details — check them and tap Create My Trip.');
      expect(result.pendingAction.showForm).toBe('trip');
    });

    it('no plan yet → asks to plan first, no form', async () => {
      geminiReplies(`Sure.\n${action({ intent: 'confirm_trip' })}`);
      const result = await aiService.chat(USER, 'create it', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
    });
  });

  describe('executeAction create_trip with a plan', () => {
    const formAction = (draft = {}) => ({
      intent: 'create_trip',
      readyToCreate: true,
      draft: {
        destination: 'Delhi', name: 'Delhi Dec 2026', startDate: '2026-12-06', endDate: '2026-12-08', planVersion: 1, adults: 2, ...draft,
      },
    });

    it('creates the trip and saves the plan activities with kind and duration', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });

      const result = await aiService.executeAction(USER, formAction(), { conversationId: CONV });

      expect(conversationsService.getConversation).toHaveBeenCalledWith(USER, CONV);
      expect(tripsService.createTrip).toHaveBeenCalledWith(USER, expect.objectContaining({
        startDate: '2026-12-06', endDate: '2026-12-08', location: { name: 'Delhi' },
      }));
      expect(activitiesService.createActivity).toHaveBeenCalledTimes(5);
      expect(activitiesService.createActivity).toHaveBeenCalledWith(TRIP, USER, expect.objectContaining({
        title: 'Flight Pune → Delhi', kind: 'travel', durationMinutes: 295, description: 'about 5 h door to door',
      }), { notify: false });
      expect(activitiesService.createActivity).toHaveBeenCalledWith(TRIP, USER, expect.objectContaining({
        title: 'Stop 2026-12-07-1', kind: 'activity', durationMinutes: 90, time: { hour: 18, minute: 0 },
      }), { notify: false });
      expect(result).toEqual({
        reply: 'Trip created with your itinerary — 5 activities across 3 days. Invite friends from the trip page.',
        created: { id: TRIP, type: 'trip', name: 'Delhi Dec 2026' },
      });
      // origin + travel mode kept on the trip
      const metaCall = db.query.mock.calls.find(([sql]) => /UPDATE trips\s+SET planning_metadata/.test(sql));
      expect(JSON.parse(metaCall[1][0])).toMatchObject({ origin: 'Pune', travelMode: 'flight', source: 'swee' });
    });

    it('another user\'s conversation is a 404 and nothing is created', async () => {
      conversationsService.getConversation.mockRejectedValue(Object.assign(new Error('Conversation not found'), { statusCode: 404 }));

      await expect(aiService.executeAction(USER, formAction(), { conversationId: CONV }))
        .rejects.toMatchObject({ statusCode: 404 });
      expect(tripsService.createTrip).not.toHaveBeenCalled();
    });

    it('dates changed on the form → re-plan, store, ask to confirm again; no trip', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });

      const result = await aiService.executeAction(USER, formAction({ startDate: '2026-12-07', endDate: '2026-12-10' }), { conversationId: CONV });

      expect(tripsService.createTrip).not.toHaveBeenCalled();
      expect(activitiesService.createActivity).not.toHaveBeenCalled();
      // Re-plan inside /ai/execute runs on a 20 s budget (the app waits 30 s).
      expect(itinerary.generatePlan).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-12-07', endDate: '2026-12-10' }), { budgetMs: 20000 });
      expect(conversationsService.savePlan).toHaveBeenCalledWith(USER, CONV, expect.objectContaining({
        version: 2, startDate: '2026-12-07', endDate: '2026-12-10',
      }));
      expect(result.created).toBeNull();
      expect(result.reply).toMatch(/^You changed the dates, so I've updated the itinerary to fit:\n\n\*\*Mon 7 Dec\*\*/);
    });

    it('booked travel moves with the new dates when re-planning', async () => {
      const facts = itinerary.sanitizePlanFacts({
        ...FACTS,
        travel: {
          mode: 'flight', booked: true,
          outbound: { departDate: '2026-12-06', departTime: '07:00', arriveTime: '09:10' },
          return: { departDate: '2026-12-08', departTime: '18:00', arriveTime: '20:10' },
        },
      });
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan({ facts }) } });

      await aiService.executeAction(USER, formAction({ startDate: '2026-12-08', endDate: '2026-12-10' }), { conversationId: CONV });

      const replanned = itinerary.generatePlan.mock.calls[0][0];
      expect(replanned.travel.outbound.departDate).toBe('2026-12-08');
      expect(replanned.travel.return.departDate).toBe('2026-12-10');
    });

    it('re-plan failure → asks for dates, still no trip', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });
      itinerary.generatePlan.mockRejectedValueOnce(new Error('boom'));

      const result = await aiService.executeAction(USER, formAction({ endDate: '2026-12-09' }), { conversationId: CONV });
      expect(tripsService.createTrip).not.toHaveBeenCalled();
      expect(result).toEqual({ reply: expect.stringMatching(/couldn't update the itinerary/), created: null });
    });
  });

  describe('plan_itinerary (existing trip) uses Planner v2', () => {
    const trip = {
      id: TRIP, name: 'Goa Dec 2026', start_date: '2026-12-01', end_date: '2026-12-03', location_name: 'Goa', role: 'admin',
    };

    it('plans the empty days in free time and returns an add_activities proposal', async () => {
      db.query.mockImplementation(async (sql) => {
        if (/FROM trips t\s+JOIN trip_members/.test(sql)) return { rows: [trip] };
        if (/FROM trip_activities/.test(sql)) return { rows: [{ activity_date: '2026-12-02', title: 'Baga', location_name: 'Baga Beach' }] };
        if (/SELECT planning_metadata FROM trips/.test(sql)) return { rows: [{ planning_metadata: { adults: 2, origin: 'Pune', travelMode: 'flight' } }] };
        if (/SELECT timezone FROM trips/.test(sql)) return { rows: [{ timezone: 'Asia/Kolkata' }] };
        return { rows: [] };
      });
      geminiReplies(`Here's a plan:\n${action({ intent: 'plan_itinerary', tripId: TRIP })}`);

      const result = await aiService.chat(USER, 'plan my goa trip', { conversationId: CONV });

      const [facts, opts] = itinerary.generatePlan.mock.calls[0];
      expect(facts).toMatchObject({ destination: 'Goa', startDate: '2026-12-01', endDate: '2026-12-03', timeZone: 'Asia/Kolkata' });
      expect(facts.origin).toBeUndefined(); // the trip already has activities → no travel legs
      expect(opts).toEqual({ dates: ['2026-12-01', '2026-12-03'], avoidPlaces: ['Baga Beach'] });
      expect(itinerary.generateItinerary).not.toHaveBeenCalled();
      expect(result.pendingAction).toMatchObject({ intent: 'add_activities', readyToCreate: true, tripId: TRIP });
      expect(result.pendingAction.draft.activities.every((a) => ['2026-12-01', '2026-12-03'].includes(a.date))).toBe(true);
      expect(result.reply).toMatch(/Add these to your itinerary\?$/);
    });
  });

  describe('flag off → today\'s flow', () => {
    beforeEach(() => { config.featureFlags.sweePlannerV2 = false; });

    it('plan_trip / confirm_trip are invalid intents: nothing planned, reply unchanged', async () => {
      geminiReplies(`Here's a plan:\n${action({ intent: 'plan_trip', draft: FACTS })}`);
      const r1 = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      geminiReplies(`Sure:\n${action({ intent: 'confirm_trip' })}`);
      const r2 = await aiService.chat(USER, 'create it', { conversationId: CONV });

      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      expect(conversationsService.savePlan).not.toHaveBeenCalled();
      expect(r1).toMatchObject({ reply: 'Here\'s a plan:', pendingAction: null });
      expect(r2).toMatchObject({ reply: 'Sure:', pendingAction: null });
    });

    it('create_trip ignores planVersion and any stored plan', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });
      const result = await aiService.executeAction(USER, {
        intent: 'create_trip',
        readyToCreate: true,
        draft: { destination: 'Delhi', startDate: '2026-12-01', endDate: '2026-12-03', planVersion: 1 },
      }, { conversationId: CONV });

      expect(conversationsService.getConversation).not.toHaveBeenCalled();
      expect(activitiesService.createActivity).not.toHaveBeenCalled();
      expect(result.reply).toBe('Trip created! Add places and invite friends now.');
    });

    it('plan_itinerary still uses the 3-per-day planner', async () => {
      db.query.mockImplementation(async (sql) => {
        if (/FROM trips t\s+JOIN trip_members/.test(sql)) {
          return {
            rows: [{
              id: TRIP, name: 'Goa', start_date: '2026-12-01', end_date: '2026-12-01', location_name: 'Goa', role: 'admin',
            }],
          };
        }
        return { rows: [] };
      });
      itinerary.generateItinerary.mockResolvedValue({
        activities: [{ title: 'A', date: '2026-12-01', time: '09:30', locationName: 'A' }], plannedDates: ['2026-12-01'], missing: [], truncated: false,
      });
      geminiReplies(`Plan:\n${action({ intent: 'plan_itinerary', tripId: TRIP })}`);

      await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(itinerary.generateItinerary).toHaveBeenCalled();
      expect(itinerary.generatePlan).not.toHaveBeenCalled();
    });
  });
});

describe('Swee-created trips get the destination time zone (TRIP_TIMEZONES)', () => {
  const original = { ...config.featureFlags };
  const lastCreateArgs = () => tripsService.createTrip.mock.calls[0];
  const planFor = (destination, timeZone) => storedPlan({
    facts: itinerary.sanitizePlanFacts({ ...FACTS, destination, timeZone }),
    timeZone: timeZone || 'Asia/Kolkata',
  });
  const v2Form = (destination) => ({
    intent: 'create_trip',
    readyToCreate: true,
    draft: { destination, startDate: '2026-12-06', endDate: '2026-12-08', planVersion: 1 },
  });
  const legacyForm = (destination, timeZone) => ({
    intent: 'create_trip',
    readyToCreate: true,
    draft: { destination, startDate: '2026-12-06', endDate: '2026-12-08', ...(timeZone ? { timeZone } : {}) },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    tripsService.createTrip.mockResolvedValue({ id: TRIP, name: 'Trip' });
  });
  afterAll(() => { Object.assign(config.featureFlags, original); });

  describe('Planner v2: zone from the agreed plan', () => {
    beforeEach(() => { config.featureFlags.sweePlannerV2 = true; config.featureFlags.tripTimezones = true; });

    it.each([
      ['London', 'Europe/London'],
      ['New York', 'America/New_York'],
      ['Goa', 'Asia/Kolkata'],
    ])('%s → createTrip gets timeZoneHint %s', async (destination, zone) => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: planFor(destination, zone) } });
      await aiService.executeAction(USER, v2Form(destination), { conversationId: CONV });
      expect(lastCreateArgs()).toEqual([USER, expect.objectContaining({ location: { name: destination } }), { timeZoneHint: zone }]);
    });

    it('plan without a model-given zone → no hint (planner default Asia/Kolkata is not used)', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: planFor('London', undefined) } });
      await aiService.executeAction(USER, v2Form('London'), { conversationId: CONV });
      expect(lastCreateArgs()).toHaveLength(2);
    });

    it('a draft timeZone is ignored when a plan exists', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: planFor('London', 'Europe/London') } });
      const form = v2Form('London');
      form.draft.timeZone = 'Asia/Tokyo';
      await aiService.executeAction(USER, form, { conversationId: CONV });
      expect(lastCreateArgs()[2]).toEqual({ timeZoneHint: 'Europe/London' });
    });
  });

  describe('legacy flow: zone from the trip card draft', () => {
    beforeEach(() => { config.featureFlags.sweePlannerV2 = false; config.featureFlags.tripTimezones = true; });

    it.each([
      ['London', 'Europe/London'],
      ['New York', 'America/New_York'],
      ['Goa', 'Asia/Kolkata'],
    ])('%s → createTrip gets timeZoneHint %s', async (destination, zone) => {
      await aiService.executeAction(USER, legacyForm(destination, zone), { conversationId: CONV });
      expect(lastCreateArgs()).toEqual([USER, expect.objectContaining({ location: { name: destination } }), { timeZoneHint: zone }]);
    });

    it('no zone in the draft → called exactly as before', async () => {
      await aiService.executeAction(USER, legacyForm('London'), { conversationId: CONV });
      expect(lastCreateArgs()).toHaveLength(2);
    });

    it('a non-string zone is not passed on', async () => {
      const form = legacyForm('London');
      form.draft.timeZone = { evil: true };
      await aiService.executeAction(USER, form, { conversationId: CONV });
      expect(lastCreateArgs()).toHaveLength(2);
    });
  });

  describe('flag off: unchanged', () => {
    beforeEach(() => { config.featureFlags.tripTimezones = false; });

    it('legacy: a draft timeZone is not passed to createTrip', async () => {
      config.featureFlags.sweePlannerV2 = false;
      await aiService.executeAction(USER, legacyForm('London', 'Europe/London'), { conversationId: CONV });
      expect(lastCreateArgs()).toEqual([USER, {
        name: 'London Dec 2026', startDate: '2026-12-06', endDate: '2026-12-08', location: { name: 'London' }, reminders: true,
      }]);
    });

    it('Planner v2: the plan zone is not passed to createTrip', async () => {
      config.featureFlags.sweePlannerV2 = true;
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: planFor('London', 'Europe/London') } });
      await aiService.executeAction(USER, v2Form('London'), { conversationId: CONV });
      expect(lastCreateArgs()).toHaveLength(2);
    });
  });

  describe('legacy prompt asks for the zone only with TRIP_TIMEZONES', () => {
    const { buildSweetSystemPrompt } = jest.requireActual('../../src/modules/ai/swee.config');
    const RULE = '→ Also put "timeZone" in the draft: the destination\'s IANA zone (e.g. "Europe/London", "America/New_York", "Asia/Kolkata").\n';
    const ctx = { profile: { full_name: 'Priya', timezone: 'Asia/Kolkata' }, trips: [], events: [] };

    it('flag off: no rule; flag on: the same prompt plus the rule', () => {
      config.featureFlags.sweePlannerV2 = false;
      config.featureFlags.tripTimezones = false;
      const off = buildSweetSystemPrompt(ctx, null, 1);
      config.featureFlags.tripTimezones = true;
      const on = buildSweetSystemPrompt(ctx, null, 1);
      expect(off).not.toContain('"timeZone" in the draft');
      expect(on.replace(RULE, '')).toBe(off);
      expect(on).toContain(RULE);
    });

    it('Planner v2 prompt is unchanged by TRIP_TIMEZONES', () => {
      config.featureFlags.sweePlannerV2 = true;
      config.featureFlags.tripTimezones = false;
      const off = buildSweetSystemPrompt(ctx, null, 1);
      config.featureFlags.tripTimezones = true;
      expect(buildSweetSystemPrompt(ctx, null, 1)).toBe(off);
    });
  });
});
