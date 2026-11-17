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
const mockSystemPrompts = [];

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn((opts) => {
      mockSystemPrompts.push(opts?.systemInstruction);
      return { startChat: jest.fn(() => ({ sendMessage: mockSendMessage })) };
    }),
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
    config.featureFlags.tripTimezones = false; // time zone hints: own describe below
    config.featureFlags.profileTravelPrefs = false; // profile rules: own describe below
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

    // Live Round C: history holds only the preview text, so on "refine" the model re-derived the
    // facts (end date / flight time drifted) → full re-plan; or wrote the changed day itself.
    it('the stored plan\'s facts are shown to the model, so a refine can copy them', async () => {
      const prev = storedPlan();
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: prev } });
      geminiReplies(`Sure.\n${action({ intent: 'none' })}`);
      mockSystemPrompts.length = 0;

      await aiService.chat(USER, 'add Red Fort on Monday', { conversationId: CONV });

      const prompt = mockSystemPrompts[mockSystemPrompts.length - 1];
      expect(prompt).toContain(`THE PLAN ALREADY MADE IN THIS CHAT (version ${prev.version}`);
      expect(prompt).toContain(JSON.stringify(prev.facts));
      expect(prompt).toContain('Never write or describe the changed days yourself');
      // Live Round C: facts copied, but "dates" left out → every day re-planned.
      expect(prompt).toMatch(/"dates" with those days \(YYYY-MM-DD\) is REQUIRED/);
    });

    it('no stored plan → no plan section', async () => {
      geminiReplies(`Sure.\n${action({ intent: 'none' })}`);
      mockSystemPrompts.length = 0;
      await aiService.chat(USER, 'hi', { conversationId: CONV });
      expect(mockSystemPrompts[mockSystemPrompts.length - 1]).not.toContain('THE PLAN ALREADY MADE');
    });

    it('flag off: a stored plan is never shown (prompt unchanged)', async () => {
      config.featureFlags.sweePlannerV2 = false;
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });
      geminiReplies(`Sure.\n${action({ intent: 'none' })}`);
      mockSystemPrompts.length = 0;
      await aiService.chat(USER, 'hi', { conversationId: CONV });
      expect(mockSystemPrompts[mockSystemPrompts.length - 1]).not.toContain('THE PLAN ALREADY MADE');
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
      // Rejected action → honest reply, never the model's "Sure!".
      expect(result.reply).toBe('I couldn\'t make that change — nothing was updated. Could you try again?');
    });
  });

  // Live Round C refine failures, and the fixes that make refine server-side deterministic.
  describe('chat → refine an existing plan (Round C)', () => {
    const NOT_DONE = 'I couldn\'t make that change — nothing was updated. Could you try again?';
    const withPlan = (plan = storedPlan()) => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan } });
      return plan;
    };
    const keptDays = (dates) => expect(itinerary.generatePlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dates }),
    );

    // Failure 2: the facts were copied but "dates" left out → every day was re-planned.
    it.each([
      ['On 7 Dec, please add the Red Fort.'],
      ['on december 7th add the Red Fort'],
      ['Add the Red Fort on day 2'],
      ['add the Red Fort on the second day'],
      ['Add the Red Fort on Monday'],
      ['add the Red Fort on 2026-12-07'],
    ])('dates left out: the day comes from the user\'s message — "%s"', async (message) => {
      withPlan();
      geminiReplies(`Adding it:\n${action({ intent: 'plan_trip', draft: { ...FACTS, preferences: 'Red Fort' } })}`);

      await aiService.chat(USER, message, { conversationId: CONV });

      keptDays(['2026-12-07']);
      const saved = conversationsService.savePlan.mock.calls[0][2];
      expect(saved.activities.map((a) => a.locationName)).toEqual(expect.arrayContaining(['Place 2026-12-06-0', 'Place 2026-12-08-2']));
    });

    it('dates from the model win over the message; dates outside the trip are ignored', async () => {
      withPlan();
      geminiReplies(`Sure:\n${action({ intent: 'plan_trip', draft: { ...FACTS, dates: ['2026-12-08', '2027-01-01'] } })}`);
      await aiService.chat(USER, 'on 7 Dec … actually the last day', { conversationId: CONV });
      keptDays(['2026-12-08']);
    });

    it('no day named anywhere → the whole plan is re-planned (same facts)', async () => {
      withPlan();
      geminiReplies(`Sure:\n${action({ intent: 'plan_trip', draft: { ...FACTS, preferences: 'more food' } })}`);
      await aiService.chat(USER, 'more food please', { conversationId: CONV });
      expect(itinerary.generatePlan).toHaveBeenCalledWith(expect.objectContaining({ preferences: 'more food' }), { budgetMs: undefined });
    });

    it('a refine missing facts keeps the stored ones (the plan is the base)', async () => {
      withPlan();
      geminiReplies(`Sure:\n${action({ intent: 'plan_trip', draft: { preferences: 'Red Fort', dates: ['2026-12-07'] } })}`);

      await aiService.chat(USER, 'add the Red Fort on Monday', { conversationId: CONV });

      expect(itinerary.generatePlan).toHaveBeenCalledWith(
        expect.objectContaining({ destination: 'Delhi', origin: 'Pune', travel: expect.objectContaining({ mode: 'flight' }), preferences: 'Red Fort' }),
        expect.objectContaining({ dates: ['2026-12-07'] }),
      );
    });

    // Failure 3: plan_itinerary with a placeholder trip id was rejected, and the model's
    // "I've added it" text was shown although nothing changed.
    it('plan_itinerary with a placeholder trip id refines the plan in this chat', async () => {
      withPlan();
      geminiReplies(`Adding it now.\n${action({
        intent: 'plan_itinerary', tripId: '[id from user list]', draft: { preferences: 'Red Fort', dates: ['2026-12-07'] },
      })}`);

      const result = await aiService.chat(USER, 'On 7 Dec, please add the Red Fort.', { conversationId: CONV });

      keptDays(['2026-12-07']);
      expect(conversationsService.savePlan.mock.calls[0][2].version).toBe(2);
      expect(result.pendingAction).toBeNull();
      expect(result.reply).toMatch(/\*\*Mon 7 Dec\*\*/);
    });

    it('plan_itinerary naming a trip that isn\'t saved refines the plan in this chat', async () => {
      withPlan();
      geminiReplies(`On it.\n${action({ intent: 'plan_itinerary', targetTripName: 'Delhi Dec 2026', draft: { dates: ['2026-12-07'] } })}`);

      const result = await aiService.chat(USER, 'add the Red Fort on Monday', { conversationId: CONV });

      keptDays(['2026-12-07']);
      expect(result.reply).not.toMatch(/couldn't find that trip/);
    });

    it('no plan in the chat: plan_itinerary with a placeholder id is still rejected, honestly', async () => {
      geminiReplies(`I've added the Red Fort to your Monday.\n${action({ intent: 'plan_itinerary', tripId: '[id]' })}`);
      const result = await aiService.chat(USER, 'add the Red Fort on Monday', { conversationId: CONV });
      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      expect(result.reply).toBe(NOT_DONE);
    });

    // Failure 1: "move the British Museum to 10 May" — the place was already on another day,
    // so a re-plan of the new day skipped it (no repeats). Now moved without the model.
    it('move: takes the stop off its old day and fits it into the new day\'s free time', async () => {
      const prev = withPlan();
      geminiReplies(`Moving it.\n${action({ intent: 'plan_trip', draft: { ...FACTS, dates: ['2026-12-07'], move: 'Place 2026-12-06-0' } })}`);

      const result = await aiService.chat(USER, 'Move Place 2026-12-06-0 to Monday', { conversationId: CONV });

      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      const saved = conversationsService.savePlan.mock.calls[0][2];
      expect(saved.version).toBe(prev.version + 1);
      const on = (d) => saved.activities.filter((a) => a.date === d && a.kind === 'activity').map((a) => `${a.time} ${a.locationName}`);
      expect(on('2026-12-06')).toEqual([]);
      // Monday is a work day: free 18:00–22:00. 18:00–19:30 is taken; +30 min travel → 20:00.
      expect(on('2026-12-07')).toEqual(['18:00 Place 2026-12-07-1', '20:00 Place 2026-12-06-0']);
      expect(saved.activities.filter((a) => a.kind === 'travel')).toHaveLength(2);
      expect(result.reply).toMatch(/^I've moved Place 2026-12-06-0 to Mon 7 Dec\./);
      expect(result.pendingAction).toBeNull();
    });

    it('move: read from the user\'s words when the model sends neither "move" nor "dates"', async () => {
      withPlan();
      geminiReplies(`Sure.\n${action({ intent: 'plan_trip', draft: { ...FACTS } })}`);
      await aiService.chat(USER, 'can you move Place 2026-12-06-0 to 7 Dec?', { conversationId: CONV });
      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      expect(conversationsService.savePlan.mock.calls[0][2].activities
        .find((a) => a.locationName === 'Place 2026-12-06-0').date).toBe('2026-12-07');
    });

    it('move: no free time on the new day → nothing changes and Swee says so', async () => {
      withPlan();
      geminiReplies(`Done!\n${action({ intent: 'plan_trip', draft: { ...FACTS, dates: ['2026-12-08'], move: 'Place 2026-12-06-0' } })}`);

      // Tuesday: office until 17:00 (+1 h commute) and the flight home leaves mid-afternoon.
      const result = await aiService.chat(USER, 'move Place 2026-12-06-0 to Tuesday', { conversationId: CONV });

      expect(conversationsService.savePlan).not.toHaveBeenCalled();
      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      expect(result.reply).toMatch(/^I couldn't fit Place 2026-12-06-0 into Tue 8 Dec .* nothing was changed/);
    });

    it('move: no day named → asks which day, nothing changes', async () => {
      withPlan();
      geminiReplies(`Sure.\n${action({ intent: 'plan_trip', draft: { ...FACTS, move: 'Place 2026-12-06-0', dates: ['2026-12-06'] } })}`);
      const result = await aiService.chat(USER, 'move Place 2026-12-06-0 please, on 6 Dec it is too much', { conversationId: CONV });
      expect(conversationsService.savePlan).not.toHaveBeenCalled();
      expect(result.reply).toMatch(/^Which day should I move Place 2026-12-06-0 to\? Nothing has been changed yet\./);
    });

    it('the prompt tells the model how to move a place and not to claim changes', async () => {
      withPlan();
      geminiReplies(`Sure.\n${action({ intent: 'none' })}`);
      mockSystemPrompts.length = 0;
      await aiService.chat(USER, 'hi', { conversationId: CONV });
      const prompt = mockSystemPrompts[mockSystemPrompts.length - 1];
      expect(prompt).toContain('"move":"<the place, as named in the plan>"');
      expect(prompt).toContain('never say a change is done');
    });
  });

  // (c) Honest replies: a rejected action never leaves text that claims a change.
  describe('chat → rejected actions (honest reply)', () => {
    const NOT_DONE = 'I couldn\'t make that change — nothing was updated. Could you try again?';

    it.each([
      ['an unknown intent', { intent: 'delete_trip', readyToCreate: true }],
      ['add_activities with no trip', { intent: 'add_activities', readyToCreate: true, draft: { activities: [{ title: 'x' }] } }],
      ['create_trip with no draft', { intent: 'create_trip', readyToCreate: true, draft: {} }],
    ])('%s → "nothing was updated", no action', async (_label, obj) => {
      geminiReplies(`Done! I've updated it for you.\n${action(obj)}`);
      const result = await aiService.chat(USER, 'do it', { conversationId: CONV });
      expect(result.reply).toBe(NOT_DONE);
      expect(result.pendingAction).toBeNull();
    });

    it('a broken ACTION line (bad JSON) → "nothing was updated"', async () => {
      geminiReplies('All set — I\'ve added it.\n###ACTION{"intent":"update_trip",');
      const result = await aiService.chat(USER, 'do it', { conversationId: CONV });
      expect(result.reply).toBe(NOT_DONE);
    });

    it('an invalid "none" action keeps the text (no change was attempted)', async () => {
      geminiReplies(`Paris is lovely in May.\n${action({ intent: 'none', readyToCreate: true })}`);
      const result = await aiService.chat(USER, 'is paris nice?', { conversationId: CONV });
      expect(result.reply).toBe('Paris is lovely in May.');
    });

    it('flag off: today\'s behaviour (the model\'s text is kept)', async () => {
      config.featureFlags.sweePlannerV2 = false;
      geminiReplies(`Done! I've updated it for you.\n${action({ intent: 'delete_trip', readyToCreate: true })}`);
      const result = await aiService.chat(USER, 'do it', { conversationId: CONV });
      expect(result.reply).toBe('Done! I\'ve updated it for you.');
    });
  });

  describe('datesNamedIn', () => {
    const trip = itinerary.enumerateDates('2027-05-08', '2027-05-12'); // Sat 8 … Wed 12 May
    it.each([
      ['On 10 May, add a cruise', ['2027-05-10']],
      ['may 10th and the 11th of May', ['2027-05-10', '2027-05-11']],
      ['day 3 please', ['2027-05-10']],
      ['the first day and the last day', ['2027-05-08', '2027-05-12']],
      ['on Saturday', ['2027-05-08']],
      ['2027-05-09', ['2027-05-09']],
      ['on 20 May', []],
      ['day 9', []],
      ['add a cruise', []],
    ])('"%s"', (text, expected) => {
      expect(itinerary.datesNamedIn(text, trip)).toEqual(expected);
    });
  });

  // Code review follow-ups on the refine rules.
  describe('chat → refine review fixes', () => {
    const withPlan = (plan = storedPlan()) => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan } });
      return plan;
    };

    it('a new trip in the same chat starts fresh — nothing carried over from the old plan', async () => {
      withPlan();
      geminiReplies(`Goa it is:\n${action({ intent: 'plan_trip', draft: { destination: 'Goa', startDate: '2026-12-20', endDate: '2026-12-22', purpose: 'holiday' } })}`);
      await aiService.chat(USER, 'now plan a Goa holiday 20 to 22 Dec', { conversationId: CONV });
      const facts = itinerary.generatePlan.mock.calls[0][0];
      expect(facts.destination).toBe('Goa');
      expect(facts.busy).toEqual([]);
      expect(facts.origin).toBeUndefined();
      expect(facts.travel).toBeUndefined();
    });

    it('"swap X for Y on <day>" is a refine of that day, not a move', async () => {
      withPlan();
      geminiReplies(`Sure:\n${action({ intent: 'plan_trip', draft: { ...FACTS, preferences: 'Red Fort instead of Place 2026-12-06-0' } })}`);
      await aiService.chat(USER, 'swap Place 2026-12-07-1 for the Red Fort on 7 Dec', { conversationId: CONV });
      expect(itinerary.generatePlan).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dates: ['2026-12-07'] }));
    });

    it('move with no day we can read → asks which day, nothing re-planned', async () => {
      withPlan();
      geminiReplies(`Sure.\n${action({ intent: 'plan_trip', draft: { ...FACTS, move: 'Place 2026-12-06-0' } })}`);
      const result = await aiService.chat(USER, 'move Place 2026-12-06-0 to the next day', { conversationId: CONV });
      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      expect(conversationsService.savePlan).not.toHaveBeenCalled();
      expect(result.reply).toMatch(/^Which day should I move Place 2026-12-06-0 to\?/);
    });

    it('move updates the open days: the old day, now empty, is open', async () => {
      withPlan();
      geminiReplies(`Moving.\n${action({ intent: 'plan_trip', draft: { ...FACTS, dates: ['2026-12-07'], move: 'Place 2026-12-06-0' } })}`);
      await aiService.chat(USER, 'move Place 2026-12-06-0 to 7 Dec', { conversationId: CONV });
      expect(conversationsService.savePlan.mock.calls[0][2].droppedDates).toEqual(['2026-12-06']);
    });

    it('move onto an open day: that day is no longer listed as open', async () => {
      const p = storedPlan();
      withPlan({ ...p, droppedDates: ['2026-12-07'], activities: p.activities.filter((a) => !(a.kind === 'activity' && a.date === '2026-12-07')) });
      geminiReplies(`Moving.\n${action({ intent: 'plan_trip', draft: { ...FACTS, dates: ['2026-12-07'], move: 'Place 2026-12-08-2' } })}`);
      await aiService.chat(USER, 'move Place 2026-12-08-2 to 7 Dec', { conversationId: CONV });
      const saved = conversationsService.savePlan.mock.calls[0][2];
      expect(saved.droppedDates).not.toContain('2026-12-07');
    });

    it.each([
      ['add 2 markets please', []],
      ['maybe 10 more minutes at each stop', []],
      ['could we fit a cooking class in one day?', []],
      ['a 2 day trip feels short', []],
      ['on 8 December please', ['2026-12-08']],
      ['the 3rd day', ['2026-12-08']],
      ['dec 7', ['2026-12-07']],
    ])('datesNamedIn ignores look-alikes — "%s"', (text, expected) => {
      expect(itinerary.datesNamedIn(text, ['2026-12-06', '2026-12-07', '2026-12-08'])).toEqual(expected);
    });
  });

  // Live Round D (PROFILE_TRAVEL_PREFS) — server-side rules, not prompt wording.
  describe('chat → profile rules (PROFILE_TRAVEL_PREFS, Round D)', () => {
    const { loadUserContext } = jest.requireMock('../../src/modules/ai/swee.config');
    const profile = (p) => loadUserContext.mockResolvedValue({ profile: { first_name: 'Asha', ...p }, trips: [], events: [] });
    const history = (...turns) => conversationsService.loadHistoryForGemini.mockResolvedValue({
      history: turns.map(([role, content]) => ({ role, content })), memoryBlock: '', total: turns.length,
    });

    beforeEach(() => {
      config.featureFlags.profileTravelPrefs = true;
      profile({ home_city: null, travel_mode_pref: null });
    });
    afterEach(() => {
      config.featureFlags.profileTravelPrefs = false;
      loadUserContext.mockResolvedValue({ profile: null, trips: [], events: [] });
    });

    // D1a: Swee asked about group size / budget, never where they travel from.
    it('plan_trip with no origin and no saved home city → asks where they travel from, no plan', async () => {
      const { origin, travel, ...noOrigin } = FACTS;
      geminiReplies(`Planning now!\n${action({ intent: 'plan_trip', draft: noOrigin })}`);
      const result = await aiService.chat(USER, 'yes please, plan it', { conversationId: CONV });
      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      expect(result.reply).toBe('Where will you be travelling from?');
      expect(result.pendingAction).toBeNull();
    });

    it('no origin but a saved home city → plans (the model fills it from the context)', async () => {
      profile({ home_city: 'Pune' });
      const { origin, ...noOrigin } = FACTS;
      geminiReplies(`Planning:\n${action({ intent: 'plan_trip', draft: noOrigin })}`);
      await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(itinerary.generatePlan).toHaveBeenCalled();
    });

    it('"plan it" with no origin known anywhere → the origin question is added to Swee\'s reply', async () => {
      history(['user', 'I want a 4-day trip to Udaipur in January'], ['assistant', 'Lovely! Shall I plan it?']);
      geminiReplies(`Happy to! Are you travelling alone or with others?\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'Yes please, plan it.', { conversationId: CONV });
      expect(result.reply).toBe('Happy to! Are you travelling alone or with others?\n\nWhere will you be travelling from?');
    });

    it('origin already given earlier → no origin question', async () => {
      history(['user', 'Udaipur in January'], ['assistant', 'Lovely!'], ['user', 'From Pune.'], ['assistant', 'Great.']);
      geminiReplies(`Sure — how many people?\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(result.reply).toBe('Sure — how many people?');
    });

    // D1b: "From Pune." → Swee said "I'll remember this" but offered no Save button.
    it('"From Pune." → a save_profile_detail offer is attached, and the false claim is removed', async () => {
      geminiReplies(`Thanks! I'll remember this for our travel planning. How many people are going?\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'From Pune.', { conversationId: CONV });
      expect(result.pendingAction).toEqual({
        intent: 'save_profile_detail', readyToCreate: true, scope: 'in', draft: { field: 'homeCity', value: 'Pune' },
      });
      expect(result.reply).toBe('Thanks! How many people are going?\n\nWant me to save Pune as your home city for next time?');
    });

    it.each([
      ['I\'m travelling from new delhi, not booked yet', 'New Delhi'],
      ['from Mumbai and we fly', 'Mumbai'],
    ])('origin read from "%s"', async (message, city) => {
      geminiReplies(`Got it.\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, message, { conversationId: CONV });
      expect(result.pendingAction?.draft).toEqual({ field: 'homeCity', value: city });
    });

    it('origin is the saved home city → no offer', async () => {
      profile({ home_city: 'Pune' });
      geminiReplies(`Great.\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'From Pune.', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
      expect(result.reply).toBe('Great.');
    });

    it('another action is pending → no offer attached (one action per message)', async () => {
      geminiReplies(`Here's the plan:\n${action({ intent: 'plan_trip', draft: FACTS })}`);
      const result = await aiService.chat(USER, 'From Pune, plan it', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
      expect(result.reply).not.toMatch(/save Pune/);
    });

    it('a real save_profile_detail offer keeps its text', async () => {
      geminiReplies(`Want me to remember that you're vegetarian? I'll save it for next time.\n${action({
        intent: 'save_profile_detail', readyToCreate: true, draft: { field: 'dietaryNeeds', value: 'vegetarian' },
      })}`);
      const result = await aiService.chat(USER, 'I\'m vegetarian', { conversationId: CONV });
      expect(result.reply).toMatch(/I'll save it for next time\.$/);
    });

    it('"plan a birthday party" → no travel question', async () => {
      geminiReplies(`Fun! How many guests?\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'help me plan a birthday party', { conversationId: CONV });
      expect(result.reply).toBe('Fun! How many guests?');
    });

    it.each([['From Monday I\'m free.'], ['from tomorrow'], ['From 9 am, not before.']])('"%s" is a time, not a home city', async (message) => {
      geminiReplies(`Noted.\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, message, { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
    });

    // D3: saved usual travel mode (train) ignored — the model picked a flight.
    it('saved travel mode is the default when the user named none in this chat', async () => {
      profile({ home_city: 'Pune', travel_mode_pref: 'train' });
      geminiReplies(`Planning:\n${action({ intent: 'plan_trip', draft: FACTS })}`); // FACTS: flight, 130 min
      await aiService.chat(USER, 'Plan a 3-day trip to Delhi, not booked yet.', { conversationId: CONV });
      expect(itinerary.generatePlan.mock.calls[0][0].travel).toEqual(expect.objectContaining({ mode: 'train', onboardMinutes: undefined }));
    });

    it('the user named a mode in this chat → theirs wins', async () => {
      profile({ home_city: 'Pune', travel_mode_pref: 'train' });
      geminiReplies(`Planning:\n${action({ intent: 'plan_trip', draft: FACTS })}`);
      await aiService.chat(USER, 'Not booked, a flight is fine.', { conversationId: CONV });
      expect(itinerary.generatePlan.mock.calls[0][0].travel.mode).toBe('flight');
    });

    it('flag off: none of the profile rules apply', async () => {
      config.featureFlags.profileTravelPrefs = false;
      geminiReplies(`Thanks! I'll remember this.\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'From Pune.', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
      expect(result.reply).toBe('Thanks! I\'ll remember this.');
    });
  });

  // Live Round D: Swee wrote "Day 1 — Morning: Amber Fort …" itself (unchecked, never saved).
  describe('chat → self-written itinerary (SWEE_PLANNER_V2)', () => {
    const SELF = 'Here is your plan:\n\n**Day 1**\n- Morning: Amber Fort\n- Afternoon: Jaigarh Fort\n- Evening: Dinner\n\n**Day 2**\n- Morning: City Palace\n- Afternoon: Jantar Mantar\n- Evening: Hawa Mahal';

    it('is never shown: Swee is asked once more, and its plan_trip goes through the planner', async () => {
      geminiReplies(SELF);
      geminiReplies(`Here's a plan:\n${action({ intent: 'plan_trip', draft: FACTS })}`);
      const result = await aiService.chat(USER, 'Yes, go ahead and plan it.', { conversationId: CONV });
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage.mock.calls[1][0].some((p) => /App note, not from the user/.test(p.text || ''))).toBe(true);
      expect(itinerary.generatePlan).toHaveBeenCalled();
      expect(result.reply).not.toMatch(/Morning: Amber Fort/);
      expect(result.reply).toMatch(/\*\*Sun 6 Dec\*\*/);
    });

    it('retry still writes the days → a plain message, never the unchecked text', async () => {
      geminiReplies(SELF);
      geminiReplies(SELF);
      const result = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(result.reply).toBe('I couldn\'t build a checked itinerary just now — ask me again and I\'ll plan it day by day.');
      expect(result.pendingAction).toBeNull();
    });

    it('days written next to a plan_trip action are dropped from the lead-in', async () => {
      geminiReplies(`${SELF}\n${action({ intent: 'plan_trip', draft: FACTS })}`);
      const result = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(result.reply).not.toMatch(/Morning: Amber Fort/);
      expect(result.reply).toMatch(/^\*\*Sun 6 Dec\*\*/);
    });

    it('ordinary travel tips are not an itinerary', async () => {
      geminiReplies(`Jaipur in winter is lovely. Mornings are cool — start early at Amber Fort, and keep evenings for the bazaars.\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'what is jaipur like?', { conversationId: CONV });
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(result.reply).toMatch(/^Jaipur in winter/);
    });

    it('flag off: the text is shown as today', async () => {
      config.featureFlags.sweePlannerV2 = false;
      geminiReplies(SELF);
      const result = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(result.reply).toBe(SELF);
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

  // Live Round C (2 of 7 runs): "Looks good, let's create the trip" → no action, or plan_trip again.
  describe('chat → "looks good" with a plan in the chat (SWEE_PLANNER_V2)', () => {
    const PREVIEW_END = 'Want any changes? When it looks right, tell me and I\'ll set up the trip.';
    const withPlan = (lastSwee = `**Sun 6 Dec**\n- 06:00 Flight\n\n${PREVIEW_END}`) => {
      conversationsService.getConversation.mockResolvedValue({ id: CONV, metadata: { plan: storedPlan() } });
      conversationsService.loadLastAssistantMessage.mockResolvedValue({ content: lastSwee, refused: false });
    };

    it('"sounds good" to another question from Swee is not a confirm', async () => {
      withPlan('Shall I add a museum on Monday evening?');
      geminiReplies(`Adding it.\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'sounds good', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
    });

    it('no action from the model → the pre-filled trip form', async () => {
      withPlan();
      geminiReplies(`Great!\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'Looks good, let\'s create the trip.', { conversationId: CONV });
      expect(result.pendingAction).toMatchObject({ intent: 'create_trip', showForm: 'trip', draft: { destination: 'Delhi', planVersion: 1 } });
      expect(result.reply).toBe('Great!');
    });

    it('plan_trip re-sent with no change → the form, nothing re-planned', async () => {
      withPlan();
      geminiReplies(`Here it is again:\n${action({ intent: 'plan_trip', draft: FACTS })}`);
      const result = await aiService.chat(USER, 'Perfect, create it', { conversationId: CONV });
      expect(itinerary.generatePlan).not.toHaveBeenCalled();
      expect(result.pendingAction).toMatchObject({ intent: 'create_trip', showForm: 'trip' });
      expect(result.reply).toBe('Here are your trip details — check them and tap Create My Trip.');
    });

    it.each([
      ['Looks good, but add the Red Fort on Monday'],
      ['looks good — can you add one more museum?'],
      ['Perfect, just move Place 2026-12-06-0 to 7 Dec'],
    ])('a change in the same message is not a confirm — "%s"', async (message) => {
      withPlan();
      geminiReplies(`Sure:\n${action({ intent: 'plan_trip', draft: { ...FACTS, dates: ['2026-12-07'] } })}`);
      const result = await aiService.chat(USER, message, { conversationId: CONV });
      expect(result.pendingAction?.showForm).not.toBe('trip');
    });

    it('no plan in the chat → no confirm', async () => {
      geminiReplies(`Glad you like it!\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'looks good', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
    });

    it('flag off → no confirm (the plan is never read)', async () => {
      config.featureFlags.sweePlannerV2 = false;
      withPlan();
      geminiReplies(`Great!\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'Looks good, let\'s create the trip.', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
      expect(result.reply).toBe('Great!');
    });
  });

  // Live Round D: "forget that I'm vegetarian" → "I will not save that" with no action (still saved);
  // saved interests never reached the planner.
  describe('chat → profile rules, round 2 (PROFILE_TRAVEL_PREFS)', () => {
    const { loadUserContext } = jest.requireMock('../../src/modules/ai/swee.config');
    const profile = (p) => loadUserContext.mockResolvedValue({ profile: { first_name: 'Asha', ...p }, trips: [], events: [] });
    beforeEach(() => { config.featureFlags.profileTravelPrefs = true; });
    afterEach(() => {
      config.featureFlags.profileTravelPrefs = false;
      loadUserContext.mockResolvedValue({ profile: null, trips: [], events: [] });
    });

    it('"forget that I\'m vegetarian" with no action → the clear offer for the saved diet', async () => {
      profile({ dietary_needs: 'vegetarian' });
      geminiReplies(`Understood, I will not save that preference.\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'Actually, forget that I\'m vegetarian.', { conversationId: CONV });
      expect(result.pendingAction).toEqual({
        intent: 'save_profile_detail', readyToCreate: true, scope: 'in', draft: { field: 'dietaryNeeds', value: '' },
      });
      expect(result.reply).toMatch(/^Want me to forget that\?/);
    });

    it('nothing saved for it → no clear offer', async () => {
      profile({ dietary_needs: null });
      geminiReplies(`Okay!\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'forget that I\'m vegetarian', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
    });

    it('"forget it, I don\'t like Goa" is not a profile clear', async () => {
      profile({ interests: ['history'] });
      geminiReplies(`No problem.\n${action({ intent: 'none' })}`);
      const result = await aiService.chat(USER, 'forget it, I don\'t like Goa', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
    });

    it('saved interests and diet go to the planner when the model leaves them out', async () => {
      profile({ home_city: 'Pune', interests: ['history', 'street food'], dietary_needs: 'vegetarian' });
      geminiReplies(`Planning:\n${action({ intent: 'plan_trip', draft: FACTS })}`);
      await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(itinerary.generatePlan.mock.calls[0][0]).toMatchObject({ interests: ['history', 'street food'], dietaryNeeds: 'vegetarian' });
    });

    it('interests the model sent win', async () => {
      profile({ home_city: 'Pune', interests: ['history'] });
      geminiReplies(`Planning:\n${action({ intent: 'plan_trip', draft: { ...FACTS, interests: ['beaches'] } })}`);
      await aiService.chat(USER, 'plan it, beaches please', { conversationId: CONV });
      expect(itinerary.generatePlan.mock.calls[0][0].interests).toEqual(['beaches']);
    });
  });

  // Live Round C (C4): Swee wrote "**Day 1** - Morning: …" AND sent plan_itinerary; the text was
  // shown above the server's checked proposal.
  describe('plan_itinerary: self-written days never shown', () => {
    it('the lead-in with written days is dropped; the proposal is shown', async () => {
      const trip = { id: TRIP, name: 'Goa Dec 2026', start_date: '2026-12-01', end_date: '2026-12-03', location_name: 'Goa', role: 'admin' };
      db.query.mockImplementation(async (sql) => {
        if (/FROM trips t\s+JOIN trip_members/.test(sql)) return { rows: [trip] };
        return { rows: [] };
      });
      geminiReplies(`Here is a day-by-day plan:\n\n**Day 1**\n- Morning: Baga Beach\n- Afternoon: Fort Aguada\n- Evening: Shack dinner\n\n**Day 2**\n- Morning: Old Goa\n${action({ intent: 'plan_itinerary', tripId: TRIP })}`);
      const result = await aiService.chat(USER, 'Plan my itinerary for the Goa trip.', { conversationId: CONV });
      expect(result.pendingAction).toMatchObject({ intent: 'add_activities' });
      expect(result.reply).not.toMatch(/Morning: Baga Beach/);
      expect(result.reply).toMatch(/Add these to your itinerary\?$/);
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
    const withoutEventAndRenameRules = (p) => p
      .replace(/→ If (you know where the event happens|the destination changes|the location changes), also put "timeZone" in the draft[^\n]*\n/g, '');

    it('flag off: no rule; flag on: the same prompt plus the rule', () => {
      config.featureFlags.sweePlannerV2 = false;
      config.featureFlags.tripTimezones = false;
      const off = buildSweetSystemPrompt(ctx, null, 1);
      config.featureFlags.tripTimezones = true;
      const on = buildSweetSystemPrompt(ctx, null, 1);
      expect(off).not.toContain('"timeZone" in the draft');
      expect(withoutEventAndRenameRules(on).replace(RULE, '').replace('"timeZone":"Asia/Makassar",', '')).toBe(off);
      expect(on).toContain('"draft":{"destination":"Bali","timeZone":"Asia/Makassar",');
      expect(on).toContain(RULE);
    });

    // The event / rename zone rules (runbook §3.1, §3.2) are covered in swee.timezoneHints.test.js.
    it('Planner v2 trip flow is unchanged by TRIP_TIMEZONES (only the event / rename zone rules are added)', () => {
      config.featureFlags.sweePlannerV2 = true;
      config.featureFlags.tripTimezones = false;
      const off = buildSweetSystemPrompt(ctx, null, 1);
      config.featureFlags.tripTimezones = true;
      expect(withoutEventAndRenameRules(buildSweetSystemPrompt(ctx, null, 1))).toBe(off);
    });
  });
});
