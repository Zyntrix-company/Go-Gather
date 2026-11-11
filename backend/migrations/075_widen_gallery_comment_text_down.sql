-- Rollback 075: narrow gallery comment text back to 30 chars.
-- Narrowing fails while any comment is longer than 30, so those are truncated first.

BEGIN;

UPDATE gallery_item_comments SET text = left(text, 30) WHERE char_length(text) > 30;

ALTER TABLE gallery_item_comments
  DROP CONSTRAINT IF EXISTS gallery_item_comments_text_check;

ALTER TABLE gallery_item_comments
  ALTER COLUMN text TYPE VARCHAR(30);

ALTER TABLE gallery_item_comments
  ADD CONSTRAINT gallery_item_comments_text_check
  CHECK (char_length(text) BETWEEN 1 AND 30);

COMMIT;
