-- Rollback 076: drop the per-trip / per-event time zone columns.
-- Switch TRIP_TIMEZONES off before rolling back — the flag-on code reads these columns.

BEGIN;

ALTER TABLE trips  DROP COLUMN IF EXISTS timezone;
ALTER TABLE events DROP COLUMN IF EXISTS timezone;

COMMIT;
