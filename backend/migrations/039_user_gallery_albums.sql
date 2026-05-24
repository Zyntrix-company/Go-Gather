-- Migration 039: Server-backed custom gallery albums (per-user, sync across devices)

BEGIN;

CREATE TABLE user_gallery_albums (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section          VARCHAR(10) NOT NULL CHECK (section IN ('trip', 'event')),
  name             TEXT        NOT NULL,
  banner_image_url TEXT,
  subtitle         TEXT,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_gallery_albums_user_section
  ON user_gallery_albums (user_id, section)
  WHERE archived_at IS NULL;

CREATE INDEX idx_user_gallery_albums_user_archived
  ON user_gallery_albums (user_id, archived_at)
  WHERE archived_at IS NOT NULL;

-- Allow photos to attach to custom gallery albums (reuses shared photos.service + S3 paths)
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_parent_type_check;
ALTER TABLE photos ADD CONSTRAINT photos_parent_type_check
  CHECK (parent_type IN ('trip', 'event', 'gallery_album'));

COMMIT;
