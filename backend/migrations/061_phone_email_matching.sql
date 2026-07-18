-- Invite matching by phone/email was exact string equality, so it silently missed.
--
-- A number from the contact picker ("+91 98765 43210") never equals the same number
-- typed at signup ("9876543210"), so an invited person was treated as a stranger and
-- their pending invite never surfaced in Requests. Match on a normalized key instead:
-- digits only, last 10 (the subscriber number — country code and formatting drop out).
--
-- phone_key is GENERATED, so existing rows are fixed with no backfill.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_key TEXT
  GENERATED ALWAYS AS (NULLIF(RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10), '')) STORED;

ALTER TABLE trip_invites
  ADD COLUMN IF NOT EXISTS phone_key TEXT
  GENERATED ALWAYS AS (NULLIF(RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10), '')) STORED;

ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS phone_key TEXT
  GENERATED ALWAYS AS (NULLIF(RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10), '')) STORED;

ALTER TABLE friend_invites
  ADD COLUMN IF NOT EXISTS phone_key TEXT
  GENERATED ALWAYS AS (NULLIF(RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10), '')) STORED;

-- ─── Indexes for the lookups that now key off phone_key / lowercased email ───

CREATE INDEX IF NOT EXISTS idx_users_phone_key ON users(phone_key) WHERE phone_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_invites_phone_key_status  ON trip_invites(phone_key, status);
CREATE INDEX IF NOT EXISTS idx_event_invites_phone_key_status ON event_invites(phone_key, status);
CREATE INDEX IF NOT EXISTS idx_friend_invites_phone_key       ON friend_invites(phone_key) WHERE claimed_at IS NULL;

-- Invite emails are matched case-insensitively against the invitee's address.
CREATE INDEX IF NOT EXISTS idx_trip_invites_email_lower  ON trip_invites(LOWER(email), status);
CREATE INDEX IF NOT EXISTS idx_event_invites_email_lower ON event_invites(LOWER(email), status);
CREATE INDEX IF NOT EXISTS idx_friend_invites_email_lower ON friend_invites(LOWER(email)) WHERE claimed_at IS NULL;

COMMIT;
