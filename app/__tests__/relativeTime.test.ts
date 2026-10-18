import { getRelativeTime } from '../src/utils/relativeTime';

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const DAY = 86400 * 1000;
const ago = (ms: number) => getRelativeTime(NOW - ms, NOW);

describe('getRelativeTime', () => {
  it('keeps minutes and hours as before', () => {
    expect(ago(10 * 1000)).toBe('Just now');
    expect(ago(5 * 60 * 1000)).toBe('5 min ago');
    expect(ago(3 * 3600 * 1000)).toBe('3h ago');
  });

  it('uses days below 30 days', () => {
    expect(ago(1 * DAY)).toBe('1 day ago');
    expect(ago(2 * DAY)).toBe('2 days ago');
    expect(ago(29 * DAY)).toBe('29 days ago');
  });

  it('switches to months from 30 days up to a year', () => {
    expect(ago(30 * DAY)).toBe('1 month ago');
    expect(ago(59 * DAY)).toBe('1 month ago');
    expect(ago(60 * DAY)).toBe('2 months ago');
    expect(ago(121 * DAY)).toBe('4 months ago');
    expect(ago(364 * DAY)).toBe('11 months ago');
  });

  it('switches to years from 365 days', () => {
    expect(ago(365 * DAY)).toBe('1 year ago');
    expect(ago(729 * DAY)).toBe('1 year ago');
    expect(ago(730 * DAY)).toBe('2 years ago');
  });

  it('accepts an ISO string', () => {
    expect(getRelativeTime(new Date(NOW - 121 * DAY).toISOString(), NOW)).toBe('4 months ago');
  });
});
