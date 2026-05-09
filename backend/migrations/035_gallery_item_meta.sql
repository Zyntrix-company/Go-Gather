-- Migration 035: Gallery item meta (per-user optional subtitle for trips/events)
-- Creates user_gallery_item_meta table so each user can attach a subtitle caption
-- to any trip or event that appears in their gallery, without mutating the trip/event itself.

BEGIN;

CREATE TABLE user_gallery_item_meta (
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_type VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id   UUID        NOT NULL,
  subtitle    TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, parent_type, parent_id)
);

CREATE INDEX idx_gallery_item_meta_user ON user_gallery_item_meta(user_id);

COMMIT;
