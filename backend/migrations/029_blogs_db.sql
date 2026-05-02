-- DB-backed blogs with per-surface placement and publish control
CREATE TABLE IF NOT EXISTS blogs (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(255) UNIQUE NOT NULL,
  image           TEXT NOT NULL,
  title           TEXT NOT NULL,
  excerpt         TEXT NOT NULL,
  content         TEXT NOT NULL,
  category        VARCHAR(100) NOT NULL,
  author          VARCHAR(100) NOT NULL DEFAULT 'Vihaan Khanna',
  published_at    DATE NOT NULL,
  published       BOOLEAN NOT NULL DEFAULT true,
  show_on_web     BOOLEAN NOT NULL DEFAULT true,
  show_on_app     BOOLEAN NOT NULL DEFAULT true,
  sort_order_web  INTEGER,
  sort_order_app  INTEGER,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs (slug);
CREATE INDEX IF NOT EXISTS idx_blogs_published
  ON blogs (published_at DESC) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_blogs_web
  ON blogs (sort_order_web NULLS LAST, published_at DESC)
  WHERE show_on_web = true AND published = true;
CREATE INDEX IF NOT EXISTS idx_blogs_app
  ON blogs (sort_order_app NULLS LAST, published_at DESC)
  WHERE show_on_app = true AND published = true;

CREATE TRIGGER update_blogs_updated_at
  BEFORE UPDATE ON blogs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
