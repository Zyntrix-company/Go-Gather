-- Daily storage snapshots, so /admin/storage can chart consumption over time.
-- One row per calendar day; the cron upserts on conflict so re-runs are idempotent.
CREATE TABLE IF NOT EXISTS storage_snapshots (
  id             SERIAL PRIMARY KEY,
  snapshot_date  DATE NOT NULL UNIQUE,
  total_bytes    BIGINT NOT NULL DEFAULT 0,
  docs_bytes     BIGINT NOT NULL DEFAULT 0,
  docs_count     INT    NOT NULL DEFAULT 0,
  images_bytes   BIGINT NOT NULL DEFAULT 0,
  images_count   INT    NOT NULL DEFAULT 0,
  user_count     INT    NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_snapshots_date ON storage_snapshots (snapshot_date);
