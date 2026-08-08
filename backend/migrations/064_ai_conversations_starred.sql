-- Migration 064: Star/pin flag for Swee chat conversations.
-- Purely a UI marker — does not affect list ordering (still updated_at DESC).

ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT false;
