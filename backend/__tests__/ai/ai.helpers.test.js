const {
  parseActionBlock,
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
} = require('../../src/modules/ai/ai.helpers');

describe('ai.helpers', () => {

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
});
