const {
  geminiRateLimitMessage,
  serviceBusyMessage,
  userHourlyLimitMessage,
  userDailyLimitMessage,
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
});
