-- ===========================================================
-- GatherGo — Migration 017 Down: Remove banner_crop_fraction from events
-- ===========================================================

ALTER TABLE events DROP COLUMN IF EXISTS banner_crop_fraction;
