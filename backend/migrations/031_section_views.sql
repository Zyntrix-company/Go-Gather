-- Migration 031: section_views
-- Tracks when each user last viewed each content section of a trip/event.
-- Enables per-user "new items from others" badge counts with no extra API calls.

CREATE TABLE section_views (
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_type VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id   UUID        NOT NULL,
  section     VARCHAR(20) NOT NULL CHECK (section IN ('docs', 'members', 'photos', 'expenses', 'polls', 'notes')),
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, parent_type, parent_id, section)
);

CREATE INDEX idx_section_views_parent ON section_views(parent_type, parent_id);
