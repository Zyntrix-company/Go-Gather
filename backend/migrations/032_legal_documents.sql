-- Legal documents: versioned privacy & terms, user acknowledgements, email job queue

CREATE TABLE IF NOT EXISTS legal_document_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type   VARCHAR(16) NOT NULL CHECK (document_type IN ('privacy', 'terms')),
  version         VARCHAR(32) NOT NULL,
  content_html    TEXT NOT NULL,
  effective_at    TIMESTAMPTZ NOT NULL,
  published_at    TIMESTAMPTZ,
  is_current      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_legal_document_type_version UNIQUE (document_type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_one_current_per_type
  ON legal_document_versions (document_type)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_legal_versions_type_published
  ON legal_document_versions (document_type, published_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS legal_notification_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type   VARCHAR(16) NOT NULL,
  version         VARCHAR(32) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  cursor_user_id  UUID,
  emails_sent     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  CONSTRAINT uq_legal_notify_job UNIQUE (document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_notify_pending
  ON legal_notification_jobs (completed_at)
  WHERE completed_at IS NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_policy_ack_version VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_ack_version VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_policy_ack_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_ack_at TIMESTAMPTZ;
