-- Migration 045: Separate display email from canonical duplicate key.
-- email            = what the user typed (lowercase, dots preserved)
-- email_normalized = canonical alias key (Gmail dots/+tags removed, etc.)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_normalized VARCHAR(255);

UPDATE users
SET    email_normalized = LOWER(TRIM(email))
WHERE  email_normalized IS NULL;

-- Full Gmail-style normalization: node scripts/backfill-auth-emails.js

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized
  ON users (email_normalized);
