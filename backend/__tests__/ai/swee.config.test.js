const { buildSweetSystemPrompt } = require('../../src/modules/ai/swee.config');

describe('swee.config buildSweetSystemPrompt', () => {
  const baseContext = {
    profile: { full_name: 'Priya', country: 'India', timezone: 'Asia/Kolkata' },
    trips: [{ id: 't1', name: 'Bali Jun 2026', location_name: 'Bali', start_date: '2026-06-01', end_date: '2026-06-07', member_names: 'Sam' }],
    events: [],
    frequentCompanions: [{ full_name: 'Sam', trips_together: 3 }],
    budgetTier: 'Comfort',
  };

  it('uses GatherrGo brand name in prompt', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/GatherrGo/);
    expect(prompt).not.toMatch(/built into GatherGo/i);
  });

  it('injects today date context for relative scheduling', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/TODAY'S DATE/i);
    expect(prompt).toMatch(/next weekend/i);
    expect(prompt).toMatch(/Asia\/Kolkata/);
  });

  it('includes female persona and form-driven trip flow', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/female AI/i);
    expect(prompt).toMatch(/CREATE FLOW — TRIPS/i);
    // Trip creation is now collected via the structured planning card (showForm),
    // not a text confirmation table.
    expect(prompt).toMatch(/showForm/);
    expect(prompt).toMatch(/planning form/i);
  });

  it('teaches the trip vs event distinction and mismatch handling', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/TRIP vs EVENT/i);
    expect(prompt).toMatch(/multi-day trip than an event/i);
  });

  it('explains attachment (document/photo) handling', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/ATTACHMENTS/i);
    expect(prompt).toMatch(/itinerary/i);
  });

  it('requires trip disambiguation before identify_update chips', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 1);
    expect(prompt).toMatch(/does NOT name a specific trip/i);
    expect(prompt).toMatch(/Which trip do you mean/i);
    expect(prompt).toMatch(/Do NOT show Yes\/No identification chips/i);
    expect(prompt).toMatch(/ONLY after user named or chose a specific trip/i);
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

  it('puts the strict SCOPE section before everything else', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 0);
    const scopeIdx = prompt.indexOf('SCOPE (HIGHEST PRIORITY');
    expect(scopeIdx).toBeGreaterThan(-1);
    expect(scopeIdx).toBeLessThan(prompt.indexOf('WHAT MATTERS MOST'));
    expect(prompt).toMatch(/Judge EVERY message on its own/);
    expect(prompt).toMatch(/no partial answer/i);
    expect(prompt).toMatch(/even when it mentions a trip, destination or event/i);
  });

  it('requires a scope field in the ACTION line', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 0);
    expect(prompt).toMatch(/scope: "in" \| "out"/);
    expect(prompt).toMatch(/"scope":"out"/);
  });

  it('refuses non-travel attachments instead of describing them', () => {
    const prompt = buildSweetSystemPrompt(baseContext, null, 0);
    expect(prompt).toMatch(/do NOT describe, summarize, solve or work on it/);
    expect(prompt).not.toMatch(/say briefly what you see/i);
  });
});
