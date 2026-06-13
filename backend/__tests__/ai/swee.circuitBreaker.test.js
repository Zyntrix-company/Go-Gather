const circuitBreaker = require('../../src/modules/ai/swee.circuitBreaker');

describe('swee.circuitBreaker', () => {
  beforeEach(() => {
    circuitBreaker._resetForTests();
  });

  it('starts closed', () => {
    expect(circuitBreaker.isOpen()).toBe(false);
    expect(circuitBreaker.getStatus().state).toBe('closed');
  });

  it('opens after threshold failures', () => {
    for (let i = 0; i < 5; i += 1) circuitBreaker.recordFailure();
    expect(circuitBreaker.isOpen()).toBe(true);
    expect(circuitBreaker.getStatus().state).toBe('open');
  });

  it('closes after success', () => {
    for (let i = 0; i < 5; i += 1) circuitBreaker.recordFailure();
    circuitBreaker.recordSuccess();
    expect(circuitBreaker.isOpen()).toBe(false);
    expect(circuitBreaker.getStatus().state).toBe('closed');
  });
});
