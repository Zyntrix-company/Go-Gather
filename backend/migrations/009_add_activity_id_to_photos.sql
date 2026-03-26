-- ===========================================================
-- GatherGo — Migration 009: Add activity_id to shared photos table
-- Activity photos now stored in shared photos table with activity_id set.
-- trip_activity_photos renamed to _bak_ (do NOT drop yet).
-- ===========================================================

BEGIN;

-- Add activity_id to shared photos table
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES trip_activities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_photos_activity ON photos(activity_id) WHERE activity_id IS NOT NULL;

-- Migrate existing activity photos into shared photos table
INSERT INTO photos (parent_type, parent_id, uploaded_by, file_url, s3_key, mime_type, activity_id, created_at)
SELECT 'trip', trip_id, uploaded_by, file_url, s3_key, mime_type, activity_id, created_at
FROM trip_activity_photos;

-- Rename old table (do NOT drop — wait until verified in production)
ALTER TABLE trip_activity_photos RENAME TO _bak_trip_activity_photos;

COMMIT;
