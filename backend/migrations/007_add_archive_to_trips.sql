-- ===========================================================
-- GatherGo — Migration 007: Add archive support to trips
-- ===========================================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trips_archived_at ON trips(archived_at);
