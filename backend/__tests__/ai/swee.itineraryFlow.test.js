/**
 * Itinerary flows in ai.service:
 *  - chat(): plan_itinerary for an existing trip → server-planned add_activities proposal
 *  - executeAction(create_trip): planItinerary → trip created now, itinerary planned in background
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
  return { ...actual, generateItinerary: jest.fn() };
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
const { createAndSendNotifications } = require('../../src/utils/fcm.util');
const tripsService = require('../../src/modules/trips/trips.service');
const activitiesService = require('../../src/modules/trips/submodules/activities/activities.service');
const aiService = require('../../src/modules/ai/ai.service');

const USER = '123e4567-e89b-12d3-a456-426614174000';
const CONV = 'aaaa0001-0000-4000-8000-000000000001';
const TRIP = 'cccc0001-0000-4000-8000-000000000001';
const MSG = 'bbbb0001-0000-4000-8000-000000000001';

const SLOT_TIMES = ['09:30', '14:00', '19:00'];
function planOf(dates) {
  return dates.flatMap((date) => SLOT_TIMES.map((time, i) => ({
    title: `Stop ${i + 1} on ${date}`, date, time, locationName: `Place ${date} ${i}`,
  })));
}

function geminiReplies(text) {
  mockSendMessage.mockResolvedValueOnce({ response: { text: () => text } });
}

/** Route db.query by SQL so tests don't depend on call order. */
function mockDb({ trips = [], activities = [], meta = {} } = {}) {
  db.query.mockImplementation(async (sql) => {
    if (/FROM trips t\s+JOIN trip_members/.test(sql)) return { rows: trips };
    if (/FROM trip_activities/.test(sql)) return { rows: activities };
    if (/SELECT planning_metadata FROM trips/.test(sql)) return { rows: [{ planning_metadata: meta }] };
    return { rows: [], rowCount: 0 };
  });
}

const goaTrip = {
  id: TRIP, name: 'Goa Dec 2026', start_date: '2026-12-01', end_date: '2026-12-04', location_name: 'Goa', role: 'admin',
};

describe('Swee itinerary flows', () => {
  const original = { gemini: { ...config.gemini }, guard: { ...config.sweeScopeGuard } };

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    config.gemini.apiKey = 'test-key';
    config.sweeScopeGuard.mode = 'enforce';
    scopeGuard.awaitVerdict.mockImplementation((p) => p);
    scopeGuard.checkScope.mockResolvedValue({ scope: 'in' });
    conversationsService.getConversation.mockResolvedValue({ id: CONV, tripContext: null });
    conversationsService.loadHistoryForGemini.mockResolvedValue({ history: [], memoryBlock: '', total: 0 });
    conversationsService.loadLastAssistantMessage.mockResolvedValue(null);
    conversationsService.appendMessages.mockResolvedValue({ id: MSG });
    conversationsService.appendAssistantMessage.mockResolvedValue({ id: 'm2' });
    itinerary.generateItinerary.mockImplementation(async ({ dates }) => ({
      activities: planOf(dates), plannedDates: dates, missing: [], truncated: false,
    }));
  });

  afterAll(() => {
    Object.assign(config.gemini, original.gemini);
    Object.assign(config.sweeScopeGuard, original.guard);
  });

  describe('chat → plan_itinerary (existing trip)', () => {
    const planAction = (extra = {}) => `Here's a day-by-day plan for your Goa trip:\n###ACTION${JSON.stringify({
      intent: 'plan_itinerary', readyToCreate: false, scope: 'in', tripId: TRIP, ...extra,
    })}`;

    it('plans every empty day (3 each) and returns a confirmable add_activities proposal', async () => {
      mockDb({
        trips: [goaTrip],
        activities: [{ activity_date: '2026-12-02', title: 'Baga Beach', location_name: 'Baga Beach' }],
        meta: { adults: 2, kids: 1, groupType: 'Family', travelFocus: ['Beaches'], budgetTier: 'Comfort' },
      });
      geminiReplies(planAction({ draft: { preferences: 'seafood' } }));

      const result = await aiService.chat(USER, 'plan my goa itinerary', { conversationId: CONV });

      const call = itinerary.generateItinerary.mock.calls[0][0];
      expect(call.dates).toEqual(['2026-12-01', '2026-12-03', '2026-12-04']); // 2nd already has activities
      expect(call).toMatchObject({
        destination: 'Goa',
        travellers: { adults: 2, kids: 1, seniors: 0 },
        groupType: 'Family',
        travelFocus: ['Beaches'],
        budgetTier: 'Comfort',
        preferences: 'seafood',
        avoidPlaces: ['Baga Beach'],
        tripStart: '2026-12-01',
        tripEnd: '2026-12-04',
      });

      expect(result.pendingAction).toEqual({
        intent: 'add_activities',
        readyToCreate: true,
        scope: 'in',
        tripId: TRIP,
        draft: { activities: planOf(['2026-12-01', '2026-12-03', '2026-12-04']) },
      });
      expect(result.reply).toMatch(/^Here's a day-by-day plan for your Goa trip:\n\n\*\*Tue 1 Dec\*\*\n- 09:30 /);
      expect(result.reply).toMatch(/\*\*Fri 4 Dec\*\*/);
      expect(result.reply).toMatch(/Add these to your itinerary\?$/);
      expect(conversationsService.appendMessages).toHaveBeenCalledWith(USER, CONV, expect.objectContaining({
        pendingAction: result.pendingAction,
      }));
    });

    it('plans the specific days the user asked for, even if they have activities', async () => {
      mockDb({ trips: [goaTrip], activities: [{ activity_date: '2026-12-02', title: 'x', location_name: 'x' }] });
      geminiReplies(planAction({ draft: { dates: ['2026-12-02', '2027-05-05'] } }));

      await aiService.chat(USER, 'plan day 2 again', { conversationId: CONV });
      expect(itinerary.generateItinerary.mock.calls[0][0].dates).toEqual(['2026-12-02']);
    });

    it('says so when every day already has activities (no proposal, no Gemini plan call)', async () => {
      mockDb({
        trips: [goaTrip],
        activities: ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'].map((d) => ({ activity_date: d, title: 't', location_name: null })),
      });
      geminiReplies(planAction());

      const result = await aiService.chat(USER, 'plan my itinerary', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
      expect(result.reply).toMatch(/Every day of Goa Dec 2026 already has activities/);
      expect(itinerary.generateItinerary).not.toHaveBeenCalled();
    });

    it('never plans a trip the user is not a member of', async () => {
      mockDb({ trips: [] });
      geminiReplies(planAction());

      const result = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
      expect(result.reply).toMatch(/couldn't find that trip/);
      expect(itinerary.generateItinerary).not.toHaveBeenCalled();
    });

    it('falls back to a friendly message when planning fails', async () => {
      mockDb({ trips: [goaTrip] });
      itinerary.generateItinerary.mockRejectedValueOnce(new Error('Itinerary generation failed'));
      geminiReplies(planAction());

      const result = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
      expect(result.reply).toMatch(/couldn't plan the itinerary just now/);
    });

    it('notes when a long trip was truncated or slots are still open', async () => {
      mockDb({ trips: [goaTrip] });
      itinerary.generateItinerary.mockResolvedValueOnce({
        activities: planOf(['2026-12-01']), plannedDates: ['2026-12-01'], missing: [{ date: '2026-12-01', slot: 'evening' }], truncated: true,
      });
      geminiReplies(planAction());

      const result = await aiService.chat(USER, 'plan it', { conversationId: CONV });
      expect(result.reply).toMatch(/first 30 days/);
      expect(result.reply).toMatch(/A few slots are still open/);
    });

    it('a blocked (out-of-scope) turn is never turned into a proposal', async () => {
      mockDb({ trips: [goaTrip] });
      scopeGuard.checkScope.mockResolvedValueOnce({ scope: 'out' });
      geminiReplies(planAction());

      const result = await aiService.chat(USER, 'write python and plan my trip', { conversationId: CONV });
      expect(result.pendingAction).toBeNull();
      expect(itinerary.generateItinerary).not.toHaveBeenCalled();
    });
  });

  describe('executeAction create_trip', () => {
    const createAction = (draft) => ({
      intent: 'create_trip',
      readyToCreate: true,
      draft: { destination: 'Goa', name: 'Goa Dec 2026', startDate: '2026-12-01', endDate: '2026-12-03', ...draft },
    });

    beforeEach(() => {
      mockDb();
      tripsService.createTrip.mockResolvedValue({ id: TRIP, name: 'Goa Dec 2026' });
    });

    it('without planItinerary: unchanged reply and no background planning', async () => {
      const result = await aiService.executeAction(USER, createAction({}), { conversationId: CONV });
      await aiService.waitForBackgroundJobs();

      expect(result.reply).toBe('Trip created! Add places and invite friends now.');
      expect(itinerary.generateItinerary).not.toHaveBeenCalled();
      expect(activitiesService.createActivity).not.toHaveBeenCalled();
    });

    it('with planItinerary: replies at once, then plans every day with the card values', async () => {
      const result = await aiService.executeAction(USER, createAction({
        planItinerary: true,
        itineraryPrefs: 'beaches and seafood',
        adults: 3,
        groupType: 'Friends',
        travelFocus: ['Nightlife'],
        budgetTier: 'Premium',
      }), { conversationId: CONV });

      expect(result.reply).toMatch(/planning your 3-day itinerary now/);
      expect(result.created).toEqual({ id: TRIP, type: 'trip', name: 'Goa Dec 2026' });

      await aiService.waitForBackgroundJobs();

      expect(itinerary.generateItinerary).toHaveBeenCalledWith(expect.objectContaining({
        destination: 'Goa',
        dates: ['2026-12-01', '2026-12-02', '2026-12-03'],
        travellers: { adults: 3, kids: 0, seniors: 0 },
        groupType: 'Friends',
        travelFocus: ['Nightlife'],
        budgetTier: 'Premium',
        preferences: 'beaches and seafood',
      }));
      expect(activitiesService.createActivity).toHaveBeenCalledTimes(9);
      expect(activitiesService.createActivity).toHaveBeenCalledWith(TRIP, USER, expect.objectContaining({
        locationName: 'Place 2026-12-01 0',
      }), { notify: false });

      expect(createAndSendNotifications).toHaveBeenCalledWith(
        [{ id: USER }],
        { title: 'Your itinerary is ready', body: 'Swee planned 9 activities across 3 days for "Goa Dec 2026".' },
        'ITINERARY_UPDATED',
        { tripId: TRIP, tripName: 'Goa Dec 2026' },
      );
      expect(conversationsService.appendAssistantMessage).toHaveBeenCalledWith(
        USER, CONV, expect.stringMatching(/Goa Dec 2026 itinerary is ready — 9 activities across 3 days/),
      );
      expect(activitiesService.notifyItineraryUpdated).toHaveBeenCalledWith(TRIP, USER, null, 9);
    });

    it('accepts planItinerary sent as the string "true"', async () => {
      const result = await aiService.executeAction(USER, createAction({ planItinerary: 'true' }));
      await aiService.waitForBackgroundJobs();
      expect(result.reply).toMatch(/planning your 3-day itinerary/);
      expect(itinerary.generateItinerary).toHaveBeenCalled();
    });

    it('keeps attachment activities inside the card dates and plans only the other days', async () => {
      await aiService.executeAction(USER, createAction({
        planItinerary: true,
        activities: [
          { title: 'Arrive + check in', date: '2026-12-01', time: '15:00' },
          { title: 'Outside the trip', date: '2026-11-20', time: '10:00' },
        ],
      }));
      await aiService.waitForBackgroundJobs();

      const titles = activitiesService.createActivity.mock.calls.map((c) => c[2].title);
      expect(titles).toContain('Arrive + check in');
      expect(titles).not.toContain('Outside the trip');
      expect(itinerary.generateItinerary.mock.calls[0][0].dates).toEqual(['2026-12-02', '2026-12-03']);
    });

    it('drops out-of-range attachment activities even without planItinerary (date bug fix)', async () => {
      await aiService.executeAction(USER, createAction({
        activities: [{ title: 'Way before', date: '2026-10-01', time: '10:00' }],
      }));
      expect(activitiesService.createActivity).not.toHaveBeenCalled();
    });

    it('when planning fails: trip still created, user told how to retry', async () => {
      itinerary.generateItinerary.mockRejectedValueOnce(new Error('Itinerary generation failed'));

      const result = await aiService.executeAction(USER, createAction({ planItinerary: true }), { conversationId: CONV });
      await aiService.waitForBackgroundJobs();

      expect(result.created.id).toBe(TRIP);
      expect(createAndSendNotifications).toHaveBeenCalledWith(
        [{ id: USER }],
        expect.objectContaining({ title: 'Itinerary not ready' }),
        'ITINERARY_UPDATED',
        { tripId: TRIP, tripName: 'Goa Dec 2026' },
      );
      expect(conversationsService.appendAssistantMessage).toHaveBeenCalledWith(
        USER, CONV, expect.stringMatching(/plan my Goa Dec 2026 itinerary/),
      );
    });
  });
});
