-- ============================================================
-- Migration 003: Friends & Invite System (M4)
-- ============================================================

-- Add username to users table (unique handle, e.g. @aarav_mehta)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(20) UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Add fcm_token to users table if not already present
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- ── Friend Connections (bidirectional social graph) ────────────────────────────
CREATE TABLE friend_connections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

-- ── Friend Invites (for non-GatherGo users via Branch smart link) ─────────────
CREATE TABLE friend_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      VARCHAR(255),
  phone      VARCHAR(30),
  token      VARCHAR(255) UNIQUE NOT NULL,
  branch_url TEXT,                          -- Branch.io short URL
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES users(id),
  platform   VARCHAR(20),                   -- 'email' | 'sms' | 'whatsapp' | 'copy' | 'share'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Referral Tracking (write-only in v1) ──────────────────────────────────────
CREATE TABLE referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      UUID NOT NULL REFERENCES users(id),
  referred_user_id UUID NOT NULL REFERENCES users(id),
  invite_token     VARCHAR(255),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_friend_connections_requester ON friend_connections(requester_id);
CREATE INDEX idx_friend_connections_addressee ON friend_connections(addressee_id);
CREATE INDEX idx_friend_connections_status    ON friend_connections(status);
CREATE INDEX idx_friend_invites_token         ON friend_invites(token);
CREATE INDEX idx_friend_invites_email         ON friend_invites(email);

-- Prevents duplicate pairs regardless of direction (a→b == b→a)
CREATE UNIQUE INDEX idx_friend_pair ON friend_connections(
  LEAST(requester_id::text, addressee_id::text),
  GREATEST(requester_id::text, addressee_id::text)
);

-- ── Auto-update updated_at for friend_connections ─────────────────────────────
-- Use CREATE OR REPLACE in case the function already exists from migration 001.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER friend_connections_updated_at
  BEFORE UPDATE ON friend_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Friendship Status Helper Function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_friendship_status(user_a UUID, user_b UUID)
RETURNS TABLE(status VARCHAR, connection_id UUID, requester_id UUID) AS $$
  SELECT status, id, requester_id
  FROM friend_connections
  WHERE (requester_id = user_a AND addressee_id = user_b)
     OR (requester_id = user_b AND addressee_id = user_a)
  LIMIT 1;
$$ LANGUAGE sql STABLE;
