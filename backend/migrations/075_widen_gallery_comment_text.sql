-- Migration 075: Widen gallery comment text from 30 to 500 chars.
-- The real comment limit now lives in config (LIMIT_GALLERY_COMMENT_MAX, GET /config/app-limits);
-- the DB column is only a generous safety ceiling so limit changes never need a migration.

BEGIN;

ALTER TABLE gallery_item_comments
  DROP CONSTRAINT IF EXISTS gallery_item_comments_text_check;

ALTER TABLE gallery_item_comments
  ALTER COLUMN text TYPE VARCHAR(500);

ALTER TABLE gallery_item_comments
  ADD CONSTRAINT gallery_item_comments_text_check
  CHECK (char_length(text) BETWEEN 1 AND 500);

COMMIT;
