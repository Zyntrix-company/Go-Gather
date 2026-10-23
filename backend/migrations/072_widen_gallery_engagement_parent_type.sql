-- Migration 072: Widen parent_type / parent_kind columns that receive 'gallery_album' (13 chars).
-- Migration 051 allowed 'gallery_album' in the likes/comments CHECK constraints but left the
-- columns as VARCHAR(10), so every like or comment on a custom album failed with
-- "value too long for type character varying(10)". Same fix as 055 did for photos.
-- The gallery engagement notifications also queue parent_kind = 'gallery_album' into
-- notification_batch_queue (VARCHAR(10) since 036), so those pushes were silently dropped.

BEGIN;

ALTER TABLE gallery_item_likes ALTER COLUMN parent_type TYPE VARCHAR(20);
ALTER TABLE gallery_item_comments ALTER COLUMN parent_type TYPE VARCHAR(20);
ALTER TABLE notification_batch_queue ALTER COLUMN parent_kind TYPE VARCHAR(20);

COMMIT;
