-- ===========================================================
-- GatherGo — Migration 015: Add banner_image_url to events
-- ===========================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_image_url TEXT;
