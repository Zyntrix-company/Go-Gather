-- Migration 044: Backfill canonical auth emails (lowercase trim).
-- Gmail dot/subaddress normalization for existing rows is handled by:
--   node scripts/backfill-auth-emails.js

UPDATE users
SET    email = LOWER(TRIM(email)),
       updated_at = NOW()
WHERE  email <> LOWER(TRIM(email));
