BEGIN;

CREATE TABLE email_oauth_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      VARCHAR(20) NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  access_token  TEXT NOT NULL,         -- AES-256-GCM encrypted, stored as base64
  refresh_token TEXT NOT NULL,         -- AES-256-GCM encrypted, stored as base64
  token_expiry  TIMESTAMPTZ NOT NULL,
  email         VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_email_oauth_user ON email_oauth_tokens(user_id);

COMMIT;
