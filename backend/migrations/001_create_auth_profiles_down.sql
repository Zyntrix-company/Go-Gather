-- ===========================================================
-- GatherGo — Rollback: Milestone 1 Auth & Profiles
-- ===========================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
