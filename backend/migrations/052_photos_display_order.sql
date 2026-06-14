-- Add display_order for user-controlled media ordering within trip/event/activity scope
ALTER TABLE photos ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_photos_parent_order
  ON photos (parent_type, parent_id, activity_id, display_order);

-- Backfill: sequential order per (parent_type, parent_id, activity_id) by created_at
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY parent_type, parent_id, COALESCE(activity_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY created_at ASC, id ASC
         ) - 1 AS new_order
  FROM photos
)
UPDATE photos p
SET display_order = ranked.new_order
FROM ranked
WHERE p.id = ranked.id;
