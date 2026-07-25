-- Content-only admin role (Business/Employee access: Insights view, Blogs, Promo Video, Deals)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_content_admin BOOLEAN NOT NULL DEFAULT false;

-- Anonymization marker for user-initiated / GDPR-style data deletion requests.
-- We anonymize rather than hard-delete so trips/events a user created stay intact
-- for other participants (trips.created_by is ON DELETE CASCADE).
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_content_admin
  ON users (is_content_admin) WHERE is_content_admin = true;
