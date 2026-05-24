-- Migration 038: Per-user gallery archive (hide album from own gallery without archiving trip/event)

BEGIN;

ALTER TABLE user_gallery_item_meta
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gallery_item_meta_user_archived
  ON user_gallery_item_meta (user_id, archived_at)
  WHERE archived_at IS NOT NULL;

COMMIT;
