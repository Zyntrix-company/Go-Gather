-- Migration 070: Sign in with Apple (iOS).
-- apple_id is Apple's stable per-team user id ("sub"); the refresh token is kept
-- (AES-256-GCM encrypted) only so account deletion can revoke the Apple grant.
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_refresh_token TEXT;
