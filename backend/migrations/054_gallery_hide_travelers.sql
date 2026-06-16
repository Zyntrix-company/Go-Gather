-- Migration 054: Per-user toggle to hide travelers row on trip gallery albums.

BEGIN;

ALTER TABLE user_gallery_item_meta
  ADD COLUMN IF NOT EXISTS hide_travelers BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
