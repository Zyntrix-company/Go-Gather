DROP INDEX IF EXISTS idx_users_content_admin;
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_content_admin;
