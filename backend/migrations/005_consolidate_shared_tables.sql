-- ===========================================================
-- GatherGo — Migration 005: Consolidate Shared Tables
-- Merges trip_docs, trip_photos, trip_expenses, trip_expense_splits,
-- trip_settlements, trip_polls, trip_notes into single shared tables
-- with parent_type ('trip' | 'event') + parent_id pattern.
--
-- Run inside a single transaction. Old tables are renamed _bak_,
-- NOT dropped — wait 2 weeks after deploy before dropping.
-- ===========================================================

BEGIN;

-- ─── STEP 1: Create shared tables ────────────────────────────────────────────

-- SHARED DOCS
CREATE TABLE docs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type     VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id       UUID NOT NULL,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  file_name       VARCHAR(255) NOT NULL,
  file_url        TEXT NOT NULL,
  s3_key          TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type       VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_docs_parent ON docs(parent_type, parent_id);

-- SHARED PHOTOS
CREATE TABLE photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id   UUID NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_url    TEXT NOT NULL,
  s3_key      TEXT NOT NULL,
  caption     TEXT,
  mime_type   VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_photos_parent ON photos(parent_type, parent_id);

-- SHARED EXPENSES
-- legacy_trip_expense_id is a temporary migration column, dropped at end of this migration
CREATE TABLE expenses (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type            VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id              UUID NOT NULL,
  description            VARCHAR(255) NOT NULL,
  amount                 DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  category               VARCHAR(30) NOT NULL DEFAULT 'general'
                           CHECK (category IN (
                             'general', 'transportation', 'accommodation',
                             'entertainment', 'shopping', 'food', 'other'
                           )),
  paid_by                UUID NOT NULL REFERENCES users(id),
  split_type             VARCHAR(20) NOT NULL CHECK (split_type IN ('equal', 'amount', 'percentage')),
  created_by             UUID NOT NULL REFERENCES users(id),
  legacy_trip_expense_id UUID,  -- temp column: removed at end of migration
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_expenses_parent ON expenses(parent_type, parent_id);

-- SHARED EXPENSE SPLITS
CREATE TABLE expense_splits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  amount     DECIMAL(12,2) NOT NULL,
  percentage DECIMAL(5,2),
  UNIQUE(expense_id, user_id)
);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);

-- SHARED SETTLEMENTS
CREATE TABLE settlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id   UUID NOT NULL,
  paid_by     UUID NOT NULL REFERENCES users(id),
  paid_to     UUID NOT NULL REFERENCES users(id),
  amount      DECIMAL(12,2) NOT NULL,
  settled_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_settlements_parent ON settlements(parent_type, parent_id);

-- SHARED POLLS
-- legacy_trip_poll_id is a temporary migration column, dropped at end of this migration
CREATE TABLE polls (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type         VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id           UUID NOT NULL,
  created_by          UUID NOT NULL REFERENCES users(id),
  question            TEXT NOT NULL,
  legacy_trip_poll_id UUID,  -- temp column: removed at end of migration
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_polls_parent ON polls(parent_type, parent_id);

-- SHARED POLL OPTIONS
-- legacy_trip_poll_option_id is a temporary migration column, dropped at end of this migration
CREATE TABLE poll_options (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id                     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text                 VARCHAR(255) NOT NULL,
  display_order               INT DEFAULT 0,
  legacy_trip_poll_option_id  UUID  -- temp column: removed at end of migration
);

-- SHARED POLL VOTES
CREATE TABLE poll_votes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id),
  voted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- SHARED NOTES
CREATE TABLE notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type    VARCHAR(10) NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id      UUID NOT NULL,
  created_by     UUID NOT NULL REFERENCES users(id),
  title          VARCHAR(255) NOT NULL,
  content        TEXT NOT NULL DEFAULT '',
  category       VARCHAR(30) NOT NULL DEFAULT 'general'
                   CHECK (category IN ('general', 'idea', 'important', 'todo')),
  last_edited_by UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notes_parent ON notes(parent_type, parent_id);

-- ─── STEP 2: Migrate existing trip data ──────────────────────────────────────

-- Migrate trip docs
INSERT INTO docs (parent_type, parent_id, uploaded_by, file_name, file_url,
                  s3_key, file_size_bytes, mime_type, created_at)
SELECT 'trip', trip_id, uploaded_by, file_name, file_url,
       s3_key, file_size_bytes, mime_type, created_at
FROM trip_docs;

-- Migrate trip photos
INSERT INTO photos (parent_type, parent_id, uploaded_by, file_url,
                    s3_key, caption, mime_type, created_at)
SELECT 'trip', trip_id, uploaded_by, file_url,
       s3_key, caption, mime_type, created_at
FROM trip_photos;

-- Migrate trip expenses (capture old ID in legacy column for splits/activities mapping)
INSERT INTO expenses (parent_type, parent_id, description, amount, category,
                      paid_by, split_type, created_by, created_at, updated_at,
                      legacy_trip_expense_id)
SELECT 'trip', trip_id, description, amount,
       COALESCE(category, 'general'), paid_by, split_type, created_by,
       created_at, updated_at, id
FROM trip_expenses;

-- Migrate trip expense splits (join on legacy ID to get new expense.id)
INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
SELECT e.id, tes.user_id, tes.amount, tes.percentage
FROM trip_expense_splits tes
JOIN expenses e ON e.legacy_trip_expense_id = tes.expense_id;

-- Migrate trip settlements
INSERT INTO settlements (parent_type, parent_id, paid_by, paid_to, amount, settled_at)
SELECT 'trip', trip_id, paid_by, paid_to, amount, settled_at
FROM trip_settlements;

-- Migrate trip polls (capture old ID in legacy column for options/votes mapping)
INSERT INTO polls (parent_type, parent_id, created_by, question, created_at,
                   legacy_trip_poll_id)
SELECT 'trip', trip_id, created_by, question, created_at, id
FROM trip_polls;

-- Migrate trip poll options (join on legacy poll ID; capture old option ID)
INSERT INTO poll_options (poll_id, option_text, display_order,
                          legacy_trip_poll_option_id)
SELECT p.id, tpo.option_text, tpo.display_order, tpo.id
FROM trip_poll_options tpo
JOIN polls p ON p.legacy_trip_poll_id = tpo.poll_id;

-- Migrate trip poll votes (join on both legacy poll and option IDs)
INSERT INTO poll_votes (poll_id, option_id, user_id, voted_at)
SELECT p.id, po.id, tpv.user_id, tpv.voted_at
FROM trip_poll_votes tpv
JOIN polls p       ON p.legacy_trip_poll_id        = tpv.poll_id
JOIN poll_options po ON po.legacy_trip_poll_option_id = tpv.option_id;

-- Migrate trip notes (trip_notes was redesigned in migration 004 — multi-note schema)
INSERT INTO notes (parent_type, parent_id, created_by, title, content,
                   category, last_edited_by, created_at, updated_at)
SELECT 'trip', trip_id, created_by, title, content,
       category, last_edited_by, created_at, updated_at
FROM trip_notes;

-- ─── STEP 3: Update trip_activities.expense_id FK to point to shared table ──

-- Drop old FK that references trip_expenses
ALTER TABLE trip_activities
  DROP CONSTRAINT IF EXISTS trip_activities_expense_id_fkey;

-- Remap expense_id values to new expenses.id using the legacy mapping column
UPDATE trip_activities ta
SET expense_id = e.id
FROM expenses e
WHERE e.legacy_trip_expense_id = ta.expense_id
  AND ta.expense_id IS NOT NULL;

-- Add new FK pointing to shared expenses table
ALTER TABLE trip_activities
  ADD CONSTRAINT trip_activities_expense_id_fkey
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL;

-- ─── STEP 4: Drop temporary migration columns ─────────────────────────────────

ALTER TABLE expenses    DROP COLUMN legacy_trip_expense_id;
ALTER TABLE polls       DROP COLUMN legacy_trip_poll_id;
ALTER TABLE poll_options DROP COLUMN legacy_trip_poll_option_id;

-- ─── STEP 5: Rename old tables (_bak_ prefix — do NOT drop yet) ───────────────
-- Wait 2 weeks after production deploy, verify all data is correct, then DROP.

ALTER TABLE trip_docs            RENAME TO _bak_trip_docs;
ALTER TABLE trip_photos          RENAME TO _bak_trip_photos;
ALTER TABLE trip_expenses        RENAME TO _bak_trip_expenses;
ALTER TABLE trip_expense_splits  RENAME TO _bak_trip_expense_splits;
ALTER TABLE trip_settlements     RENAME TO _bak_trip_settlements;
ALTER TABLE trip_polls           RENAME TO _bak_trip_polls;
ALTER TABLE trip_poll_options    RENAME TO _bak_trip_poll_options;
ALTER TABLE trip_poll_votes      RENAME TO _bak_trip_poll_votes;
ALTER TABLE trip_notes           RENAME TO _bak_trip_notes;

COMMIT;
