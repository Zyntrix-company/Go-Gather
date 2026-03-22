-- ===========================================================
-- GatherGo — Milestone 2 Schema: Trips & Sub-modules
-- Database: PostgreSQL (AWS RDS)
-- ===========================================================

-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TRIPS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  location_name    VARCHAR(500),
  location_lat     DECIMAL(10, 8),
  location_lng     DECIMAL(11, 8),
  cover_photo_url  TEXT,
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by);

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── TRIP MEMBERS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);

-- ─── TRIP INVITES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES users(id),
  email       VARCHAR(255),
  user_id     UUID REFERENCES users(id),
  token       VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_invites_token ON trip_invites(token);
CREATE INDEX IF NOT EXISTS idx_trip_invites_email ON trip_invites(email);

-- ─── ACTIVITIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  activity_date   DATE NOT NULL,
  activity_time   TIME,
  location_name   VARCHAR(500),
  notes           TEXT,
  is_completed    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_activities_trip_id ON trip_activities(trip_id);

CREATE TRIGGER update_trip_activities_updated_at
  BEFORE UPDATE ON trip_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── TRIP DOCS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_docs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by      UUID NOT NULL REFERENCES users(id),
  file_name        VARCHAR(255) NOT NULL,
  file_url         TEXT NOT NULL,
  s3_key           TEXT NOT NULL,
  file_size_bytes  BIGINT,
  mime_type        VARCHAR(100),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRIP PHOTOS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by  UUID NOT NULL REFERENCES users(id),
  file_url     TEXT NOT NULL,
  s3_key       TEXT NOT NULL,
  caption      TEXT,
  mime_type    VARCHAR(100),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_photos_trip_id ON trip_photos(trip_id);

-- ─── EXPENSES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  description  VARCHAR(255) NOT NULL,
  amount       DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  category     VARCHAR(100),
  paid_by      UUID NOT NULL REFERENCES users(id),
  split_type   VARCHAR(20) NOT NULL CHECK (split_type IN ('equal', 'amount', 'percentage')),
  created_by   UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id ON trip_expenses(trip_id);

CREATE TRIGGER update_trip_expenses_updated_at
  BEFORE UPDATE ON trip_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── EXPENSE SPLITS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_expense_splits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      DECIMAL(12, 2) NOT NULL,
  percentage  DECIMAL(5, 2),
  UNIQUE(expense_id, user_id)
);

-- ─── SETTLEMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_settlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by     UUID NOT NULL REFERENCES users(id),
  paid_to     UUID NOT NULL REFERENCES users(id),
  amount      DECIMAL(12, 2) NOT NULL,
  settled_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── POLLS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id),
  question    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_poll_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id       UUID NOT NULL REFERENCES trip_polls(id) ON DELETE CASCADE,
  option_text   VARCHAR(255) NOT NULL,
  display_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trip_poll_votes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID NOT NULL REFERENCES trip_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES trip_poll_options(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id),
  voted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- ─── NOTES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE UNIQUE,
  content        TEXT DEFAULT '',
  last_edited_by UUID REFERENCES users(id),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REMINDERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  reminder_type   VARCHAR(50) NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
