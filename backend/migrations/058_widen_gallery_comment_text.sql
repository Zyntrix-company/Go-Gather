-- Migration 058: Widen gallery comment text from 20 to 30 chars.
-- Migration 050 created gallery_item_comments.text as VARCHAR(20) with a
-- CHECK (char_length BETWEEN 1 AND 20). The app validator and UI both allow 30,
-- so comments of 21–30 chars were silently rejected by the DB constraint.

BEGIN;

ALTER TABLE gallery_item_comments
  DROP CONSTRAINT IF EXISTS gallery_item_comments_text_check;

ALTER TABLE gallery_item_comments
  ALTER COLUMN text TYPE VARCHAR(30);

ALTER TABLE gallery_item_comments
  ADD CONSTRAINT gallery_item_comments_text_check
  CHECK (char_length(text) BETWEEN 1 AND 30);

COMMIT;
