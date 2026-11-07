const {
  parseActionBlock,
  shortenActivityTitle,
  normalizeSweeReply,
  generateTripName,
  resolveEventType,
  parseActivityTime,
  parseEventTime,
  requireIsoDate,
  requireNonEmptyString,
  inferBudgetTier,
  buildPlanningMetadata,
  badRequest,
  toIsoDateString,
  isUuid,
} = require('../../src/modules/ai/ai.helpers');

describe('ai.helpers', () => {

  describe('plan_itinerary action', () => {
    const block = (action) => `Here's a plan for your trip:\n###ACTION${JSON.stringify(action)}`;
    const TRIP_ID = 'aaaa0001-0000-4000-8000-000000000001';

    it('is passed on (for the server to plan) with a trip id or trip name', () => {
      const withId = parseActionBlock(block({ intent: 'plan_itinerary', readyToCreate: false, scope: 'in', tripId: TRIP_ID }));
      expect(withId.pendingAction).toMatchObject({ intent: 'plan_itinerary', tripId: TRIP_ID });
      expect(withId.reply).toBe('Here\'s a plan for your trip:');

      const withName = parseActionBlock(block({ intent: 'plan_itinerary', readyToCreate: false, targetTripName: 'Goa' }));
      expect(withName.pendingAction).toMatchObject({ intent: 'plan_itinerary', targetTripName: 'Goa' });
    });

    it('is rejected without a usable trip', () => {
      const parsed = parseActionBlock(block({ intent: 'plan_itinerary', readyToCreate: false, tripId: 'Goa trip' }));
      expect(parsed.pendingAction).toBeNull();
      expect(parsed.actionParseError).toBe('plan_itinerary_missing_trip');
    });
  });

  describe('add_activities action', () => {
    const block = (action) => `Here you go.\n###ACTION${JSON.stringify(action)}`;
    const good = {
      intent: 'add_activities',
      readyToCreate: true,
      scope: 'in',
      tripId: 'aaaa0001-0000-4000-8000-000000000001',
      draft: { activities: [{ title: 'Hagia Sophia visit', date: '2026-12-27', time: '09:00' }] },
    };

    it('is a recognised intent and is kept as a pending action', () => {
      const parsed = parseActionBlock(block(good));
      expect(parsed.actionParseError).toBeUndefined();
      expect(parsed.pendingAction).toMatchObject({ intent: 'add_activities', tripId: 'aaaa0001-0000-4000-8000-000000000001' });
    });

    it('drops the action (keeping the reply) when activities or tripId are missing', () => {
      const noActs = parseActionBlock(block({ ...good, draft: { activities: [] } }));
      expect(noActs.pendingAction).toBeNull();
      expect(noActs.actionParseError).toBe('add_activities_missing_activities');
      expect(noActs.reply).toBe('Here you go.');

      const noTrip = parseActionBlock(block({ ...good, tripId: undefined }));
      expect(noTrip.pendingAction).toBeNull();
      expect(noTrip.actionParseError).toBe('add_activities_missing_trip');
    });

    it('rejects more than 90 activities at parse time and replaces the unusable table', () => {
      const many = Array.from({ length: 91 }, (_, i) => ({ title: `Act ${i}`, date: '2026-12-27' }));
      const parsed = parseActionBlock(`| Day | Time | Activity |
|---|---|---|
| Sun | 09:00 | x |
###ACTION${JSON.stringify({ ...good, draft: { activities: many } })}`);
      expect(parsed.pendingAction).toBeNull();
      expect(parsed.actionParseError).toBe('add_activities_too_many');
      expect(parsed.reply).toMatch(/up to 90 activities at a time/);
      expect(parsed.reply).not.toContain('| Day |');
    });

    it('accepts exactly 90 (a 30-day trip, 3 per day)', () => {
      const twenty = Array.from({ length: 90 }, (_, i) => ({ title: `Act ${i}`, date: '2026-12-27' }));
      expect(parseActionBlock(block({ ...good, draft: { activities: twenty } })).pendingAction).not.toBeNull();
    });

    it('needs a UUID tripId or a trip name; a name-as-id is not enough on its own', () => {
      const byName = parseActionBlock(block({ ...good, tripId: 'Turkey trip', targetTripName: 'Turkey' }));
      expect(byName.pendingAction).not.toBeNull();

      const nameAsId = parseActionBlock(block({ ...good, tripId: 'Turkey trip' }));
      expect(nameAsId.pendingAction).toBeNull();
      expect(nameAsId.actionParseError).toBe('add_activities_missing_trip');
    });

    it('shortens long activity titles like create_trip does', () => {
      const long = { ...good, draft: { activities: [{ title: 'A very long guided walking tour through the old city bazaar', date: '2026-12-27' }] } };
      expect(parseActionBlock(block(long)).pendingAction.draft.activities[0].title.length).toBeLessThanOrEqual(35);
    });

    it('keeps a Day | Time | Activity proposal table three-column (not rewritten as Field | Details)', () => {
      const raw = [
        'Here is a plan:',
        '| Day | Time | Activity |',
        '|---|---|---|',
        '| Sat 27 Dec | 09:00 | Hagia Sophia visit |',
        '| Sat 27 Dec | 18:30 | Bosphorus dinner |',
      ].join('\n');
      const out = normalizeSweeReply(raw);
      expect(out).toContain('| Day | Time | Activity |');
      expect(out).toContain('| Sat 27 Dec | 09:00 | Hagia Sophia visit |');
      expect(out).not.toContain('Field');
    });
  });

  describe('isUuid', () => {
    it('accepts UUIDs only', () => {
      expect(isUuid('aaaa0001-0000-4000-8000-000000000001')).toBe(true);
      expect(isUuid('e1')).toBe(false);
      expect(isUuid("1' OR '1'='1")).toBe(false);
      expect(isUuid(null)).toBe(false);
    });
  });

  describe('toIsoDateString', () => {
    it('reads strings, ISO timestamps and local-midnight Dates', () => {
      expect(toIsoDateString('2026-11-05')).toBe('2026-11-05');
      expect(toIsoDateString('2026-11-05T00:00:00.000Z')).toBe('2026-11-05');
      expect(toIsoDateString(new Date(2026, 10, 5))).toBe('2026-11-05');
    });
    it('returns null for junk', () => {
      expect(toIsoDateString(null)).toBeNull();
      expect(toIsoDateString('soon')).toBeNull();
      expect(toIsoDateString(new Date('nope'))).toBeNull();
    });
  });

  describe('normalizeSweeReply', () => {
    it('strips HTML table tags and fixes brand name', () => {
      const raw = '<table>| Field | Details |\n| Trip | Bali |</table>\nBuilt into GatherGo';
      const out = normalizeSweeReply(raw);
      expect(out).not.toMatch(/<table>/i);
      expect(out).toMatch(/GatherrGo/);
      expect(out).not.toMatch(/GatherGo/i);
    });

    it('normalizes confirmation tables to two columns with standard separator', () => {
      const raw = [
        '| Field | Details | Extra |',
        '|---|---|---|',
        '| Trip Name | Bali Jun | ignore |',
      ].join('\n');
      const out = normalizeSweeReply(raw);
      expect(out).toMatch(/\| Field \| Details \|/);
      expect(out).toMatch(/\| --- \| --- \|/);
      expect(out).toMatch(/\| Trip Name \| Bali Jun · ignore \|/);
    });
  });

  describe('parseActionBlock', () => {
    it('strips ###ACTION and returns pendingAction when readyToCreate', () => {
      const raw = 'Create this trip?\n###ACTION{"intent":"create_trip","readyToCreate":true,"draft":{"destination":"Bali"}}';
      const { reply, pendingAction } = parseActionBlock(raw);
      expect(reply).toBe('Create this trip?');
      expect(pendingAction).toEqual({
        intent: 'create_trip',
        readyToCreate: true,
        draft: { destination: 'Bali' },
      });
    });

    it('returns identify_update as pendingAction even when not readyToCreate', () => {
      const raw = 'Is this the one?\n###ACTION{"intent":"identify_update","readyToCreate":false,"targetTripName":"Bali"}';
      const { pendingAction } = parseActionBlock(raw);
      expect(pendingAction?.intent).toBe('identify_update');
    });

    it('returns null pendingAction for draft-only actions', () => {
      const raw = 'What dates?\n###ACTION{"intent":"create_trip","readyToCreate":false,"draft":{"destination":"Bali"}}';
      const { pendingAction } = parseActionBlock(raw);
      expect(pendingAction).toBeNull();
    });

    it('handles missing action block', () => {
      const { reply, pendingAction } = parseActionBlock('Hello there');
      expect(reply).toBe('Hello there');
      expect(pendingAction).toBeNull();
    });

    it('returns fallback when ACTION JSON is invalid', () => {
      const raw = 'Create this?\n###ACTION{not valid json';
      const { reply, pendingAction, actionParseError } = parseActionBlock(raw);
      expect(reply).toBe('Create this?');
      expect(pendingAction).toBeNull();
      expect(actionParseError).toBe('json_parse_failed');
    });

    it('rejects readyToCreate with invalid intent', () => {
      const raw = 'Go?\n###ACTION{"intent":"bogus","readyToCreate":true}';
      const { pendingAction, actionParseError } = parseActionBlock(raw);
      expect(pendingAction).toBeNull();
      expect(actionParseError).toBe('invalid_intent');
    });

    it('rejects ready create_trip without draft fields', () => {
      const raw = 'Create?\n###ACTION{"intent":"create_trip","readyToCreate":true,"draft":{}}';
      const { pendingAction, actionParseError } = parseActionBlock(raw);
      expect(pendingAction).toBeNull();
      expect(actionParseError).toBe('create_trip_missing_draft');
    });

    it('returns the self-reported scope', () => {
      const raw = 'That\'s outside what I do.\n###ACTION{"intent":"none","readyToCreate":false,"scope":"out"}';
      expect(parseActionBlock(raw)).toEqual(expect.objectContaining({
        reply: 'That\'s outside what I do.',
        pendingAction: null,
        scope: 'out',
      }));
    });

    it('defaults scope to "in" when missing, invalid, or there is no ACTION line', () => {
      expect(parseActionBlock('Hi\n###ACTION{"intent":"none","readyToCreate":false}').scope).toBe('in');
      expect(parseActionBlock('Hi\n###ACTION{"intent":"none","readyToCreate":false,"scope":"maybe"}').scope).toBe('in');
      expect(parseActionBlock('Hello there').scope).toBe('in');
    });

    it('a scope key does not affect a valid form action', () => {
      const raw = 'Tell me about your trip.\n###ACTION{"intent":"create_trip","readyToCreate":false,"showForm":"trip","scope":"in","draft":{"destination":"Goa"}}';
      const { pendingAction, scope } = parseActionBlock(raw);
      expect(pendingAction).toEqual(expect.objectContaining({ intent: 'create_trip', showForm: 'trip' }));
      expect(scope).toBe('in');
    });

    it('reads scope "out" even when the ACTION JSON is malformed', () => {
      const { scope, actionParseError } = parseActionBlock('Nope.\n###ACTION{"intent":"none","scope":"out",');
      expect(actionParseError).toBe('json_parse_failed');
      expect(scope).toBe('out');
    });
  });

  describe('generateTripName', () => {
    it('combines destination and month/year', () => {
      expect(generateTripName('Bali', '2026-06-01')).toMatch(/^Bali Jun 2026$/);
    });

    it('truncates to 20 characters', () => {
      const name = generateTripName('Very Long Destination Name', '2026-06-01');
      expect(name.length).toBeLessThanOrEqual(20);
    });
  });

  describe('resolveEventType', () => {
    it('maps dinner to Party', () => {
      expect(resolveEventType('dinner')).toBe('Party');
    });

    it('maps workshop to Professional', () => {
      expect(resolveEventType('workshop')).toBe('Professional');
    });

    it('returns Other for unknown labels', () => {
      expect(resolveEventType('random thing')).toBe('Other');
    });
  });

  describe('parseActivityTime', () => {
    it('parses HH:MM string', () => {
      expect(parseActivityTime('17:30')).toEqual({ hour: 17, minute: 30 });
    });

    it('parses object', () => {
      expect(parseActivityTime({ hour: 9, minute: 0 })).toEqual({ hour: 9, minute: 0 });
    });
  });

  describe('parseEventTime', () => {
    it('returns zero-padded HH:MM for DB', () => {
      expect(parseEventTime('8:00')).toBe('08:00');
      expect(parseEventTime('20:00')).toBe('20:00');
    });
  });

  describe('requireIsoDate', () => {
    it('accepts valid ISO date', () => {
      expect(requireIsoDate('2026-06-01', 'Start date')).toBe('2026-06-01');
    });

    it('throws for missing date', () => {
      expect(() => requireIsoDate('', 'Start date')).toThrow('Start date is required');
    });
  });

  describe('requireNonEmptyString', () => {
    it('trims and returns value', () => {
      expect(requireNonEmptyString('  Bali  ', 'Destination')).toBe('Bali');
    });

    it('throws for empty string', () => {
      expect(() => requireNonEmptyString('  ', 'Destination')).toThrow('Destination is required');
    });
  });

  describe('inferBudgetTier', () => {
    it('returns Saver for low averages', () => {
      expect(inferBudgetTier(15)).toBe('Saver');
    });

    it('returns Luxury for high averages', () => {
      expect(inferBudgetTier(500)).toBe('Luxury');
    });

    it('returns null for zero', () => {
      expect(inferBudgetTier(0)).toBeNull();
    });
  });

  describe('buildPlanningMetadata', () => {
    it('includes swee source and draft extras', () => {
      const meta = buildPlanningMetadata({
        destination: 'Bali',
        budgetTier: 'Premium',
        notes: 'vegetarian',
      });
      expect(meta.source).toBe('swee');
      expect(meta.budgetTier).toBe('Premium');
      expect(meta.notes).toBe('vegetarian');
      expect(meta.destination).toBeUndefined();
    });
  });

  describe('badRequest', () => {
    it('sets statusCode 400', () => {
      const err = badRequest('test');
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('test');
    });
  });

  describe('shortenActivityTitle', () => {
    it('keeps titles of 35 characters or fewer unchanged', () => {
      expect(shortenActivityTitle('Snorkelling at Nusa Penida')).toBe('Snorkelling at Nusa Penida');
      const exact = 'a'.repeat(35);
      expect(shortenActivityTitle(exact)).toBe(exact);
    });

    it('cuts long titles at a word boundary, never over 35 characters', () => {
      const out = shortenActivityTitle('Sunset dinner cruise along the Chao Phraya River with live music');
      expect(out.length).toBeLessThanOrEqual(35);
      expect(out).toBe('Sunset dinner cruise along the Chao');
    });

    it('drops a dangling connector word or punctuation at the cut', () => {
      const out = shortenActivityTitle('Morning walk through the old town and the night market');
      expect(out.length).toBeLessThanOrEqual(35);
      expect(out).toBe('Morning walk through the old town');
    });

    it('hard-cuts a single very long word', () => {
      expect(shortenActivityTitle('x'.repeat(50))).toHaveLength(35);
    });

    it('never splits an emoji in half when hard-cutting', () => {
      const out = shortenActivityTitle('Kayaking' + '🌊'.repeat(20));
      expect(out.length).toBeLessThanOrEqual(35);
      // 'Kayaking' (8) + 13 whole waves (26) = 34; a 14th would need 2 more units.
      expect(out).toBe('Kayaking' + '🌊'.repeat(13));
      expect(out).not.toMatch(/[\uD800-\uDBFF]$/);
    });

    it('applies to activities in a parsed ACTION block', () => {
      const raw = 'Here you go.\n###ACTION{"intent":"create_trip","readyToCreate":false,"showForm":"trip","scope":"in","draft":{"destination":"Bali","activities":[{"title":"Full-day snorkelling and diving trip around Nusa Penida island","date":"2026-07-20","time":"08:00"}]}}';
      const { pendingAction } = parseActionBlock(raw);
      const title = pendingAction.draft.activities[0].title;
      expect(title.length).toBeLessThanOrEqual(35);
      expect(title).toBe('Full-day snorkelling and diving');
    });
  });
});
