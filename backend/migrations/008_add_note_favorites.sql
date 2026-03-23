-- ===========================================================
-- GatherGo — Migration 008: Per-user note favorites
-- ===========================================================

CREATE TABLE IF NOT EXISTS note_favorites (
  note_id    UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (note_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_note_favorites_user ON note_favorites(user_id);
