/**
 * Local-time helpers for trips and events (Phase 1, behind TRIP_TIMEZONES).
 *
 * Trips/events store dates and times as the destination's local wall-clock
 * time. These helpers turn that into real instants using the trip's/event's
 * IANA time zone, with correct DST handling (luxon), and resolve that time
 * zone offline from coordinates (tz-lookup — no API calls).
 */
const { DateTime, IANAZone } = require('luxon');
const tzLookup = require('tz-lookup');

// Today's behaviour everywhere: India time.
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

const isValidZone = (zone) => typeof zone === 'string' && zone.length > 0 && IANAZone.isValidZone(zone);

/**
 * "YYYY-MM-DD" from a date-only value. A JS Date comes from node-pg parsing a
 * DATE column as local midnight, so its local calendar fields are the date.
 */
const toIsoDate = (date) => {
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = typeof date === 'string' && date.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

/**
 * Convert a local date + time in `timeZone` to a UTC instant.
 *
 * @param {string|Date} date      "YYYY-MM-DD" (an ISO datetime's date part is used) or a pg DATE
 * @param {string}      time      "HH:MM" or "HH:MM:SS"
 * @param {string}      timeZone  IANA zone, e.g. "Europe/London"
 * @returns {Date|null} null when any input is invalid
 *
 * DST: a time inside a spring-forward gap moves forward by the gap (02:30 → 03:30);
 * an ambiguous fall-back time (01:30 on the night clocks go back) resolves to its
 * standard-time occurrence (luxon's behaviour). Neither affects 09:00 day reminders.
 */
const localToUtc = (date, time, timeZone) => {
  const isoDate = toIsoDate(date);
  const timeMatch = typeof time === 'string' && time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!isoDate || !timeMatch || !isValidZone(timeZone)) return null;
  const dt = DateTime.fromISO(`${isoDate}T${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] || '00'}`, { zone: timeZone });
  return dt.isValid ? dt.toJSDate() : null;
};

/**
 * IANA zone for a trip/event: from its coordinates, else the zone returned by
 * `getFallbackZone` (the creator's users.timezone — only called when needed),
 * else Asia/Kolkata.
 */
const resolveTimeZone = async (lat, lng, getFallbackZone) => {
  const hasCoords = lat !== null && lat !== undefined && lat !== ''
    && lng !== null && lng !== undefined && lng !== '';
  if (hasCoords) {
    const la = Number(lat);
    const lo = Number(lng);
    if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
      try {
        const zone = tzLookup(la, lo);
        if (isValidZone(zone)) return zone;
      } catch { /* fall through to fallback */ }
    }
  }
  const fallback = getFallbackZone ? await getFallbackZone() : null;
  return isValidZone(fallback) ? fallback : DEFAULT_TIME_ZONE;
};

module.exports = { DEFAULT_TIME_ZONE, localToUtc, resolveTimeZone, toIsoDate };
