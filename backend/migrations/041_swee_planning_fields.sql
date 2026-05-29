-- Migration 041: Add Swee planning metadata fields
-- Stores planning-only fields collected by Swee (adults, focus, budget tier, currency, etc.)
-- that are not part of the core trip/event schema.
-- event_time enables "Rooftop Dinner at 8 PM" to be stored natively.

-- ─── Events: native time field ────────────────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_time TIME;

-- ─── Trips: planning metadata (Swee-collected fields) ────────────────────────
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS planning_metadata JSONB;

-- ─── Events: planning metadata ────────────────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS planning_metadata JSONB;

-- Index for potential future queries on planning_metadata
CREATE INDEX IF NOT EXISTS idx_trips_planning_metadata  ON trips  USING gin(planning_metadata);
CREATE INDEX IF NOT EXISTS idx_events_planning_metadata ON events USING gin(planning_metadata);
