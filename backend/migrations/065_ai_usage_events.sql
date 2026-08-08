-- Migration 065: Persisted Swee chat request log, so the admin AI Usage page
-- can show day/week/month/quarter trends instead of only a 15-min rolling window.
-- Aggregate only (no user_id) — this feeds usage charts, not per-user auditing.

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id          BIGSERIAL PRIMARY KEY,
  success     BOOLEAN NOT NULL,
  error_code  VARCHAR(60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created ON ai_usage_events (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_error_code ON ai_usage_events (error_code) WHERE error_code IS NOT NULL;
