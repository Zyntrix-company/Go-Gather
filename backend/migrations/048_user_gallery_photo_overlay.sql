-- Migration 048: Per-user gallery photo overlay (hide shared + gallery-only extras)

BEGIN;

CREATE TABLE user_gallery_hidden_photos (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id   UUID        NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  hidden_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, photo_id)
);

CREATE INDEX idx_gallery_hidden_photos_user ON user_gallery_hidden_photos(user_id);

CREATE TABLE user_gallery_extra_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_type  VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id    UUID        NOT NULL,
  file_url     TEXT        NOT NULL,
  s3_key       TEXT        NOT NULL,
  mime_type    VARCHAR(100) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gallery_extra_photos_user_parent
  ON user_gallery_extra_photos(user_id, parent_type, parent_id);

COMMIT;
