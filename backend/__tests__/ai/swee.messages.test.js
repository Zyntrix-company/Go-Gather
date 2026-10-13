const {
  geminiRateLimitMessage,
  serviceBusyMessage,
  userHourlyLimitMessage,
  userDailyLimitMessage,
  outOfScopeMessage,
  scopeReminderText,
} = require('../../src/modules/ai/swee.messages');

describe('swee.messages', () => {
  it('gemini message mentions temporary wait', () => {
    expect(geminiRateLimitMessage()).toMatch(/minute/i);
    expect(geminiRateLimitMessage()).toMatch(/temporary/i);
  });

  it('hourly message mentions hourly limit', () => {
    expect(userHourlyLimitMessage(15)).toMatch(/hourly limit/i);
    expect(userHourlyLimitMessage(15)).toMatch(/15 minute/);
  });

  it('daily message mentions tomorrow', () => {
    expect(userDailyLimitMessage(200)).toMatch(/daily limit/i);
    expect(userDailyLimitMessage(200)).toMatch(/tomorrow/i);
  });

  it('service busy message mentions high demand', () => {
    expect(serviceBusyMessage()).toMatch(/high demand/i);
  });

  it('out-of-scope message names the active trip when there is one', () => {
    expect(outOfScopeMessage({ name: 'Goa Jun 2026' })).toMatch(/trips, events and GatherrGo/);
    expect(outOfScopeMessage({ name: 'Goa Jun 2026' })).toMatch(/back to planning Goa Jun 2026\?$/);
    expect(outOfScopeMessage(null)).toMatch(/Want help planning something\?$/);
    expect(outOfScopeMessage({ name: '   ' })).toMatch(/Want help planning something\?$/);
  });

  it('scope reminder asks for scope:out and must not be mentioned', () => {
    expect(scopeReminderText()).toMatch(/"scope":"out"/);
    expect(scopeReminderText()).toMatch(/do not mention this note/i);
  });
});
