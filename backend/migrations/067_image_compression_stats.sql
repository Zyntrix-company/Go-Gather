-- Migration 067: single running counter for how much storage server-side
-- image compression has actually saved, so the admin storage tab can show
-- a real measured number instead of a guessed one.

CREATE TABLE IF NOT EXISTS image_compression_stats (
  id                 SMALLINT PRIMARY KEY DEFAULT 1,
  images_compressed  BIGINT NOT NULL DEFAULT 0,
  original_bytes     BIGINT NOT NULL DEFAULT 0,
  final_bytes        BIGINT NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT image_compression_stats_singleton CHECK (id = 1)
);

INSERT INTO image_compression_stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
