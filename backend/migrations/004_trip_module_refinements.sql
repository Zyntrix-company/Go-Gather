-- ===========================================================
-- GatherGo — Migration 004: Trip Module Refinements (Prompt A)
-- Database: PostgreSQL (AWS RDS)
-- Run inside a transaction — rename first, then create new tables
-- ===========================================================

BEGIN;

-- ─── CHANGE 4: Activities — add description & expense link ───
ALTER TABLE trip_activities
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES trip_expenses(id) ON DELETE SET NULL;

-- ─── CHANGE 4: Activity photos table ─────────────────────────
CREATE TABLE IF NOT EXISTS trip_activity_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  UUID NOT NULL REFERENCES trip_activities(id) ON DELETE CASCADE,
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by  UUID NOT NULL REFERENCES users(id),
  file_url     TEXT NOT NULL,
  s3_key       TEXT NOT NULL,
  mime_type    VARCHAR(100),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_photos_activity ON trip_activity_photos(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_photos_trip ON trip_activity_photos(trip_id);

-- ─── CHANGE 7: Expense category constraint ───────────────────
-- Drop existing constraint (if any) and add the canonical one
ALTER TABLE trip_expenses
  DROP CONSTRAINT IF EXISTS trip_expenses_category_check,
  ADD CONSTRAINT trip_expenses_category_check
    CHECK (category IN (
      'general', 'transportation', 'accommodation',
      'entertainment', 'shopping', 'food', 'other'
    ));

-- ─── CHANGE 8: Notes redesign — rename old, create new ───────
ALTER TABLE trip_notes RENAME TO trip_notes_deprecated;

CREATE TABLE IF NOT EXISTS trip_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by     UUID NOT NULL REFERENCES users(id),
  title          VARCHAR(255) NOT NULL,
  content        TEXT NOT NULL DEFAULT '',
  category       VARCHAR(30) NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'idea', 'important', 'todo')),
  last_edited_by UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_notes_trip_id ON trip_notes(trip_id);

CREATE TRIGGER update_trip_notes_updated_at
  BEFORE UPDATE ON trip_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── CHANGE 1: Trip invites — add phone & branch_url ─────────
ALTER TABLE trip_invites
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS branch_url TEXT;

COMMIT;
