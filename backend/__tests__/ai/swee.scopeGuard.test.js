const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));

const config = require('../../src/config');
const circuitBreaker = require('../../src/modules/ai/swee.circuitBreaker');
const {
  checkScope,
  awaitVerdict,
  skipReason,
  buildClassifierInput,
  parseVerdict,
} = require('../../src/modules/ai/swee.scopeGuard');

function respondWith(text) {
  mockGenerateContent.mockResolvedValueOnce({ response: { text: () => text } });
}

describe('swee.scopeGuard', () => {
  const original = { gemini: { ...config.gemini }, guard: { ...config.sweeScopeGuard } };

  beforeEach(() => {
    mockGenerateContent.mockReset();
    config.gemini.apiKey = 'test-key';
    config.sweeScopeGuard.mode = 'enforce';
    config.sweeScopeGuard.timeoutMs = 50;
  });

  afterAll(() => {
    Object.assign(config.gemini, original.gemini);
    Object.assign(config.sweeScopeGuard, original.guard);
  });

  describe('skipReason', () => {
    it.each([
      'Yes', 'No', 'yes!', 'ok', 'Goa', 'next weekend', 'yes please', 'No, different one',
      'the second one', '2026-06-01', '4', '15/06 - 20/06',
    ])('skips short reply %p', (message) => {
      expect(skipReason({ message })).toBe('short_reply');
    });

    it('skips attachment turns', () => {
      expect(skipReason({ message: 'what is in this file please', attachments: [{ mimeType: 'application/pdf' }] }))
        .toBe('attachments');
    });

    it('skips everything when mode is off', () => {
      config.sweeScopeGuard.mode = 'off';
      expect(skipReason({ message: 'write python code to split expenses' })).toBe('off');
    });

    it('does not skip real requests', () => {
      expect(skipReason({ message: 'write python code to split expenses' })).toBeNull();
      expect(skipReason({ message: 'the Goa one please' })).toBeNull();
    });
  });

  describe('parseVerdict', () => {
    it('parses valid JSON', () => {
      expect(parseVerdict('{"scope":"out","category":"coding"}')).toEqual({ scope: 'out', category: 'coding' });
    });
    it('accepts fenced JSON', () => {
      expect(parseVerdict('```json\n{"scope":"in"}\n```')).toEqual({ scope: 'in', category: null });
    });
    it('rejects unknown scope and garbage', () => {
      expect(parseVerdict('{"scope":"maybe"}')).toBeNull();
      expect(parseVerdict('not json')).toBeNull();
      expect(parseVerdict('')).toBeNull();
    });
  });

  describe('buildClassifierInput', () => {
    it('includes trip context, the last Swee message and the user message as data', () => {
      const input = buildClassifierInput({
        message: 'the Goa one',
        lastAssistantMessage: 'Which trip do you mean?',
        tripContext: { name: 'Goa Jun 2026', contextType: 'trip' },
      });
      expect(input).toMatch(/Active trip: Goa Jun 2026/);
      expect(input).toMatch(/Swee's previous message: """Which trip do you mean\?"""/);
      expect(input).toMatch(/USER MESSAGE: """the Goa one"""/);
    });

    it('truncates long messages', () => {
      const input = buildClassifierInput({ message: 'a'.repeat(5000) });
      expect(input.length).toBeLessThan(1700);
    });
  });

  describe('checkScope', () => {
    it('returns the classifier verdict', async () => {
      respondWith('{"scope":"out","category":"coding"}');
      await expect(checkScope({ message: 'write python code to split our Goa expenses' }))
        .resolves.toEqual({ scope: 'out', category: 'coding' });
    });

    it('does not call Gemini for skipped messages', async () => {
      await expect(checkScope({ message: 'Yes' })).resolves.toEqual({ scope: 'in', skipped: 'short_reply' });
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('fails open on bad output', async () => {
      respondWith('I think this is out of scope');
      await expect(checkScope({ message: 'write an essay about Goa' }))
        .resolves.toEqual({ scope: 'unsure', error: 'bad_output' });
    });

    it('fails open on API errors (e.g. 429) without touching the circuit breaker', async () => {
      const failSpy = jest.spyOn(circuitBreaker, 'recordFailure');
      mockGenerateContent.mockRejectedValueOnce(Object.assign(new Error('429 resource exhausted'), { status: 429 }));
      await expect(checkScope({ message: 'write an essay about Goa' }))
        .resolves.toEqual({ scope: 'unsure', error: 'error' });
      expect(failSpy).not.toHaveBeenCalled();
      failSpy.mockRestore();
    });

    it('awaitVerdict returns the verdict when it is ready within the grace period', async () => {
      await expect(awaitVerdict(Promise.resolve({ scope: 'out' }), 50)).resolves.toEqual({ scope: 'out' });
    });

    it('awaitVerdict fails open when the classifier is still running after the grace period', async () => {
      await expect(awaitVerdict(new Promise(() => {}), 20)).resolves.toEqual({ scope: 'unsure', error: 'late' });
    });

    it('fails open on timeout', async () => {
      mockGenerateContent.mockImplementationOnce(() => new Promise(() => {}));
      await expect(checkScope({ message: 'write an essay about Goa' }))
        .resolves.toEqual({ scope: 'unsure', error: 'timeout' });
    });
  });
});
