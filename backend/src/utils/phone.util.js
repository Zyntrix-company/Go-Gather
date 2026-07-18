/**
 * Phone numbers reach us in whatever shape their source produced: the contact picker
 * yields "+91 98765 43210", a signup form yields "9876543210". Comparing those raw
 * strings never matches, so an invite would never find its invitee.
 *
 * The match key is digits-only, last 10 — the subscriber number, with country code
 * and formatting dropped. Must stay in sync with the phone_key generated column
 * (migration 061), which applies the same rule inside Postgres.
 */
const phoneKey = (raw) => {
  if (raw == null || typeof raw !== 'string') return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return digits.slice(-10);
};

module.exports = { phoneKey };
