const sweeMetrics = require('../../src/modules/ai/swee.metrics');

describe('swee.metrics', () => {
  beforeEach(() => {
    sweeMetrics._resetForTests();
  });

  it('tracks error rate in snapshot', () => {
    sweeMetrics.recordChatResult(true);
    sweeMetrics.recordChatResult(true);
    sweeMetrics.recordChatResult(false, 'RATE_LIMIT');
    const snap = sweeMetrics.getSnapshot();
    expect(snap.totalRequests).toBe(3);
    expect(snap.failedRequests).toBe(1);
    expect(snap.errorRate).toBeCloseTo(1 / 3, 3);
  });
});
