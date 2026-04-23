CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(60) NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}',
  read       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Paginated list query: user's notifications newest-first
CREATE INDEX IF NOT EXISTS idx_notif_user_created
  ON notifications (user_id, created_at DESC);

-- Fast unread-count / unread-list queries
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications (user_id) WHERE read = false;
