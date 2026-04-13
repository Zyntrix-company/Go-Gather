-- ===========================================================
-- GatherGo — Migration 016 Down: Remove banner_crop_fraction from trips
-- ===========================================================

ALTER TABLE trips DROP COLUMN IF EXISTS banner_crop_fraction;
