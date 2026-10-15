import { fmtDisplayDate } from './date';

/** "Dec 1 – Dec 5 · Goa", "Dec 10 · Home", or just the location / dates when one is missing. */
export function inviteMetaLine(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  locationName: string | null | undefined,
): string {
  let dates = '';
  if (startDate) {
    const start = fmtDisplayDate(startDate);
    const end = endDate ? fmtDisplayDate(endDate) : start;
    dates = end === start ? start : `${start} – ${end}`;
  }
  return [dates, locationName].filter(Boolean).join(' · ');
}

export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}
