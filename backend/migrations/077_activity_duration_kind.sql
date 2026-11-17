-- Migration 077: activity duration and kind (Swee Planner v2, behind SWEE_PLANNER_V2).
-- duration_minutes: estimated length of the activity (NULL = unknown, e.g. added by hand).
-- kind: 'travel' for door-to-door travel legs, 'activity' for everything else.
-- Additive only: existing rows become 'activity'. The human note ("about 2 h · 20 min by metro")
-- stays in description so older app versions still show it.

BEGIN;

ALTER TABLE trip_activities ADD COLUMN IF NOT EXISTS duration_minutes INT NULL;
ALTER TABLE trip_activities ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'activity';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_activities_kind_check') THEN
    ALTER TABLE trip_activities
      ADD CONSTRAINT trip_activities_kind_check CHECK (kind IN ('activity', 'travel'));
  END IF;
END
$$;

COMMIT;
