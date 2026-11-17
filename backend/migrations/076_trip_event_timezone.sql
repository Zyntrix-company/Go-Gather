-- Migration 076: IANA time zone per trip and per event (e.g. 'Europe/London').
-- Resolved from location_lat/lng on create / primary-location change (behind TRIP_TIMEZONES).
-- NULL = not resolved yet; readers fall back to 'Asia/Kolkata' (today's behaviour).
-- Existing rows are filled by scripts/backfill-timezones.js.

BEGIN;

ALTER TABLE trips  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NULL;

COMMIT;
