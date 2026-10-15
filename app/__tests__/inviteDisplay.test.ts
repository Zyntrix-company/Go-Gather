import { inviteMetaLine, memberCountLabel } from '../src/utils/inviteDisplay';
import { fmtDisplayDate } from '../src/utils/date';

describe('inviteMetaLine', () => {
  const d1 = fmtDisplayDate('2026-12-01');
  const d5 = fmtDisplayDate('2026-12-05');

  it('shows a date range and the location', () => {
    expect(inviteMetaLine('2026-12-01T00:00:00.000Z', '2026-12-05T00:00:00.000Z', 'Goa')).toBe(`${d1} – ${d5} · Goa`);
  });

  it('collapses a single day (events) to one date', () => {
    expect(inviteMetaLine('2026-12-01', '2026-12-01', 'Home')).toBe(`${d1} · Home`);
  });

  it('copes with a missing location or missing dates', () => {
    expect(inviteMetaLine('2026-12-01', '2026-12-05', null)).toBe(`${d1} – ${d5}`);
    expect(inviteMetaLine(null, null, 'Goa')).toBe('Goa');
    expect(inviteMetaLine(null, null, null)).toBe('');
  });
});

describe('memberCountLabel', () => {
  it('pluralises', () => {
    expect(memberCountLabel(1)).toBe('1 member');
    expect(memberCountLabel(0)).toBe('0 members');
    expect(memberCountLabel(12)).toBe('12 members');
  });
});
