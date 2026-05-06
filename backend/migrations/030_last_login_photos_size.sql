-- Track last login time for active-user metrics
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_last_login ON users (last_login_at DESC NULLS LAST);

-- Add file size to photos so storage reports work (populated on new uploads)
ALTER TABLE photos ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
