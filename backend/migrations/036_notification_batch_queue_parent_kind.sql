-- Add parent_kind to distinguish trip vs event batch queue entries.
-- Existing rows default to 'trip' since all prior batching was trip-only.
ALTER TABLE notification_batch_queue
  ADD COLUMN IF NOT EXISTS parent_kind VARCHAR(10) NOT NULL DEFAULT 'trip';
