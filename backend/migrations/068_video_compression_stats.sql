-- Migration 068: single running counter for how much storage server-side
-- video compression has actually saved, so the admin storage tab can show
-- a real measured number instead of a guessed one. Mirrors 067_image_compression_stats.

CREATE TABLE IF NOT EXISTS video_compression_stats (
  id                 SMALLINT PRIMARY KEY DEFAULT 1,
  videos_compressed  BIGINT NOT NULL DEFAULT 0,
  original_bytes     BIGINT NOT NULL DEFAULT 0,
  final_bytes        BIGINT NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT video_compression_stats_singleton CHECK (id = 1)
);

INSERT INTO video_compression_stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
