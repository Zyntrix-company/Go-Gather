-- Migration 047: Multi-location support for trips and events
-- Ordered locations stored in junction tables; parent location_* columns remain as denormalized primary.

CREATE TABLE IF NOT EXISTS trip_locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name       VARCHAR(500) NOT NULL,
  lat        DECIMAL(10, 8),
  lng        DECIMAL(11, 8),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       VARCHAR(500) NOT NULL,
  lat        NUMERIC(9, 6),
  lng        NUMERIC(9, 6),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_locations_trip_sort
  ON trip_locations(trip_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_event_locations_event_sort
  ON event_locations(event_id, sort_order);

-- Backfill from existing single-location columns
INSERT INTO trip_locations (trip_id, name, lat, lng, sort_order)
SELECT id, location_name, location_lat, location_lng, 0
FROM trips
WHERE location_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM trip_locations tl WHERE tl.trip_id = trips.id
  );

INSERT INTO event_locations (event_id, name, lat, lng, sort_order)
SELECT id, location_name, location_lat, location_lng, 0
FROM events
WHERE location_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM event_locations el WHERE el.event_id = events.id
  );
