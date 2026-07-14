-- Invites become approval-based requests.
-- A trip/event invite is no longer an auto-add: it creates a pending row that the
-- invitee sees in their Requests tab and must approve or decline.

BEGIN;

-- ─── TRIP INVITES ────────────────────────────────────────────
ALTER TABLE trip_invites
  ADD COLUMN IF NOT EXISTS status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- Existing accepted invites keep their meaning.
UPDATE trip_invites SET status = 'accepted' WHERE accepted_at IS NOT NULL AND status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_invites_status_check') THEN
    ALTER TABLE trip_invites
      ADD CONSTRAINT trip_invites_status_check
      CHECK (status IN ('pending', 'accepted', 'declined'));
  END IF;
END $$;

-- ─── EVENT INVITES ───────────────────────────────────────────
ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

UPDATE event_invites SET status = 'accepted' WHERE accepted_at IS NOT NULL AND status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_invites_status_check') THEN
    ALTER TABLE event_invites
      ADD CONSTRAINT event_invites_status_check
      CHECK (status IN ('pending', 'accepted', 'declined'));
  END IF;
END $$;

-- ─── INDEXES ─────────────────────────────────────────────────
-- (user_id, status) backs the Requests tab; (email|phone, status) backs signup matching.
CREATE INDEX IF NOT EXISTS idx_trip_invites_user_status  ON trip_invites(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trip_invites_email_status ON trip_invites(email, status);
CREATE INDEX IF NOT EXISTS idx_trip_invites_phone_status ON trip_invites(phone, status);

CREATE INDEX IF NOT EXISTS idx_event_invites_user_status  ON event_invites(user_id, status);
CREATE INDEX IF NOT EXISTS idx_event_invites_email_status ON event_invites(email, status);
CREATE INDEX IF NOT EXISTS idx_event_invites_phone_status ON event_invites(phone, status);

-- Signup matching for friend invites needs the target email/phone (columns already exist).
CREATE INDEX IF NOT EXISTS idx_friend_invites_email ON friend_invites(email) WHERE claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_friend_invites_phone ON friend_invites(phone) WHERE claimed_at IS NULL;

-- A person should only ever have one live pending request per trip/event.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trip_invite_pending_user
  ON trip_invites(trip_id, user_id) WHERE status = 'pending' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_invite_pending_user
  ON event_invites(event_id, user_id) WHERE status = 'pending' AND user_id IS NOT NULL;

COMMIT;
