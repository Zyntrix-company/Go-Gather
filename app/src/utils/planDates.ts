/**
 * Date rules for the Swee trip / event cards. All dates are ISO 'YYYY-MM-DD', which
 * compare correctly as plain strings.
 */

export type PlanDateProblem = 'missing' | 'in-past' | 'end-before-start';

/** Today's local date as 'YYYY-MM-DD'. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** What is wrong with a trip's start/end pair, or null when it can be created. */
export function tripDatesProblem(start: string, end: string, today: string = todayIso()): PlanDateProblem | null {
  if (!start || !end) return 'missing';
  if (start < today) return 'in-past';
  if (end < start) return 'end-before-start';
  return null;
}

/** What is wrong with an event's date, or null when it can be created. */
export function eventDateProblem(date: string, today: string = todayIso()): PlanDateProblem | null {
  if (!date) return 'missing';
  if (date < today) return 'in-past';
  return null;
}

/** Moving the start past the end leaves the end meaningless, so it is cleared. */
export function endAfterStartChange(newStart: string, currentEnd: string): string {
  return currentEnd && newStart && currentEnd < newStart ? '' : currentEnd;
}

/** One line telling the user how to fix the problem. */
export function planDateMessage(problem: PlanDateProblem, kind: 'trip' | 'event'): string {
  switch (problem) {
    case 'missing':
      return kind === 'trip' ? 'Pick start and end dates to continue.' : 'Pick a date to continue.';
    case 'in-past':
      return kind === 'trip' ? "The start date can't be in the past." : "The date can't be in the past.";
    case 'end-before-start':
      return 'The end date must be on or after the start date.';
  }
}
