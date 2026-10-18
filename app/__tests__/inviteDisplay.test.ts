import { inviteDateLabel, inviteDaysToGo, inviteHeadline } from '../src/utils/inviteDisplay';
import { fmtDisplayDate, fmtFullDate } from '../src/utils/date';

describe('inviteDateLabel', () => {
  const d1 = fmtDisplayDate('2026-12-01');
  const d5 = fmtDisplayDate('2026-12-05');

  it('writes a trip range like the home card', () => {
    expect(inviteDateLabel('trip', '2026-12-01T00:00:00.000Z', '2026-12-05T00:00:00.000Z')).toBe(`${d1} – ${d5}`);
  });

  it('collapses a one-day trip or a missing end date to a single date', () => {
    expect(inviteDateLabel('trip', '2026-12-01', '2026-12-01')).toBe(d1);
    expect(inviteDateLabel('trip', '2026-12-01', null)).toBe(d1);
  });

  it('writes an event as one full date', () => {
    expect(inviteDateLabel('event', '2026-12-01', '2026-12-01')).toBe(fmtFullDate('2026-12-01'));
  });

  it('says TBD when there is no date', () => {
    expect(inviteDateLabel('trip', null, null)).toBe('Date TBD');
    expect(inviteDateLabel('event', undefined, undefined)).toBe('Date TBD');
  });
});

describe('inviteHeadline', () => {
  it('names the inviter and the kind of invite', () => {
    expect(inviteHeadline('Priya', 'trip')).toBe('Priya invited you to a trip');
    expect(inviteHeadline('Priya', 'event')).toBe('Priya invited you to an event');
  });

  it('falls back to Someone for a missing or blank name', () => {
    expect(inviteHeadline(null, 'trip')).toBe('Someone invited you to a trip');
    expect(inviteHeadline('  ', 'event')).toBe('Someone invited you to an event');
  });
});

describe('inviteDaysToGo', () => {
  const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  it('counts days for a future start', () => {
    expect(inviteDaysToGo(inDays(9))).toBe(9);
    expect(inviteDaysToGo(`${inDays(3)}T00:00:00.000Z`)).toBe(3);
  });

  it('hides the badge for today, the past or an unknown date', () => {
    expect(inviteDaysToGo(inDays(0))).toBeUndefined();
    expect(inviteDaysToGo(inDays(-4))).toBeUndefined();
    expect(inviteDaysToGo(null)).toBeUndefined();
  });
});
