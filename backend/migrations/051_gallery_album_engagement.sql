-- Migration 051: Extend gallery engagement to custom albums

BEGIN;

ALTER TABLE gallery_item_likes
  DROP CONSTRAINT IF EXISTS gallery_item_likes_parent_type_check;

ALTER TABLE gallery_item_likes
  ADD CONSTRAINT gallery_item_likes_parent_type_check
  CHECK (parent_type IN ('trip', 'event', 'gallery_album'));

ALTER TABLE gallery_item_comments
  DROP CONSTRAINT IF EXISTS gallery_item_comments_parent_type_check;

ALTER TABLE gallery_item_comments
  ADD CONSTRAINT gallery_item_comments_parent_type_check
  CHECK (parent_type IN ('trip', 'event', 'gallery_album'));

COMMIT;
