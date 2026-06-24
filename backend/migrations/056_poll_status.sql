-- Add status column to polls table for active/completed state persistence
ALTER TABLE polls
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed'));
