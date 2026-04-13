-- ===========================================================
-- GatherGo — Migration 017: Add banner_crop_fraction to events
-- ===========================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_crop_fraction JSONB DEFAULT NULL;

COMMENT ON COLUMN events.banner_crop_fraction IS 'JSON object containing banner crop fractions: {imgFracX, imgFracY, imgFracW, imgFracH}';
