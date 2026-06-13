const { buildSweetSystemPrompt } = require('../../src/modules/ai/swee.config');

describe('swee.config buildSweetSystemPrompt', () => {
  const baseContext = {
    profile: { full_name: 'Priya', country: 'India', timezone: 'Asia/Kolkata' },
    trips: [{ id: 't1', name: 'Bali Jun 2026', location_name: 'Bali', start_date: '2026-06-01', end_date: '2026-06-07', member_names: 'Sam' }],
    events: [],
    frequentCompanions: [{ full_name: 'Sam', trips_together: 3 }],
    budgetTier: 'Comfort',
  };

  it('includes female persona and conversational trip flow', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/female AI/i);
    expect(prompt).toMatch(/CREATE FLOW — TRIPS/i);
    expect(prompt).toMatch(/FINAL CONFIRMATION TABLE/i);
    expect(prompt).not.toMatch(/show a complete form immediately/i);
  });

  it('includes event update flow', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/UPDATE FLOW — EVENTS/i);
    expect(prompt).toMatch(/update_event/i);
    expect(prompt).toMatch(/targetEventName/i);
  });

  it('injects personalization from user context', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/Priya/);
    expect(prompt).toMatch(/Home country: India/);
    expect(prompt).toMatch(/Frequent travel companions: Sam/);
    expect(prompt).toMatch(/Typical spending tier.*Comfort/);
  });

  it('applies anti-greeting rule on follow-up messages', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 4);
    expect(prompt).toMatch(/DO NOT start with "Hello"/i);
  });

  it('includes budget-tier price range guidance', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/Saver.*Comfort.*Premium.*Luxury/s);
  });

  it('injects conversation memory block when provided', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 4, '- User: Plan Mumbai trip');
    expect(prompt).toMatch(/EARLIER IN THIS CONVERSATION/i);
    expect(prompt).toMatch(/Plan Mumbai trip/);
  });
});
