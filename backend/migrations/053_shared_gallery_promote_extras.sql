-- Migration 053: Promote per-user gallery extras to shared photos; clear overlay state.

BEGIN;

-- Promote gallery-only extras into the shared photos table.
INSERT INTO photos (
  parent_type,
  parent_id,
  uploaded_by,
  file_url,
  s3_key,
  mime_type,
  activity_id,
  display_order,
  created_at
)
SELECT
  e.parent_type,
  e.parent_id,
  e.user_id,
  e.file_url,
  e.s3_key,
  e.mime_type,
  NULL,
  COALESCE(
    (SELECT COALESCE(MAX(ph.display_order), -1) + 1
     FROM photos ph
     WHERE ph.parent_type = e.parent_type AND ph.parent_id = e.parent_id),
    0
  ),
  e.created_at
FROM user_gallery_extra_photos e
WHERE NOT EXISTS (
  SELECT 1 FROM photos ph
  WHERE ph.s3_key = e.s3_key
);

-- Clear per-user gallery archive flags for trip/event albums.
UPDATE user_gallery_item_meta
SET archived_at = NULL, updated_at = NOW()
WHERE parent_type IN ('trip', 'event')
  AND archived_at IS NOT NULL;

-- Overlay tables retained for rollback safety; application no longer reads them.
TRUNCATE user_gallery_hidden_photos;
TRUNCATE user_gallery_extra_photos;

COMMIT;
