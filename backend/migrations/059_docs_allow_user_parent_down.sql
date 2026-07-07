-- Rollback Migration 059: revert docs.parent_type to trip/event only.
-- NOTE: fails if any personal (parent_type='user') docs exist — delete them first.

BEGIN;

ALTER TABLE docs DROP CONSTRAINT IF EXISTS docs_parent_type_check;
ALTER TABLE docs ADD CONSTRAINT docs_parent_type_check
  CHECK (parent_type IN ('trip', 'event'));

COMMIT;
