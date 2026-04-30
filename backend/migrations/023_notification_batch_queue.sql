-- Batched push queue: one open row per (user, type, parent) window
-- DB notification rows are still written immediately; only FCM push is deferred here
CREATE TABLE IF NOT EXISTS notification_batch_queue (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             VARCHAR(60) NOT NULL,
  parent_id        UUID        NOT NULL,
  parent_name      TEXT        NOT NULL,
  event_count      INTEGER     NOT NULL DEFAULT 1,
  window_closes_at TIMESTAMPTZ NOT NULL,
  flushed_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup for the cron: only unflushed, due rows
CREATE INDEX IF NOT EXISTS idx_batch_flush
  ON notification_batch_queue (window_closes_at)
  WHERE flushed_at IS NULL;

-- One open window per (user, type, parent): increment event_count on conflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_open_window
  ON notification_batch_queue (user_id, type, parent_id)
  WHERE flushed_at IS NULL;
