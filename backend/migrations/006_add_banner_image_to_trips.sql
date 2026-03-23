-- ===========================================================
-- GatherGo — Migration 006: Add banner_image_url to trips
-- ===========================================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS banner_image_url TEXT;
