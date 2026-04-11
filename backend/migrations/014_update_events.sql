-- ===========================================================
-- GatherGo — Migration 014: Update events table
--   1. Replace start_date + end_date with single event_date
--   2. Add description (nullable TEXT)
--   3. Add event_type (nullable VARCHAR)
--   4. Add archived_at for archive feature
-- ===========================================================

-- 1. Add event_date, backfill from start_date, enforce NOT NULL, drop old columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date DATE;
UPDATE events SET event_date = start_date WHERE event_date IS NULL;
ALTER TABLE events ALTER COLUMN event_date SET NOT NULL;
ALTER TABLE events DROP COLUMN IF EXISTS start_date;
ALTER TABLE events DROP COLUMN IF EXISTS end_date;

-- 2. Description field (nullable string)
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Event type field (nullable string)
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);

-- 4. Archive support
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_event_date   ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_archived_at  ON events(archived_at);
