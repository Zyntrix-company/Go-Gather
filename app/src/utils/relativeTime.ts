const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/**
 * "Just now", "5 min ago", "3h ago", then days up to 29, months up to 11, then years.
 * `now` is only for tests.
 */
export function getRelativeTime(ts: number | string, now: number = Date.now()): string {
  const time = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const diff = Math.floor((now - time) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return hours < 1 ? `${Math.floor(diff / 60)}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(diff / 86400);
  if (days < 30) return plural(days, 'day');
  if (days < 365) return plural(Math.min(Math.floor(days / 30), 11), 'month');
  return plural(Math.floor(days / 365), 'year');
}
