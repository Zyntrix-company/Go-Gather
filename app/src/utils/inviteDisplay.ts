import { daysUntil, fmtDisplayDate, fmtFullDate } from './date';

type InviteKind = 'trip' | 'event';

/**
 * Date text exactly as the home cards write it: trips "Dec 1 – Dec 5" (one date when
 * the range is a single day), events "1 Dec 2026".
 */
export function inviteDateLabel(
  type: InviteKind,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  if (!startDate) return 'Date TBD';
  if (type === 'event') return fmtFullDate(startDate);
  const start = fmtDisplayDate(startDate);
  const end = endDate ? fmtDisplayDate(endDate) : start;
  return end === start ? start : `${start} – ${end}`;
}

/** "Priya invited you to a trip" — falls back to "Someone" when the inviter has no name. */
export function inviteHeadline(inviterName: string | null | undefined, type: InviteKind): string {
  const who = inviterName?.trim() || 'Someone';
  return `${who} invited you to ${type === 'trip' ? 'a trip' : 'an event'}`;
}

/** Days until it starts, or undefined when it has started / the date is unknown (the card hides the badge). */
export function inviteDaysToGo(startDate: string | null | undefined): number | undefined {
  if (!startDate) return undefined;
  const days = daysUntil(startDate.includes('T') ? startDate.split('T')[0] : startDate);
  return days > 0 ? days : undefined;
}
