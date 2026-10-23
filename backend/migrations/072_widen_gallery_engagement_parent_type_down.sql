-- Rollback 072. Narrowing back to VARCHAR(10) fails while any 'gallery_album' row exists,
-- so those likes, comments and queued pushes are removed first.

BEGIN;

DELETE FROM gallery_item_likes WHERE char_length(parent_type) > 10;
DELETE FROM gallery_item_comments WHERE char_length(parent_type) > 10;
DELETE FROM notification_batch_queue WHERE char_length(parent_kind) > 10;

ALTER TABLE gallery_item_likes ALTER COLUMN parent_type TYPE VARCHAR(10);
ALTER TABLE gallery_item_comments ALTER COLUMN parent_type TYPE VARCHAR(10);
ALTER TABLE notification_batch_queue ALTER COLUMN parent_kind TYPE VARCHAR(10);

COMMIT;
