-- Single-row promotional video table
-- The CHECK (id = 1) constraint enforces exactly one row
CREATE TABLE IF NOT EXISTS promo_video (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  video_url  TEXT    NOT NULL,
  s3_key     TEXT    NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_promo_video_updated_at
  BEFORE UPDATE ON promo_video
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
