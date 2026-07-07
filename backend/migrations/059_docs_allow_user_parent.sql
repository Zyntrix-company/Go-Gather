-- ===========================================================
-- GatherGo — Migration 059: Allow 'user' as a docs.parent_type
-- Lets users store personal documents (parent_type='user',
-- parent_id = the user's id). docs.parent_id has no FK, so a
-- user id is a valid parent. VARCHAR(10) already fits 'user'.
-- ===========================================================

BEGIN;

ALTER TABLE docs DROP CONSTRAINT IF EXISTS docs_parent_type_check;
ALTER TABLE docs ADD CONSTRAINT docs_parent_type_check
  CHECK (parent_type IN ('trip', 'event', 'user'));

COMMIT;
