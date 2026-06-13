-- Migration 050: Trip/event-level gallery likes and comments

BEGIN;

CREATE TABLE gallery_item_likes (
  parent_type VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id   UUID        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_type, parent_id, user_id)
);

CREATE INDEX idx_gallery_item_likes_parent ON gallery_item_likes(parent_type, parent_id);

CREATE TABLE gallery_item_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id   UUID        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        VARCHAR(20) NOT NULL CHECK (char_length(text) BETWEEN 1 AND 20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gallery_item_comments_parent ON gallery_item_comments(parent_type, parent_id, created_at DESC);

COMMIT;
