-- Rollback 077: drop activity duration and kind.
-- Switch SWEE_PLANNER_V2 off before rolling back — Planner v2 writes these columns.

BEGIN;

ALTER TABLE trip_activities DROP CONSTRAINT IF EXISTS trip_activities_kind_check;
ALTER TABLE trip_activities DROP COLUMN IF EXISTS kind;
ALTER TABLE trip_activities DROP COLUMN IF EXISTS duration_minutes;

COMMIT;
