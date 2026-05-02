-- Add platform-admin flag and password reset nudge to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_recommended BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_platform_admin
  ON users (is_platform_admin) WHERE is_platform_admin = true;
