-- ===========================================================
-- GatherGo — Migration 016: Add banner_crop_fraction to trips
-- ===========================================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS banner_crop_fraction JSONB DEFAULT NULL;

COMMENT ON COLUMN trips.banner_crop_fraction IS 'JSON object containing banner crop fractions: {imgFracX, imgFracY, imgFracW, imgFracH}';
