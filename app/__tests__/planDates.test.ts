import {
  endAfterStartChange,
  eventDateProblem,
  planDateMessage,
  todayIso,
  tripDatesProblem,
} from '../src/utils/planDates';

const TODAY = '2026-10-18';

describe('todayIso', () => {
  it('formats local date with zero padding', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 9, 18))).toBe('2026-10-18');
  });
});

describe('tripDatesProblem', () => {
  it('needs both dates', () => {
    expect(tripDatesProblem('', '', TODAY)).toBe('missing');
    expect(tripDatesProblem('2026-12-01', '', TODAY)).toBe('missing');
    expect(tripDatesProblem('', '2026-12-05', TODAY)).toBe('missing');
  });

  it('rejects a start in the past, even if it was prefilled', () => {
    expect(tripDatesProblem('2026-10-17', '2026-10-20', TODAY)).toBe('in-past');
  });

  it('rejects an end before the start', () => {
    expect(tripDatesProblem('2026-12-05', '2026-12-01', TODAY)).toBe('end-before-start');
  });

  it('accepts today as the start and a one-day trip', () => {
    expect(tripDatesProblem(TODAY, TODAY, TODAY)).toBeNull();
    expect(tripDatesProblem('2026-12-01', '2026-12-05', TODAY)).toBeNull();
  });
});

describe('eventDateProblem', () => {
  it('needs a date that is today or later', () => {
    expect(eventDateProblem('', TODAY)).toBe('missing');
    expect(eventDateProblem('2026-10-17', TODAY)).toBe('in-past');
    expect(eventDateProblem(TODAY, TODAY)).toBeNull();
    expect(eventDateProblem('2027-01-01', TODAY)).toBeNull();
  });
});

describe('endAfterStartChange', () => {
  it('clears an end that now falls before the new start', () => {
    expect(endAfterStartChange('2026-12-10', '2026-12-05')).toBe('');
  });

  it('keeps an end that is on or after the new start', () => {
    expect(endAfterStartChange('2026-12-05', '2026-12-05')).toBe('2026-12-05');
    expect(endAfterStartChange('2026-12-01', '2026-12-05')).toBe('2026-12-05');
  });

  it('leaves an empty end alone', () => {
    expect(endAfterStartChange('2026-12-01', '')).toBe('');
  });
});

describe('planDateMessage', () => {
  it('says what to fix for each problem', () => {
    expect(planDateMessage('missing', 'trip')).toMatch(/start and end/);
    expect(planDateMessage('missing', 'event')).toMatch(/Pick a date/);
    expect(planDateMessage('in-past', 'trip')).toMatch(/start date/);
    expect(planDateMessage('end-before-start', 'trip')).toMatch(/on or after/);
  });
});
