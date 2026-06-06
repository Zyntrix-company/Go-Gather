-- Diagnostic queries for duplicate trip/event reminder notifications.
-- Run against production RDS (or local) to confirm root cause before/after fix.

-- 1. Find Ladakh Bike June (or any trip by name)
SELECT id, name, start_date FROM trips WHERE name ILIKE '%Ladakh Bike%';

-- 2. Duplicate reminder rows for a specific trip (replace :trip_id)
-- SELECT trip_id, reminder_type, COUNT(*), array_agg(id ORDER BY created_at) AS row_ids
-- FROM trip_reminders
-- WHERE trip_id = :trip_id
-- GROUP BY trip_id, reminder_type
-- HAVING COUNT(*) > 1;

-- 3. All trips with duplicate pending reminder rows
SELECT trip_id, reminder_type, COUNT(*) AS cnt, array_agg(id ORDER BY created_at) AS row_ids
FROM trip_reminders
WHERE sent_at IS NULL
GROUP BY trip_id, reminder_type
HAVING COUNT(*) > 1;

-- 4. All events with duplicate pending reminder rows
SELECT event_id, reminder_type, COUNT(*) AS cnt, array_agg(id ORDER BY created_at) AS row_ids
FROM event_reminders
WHERE sent_at IS NULL
GROUP BY event_id, reminder_type
HAVING COUNT(*) > 1;

-- 5. Duplicate in-app TRIP_REMINDER notifications per user/trip/type
SELECT
  user_id,
  data->>'tripId' AS trip_id,
  data->>'reminderType' AS reminder_type,
  COUNT(*) AS cnt,
  MIN(created_at) AS first_at,
  MAX(created_at) AS last_at
FROM notifications
WHERE type = 'TRIP_REMINDER'
GROUP BY user_id, data->>'tripId', data->>'reminderType'
HAVING COUNT(*) > 1
ORDER BY cnt DESC
LIMIT 50;

-- 6. Duplicate in-app EVENT_REMINDER notifications per user/event/type
SELECT
  user_id,
  data->>'eventId' AS event_id,
  data->>'reminderType' AS reminder_type,
  COUNT(*) AS cnt,
  MIN(created_at) AS first_at,
  MAX(created_at) AS last_at
FROM notifications
WHERE type = 'EVENT_REMINDER'
GROUP BY user_id, data->>'eventId', data->>'reminderType'
HAVING COUNT(*) > 1
ORDER BY cnt DESC
LIMIT 50;
