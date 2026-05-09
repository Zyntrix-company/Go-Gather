-- DB-backed amazing deals with hyperlink support
CREATE TABLE IF NOT EXISTS deals (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(120)  NOT NULL,
  subtitle    VARCHAR(200),
  image_url   TEXT          NOT NULL,
  hyperlink   TEXT,
  sort_order  INTEGER,
  active      BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_active
  ON deals (sort_order NULLS LAST, created_at DESC)
  WHERE active = true;

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
