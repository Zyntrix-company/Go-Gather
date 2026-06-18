-- Migration 055: Widen parent_type columns to accommodate 'gallery_album' (12 chars)
-- Migration 039 added 'gallery_album' to the photos check constraint but left the
-- column as VARCHAR(10), causing every gallery album photo upload to fail.

BEGIN;

ALTER TABLE photos ALTER COLUMN parent_type TYPE VARCHAR(20);

COMMIT;
