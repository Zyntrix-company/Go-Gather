-- Dedupe pending reminder rows and enforce one unsent row per (parent, reminder_type).

-- trip_reminders: keep earliest pending row per (trip_id, reminder_type)
DELETE FROM trip_reminders tr
WHERE tr.sent_at IS NULL
  AND tr.id NOT IN (
    SELECT DISTINCT ON (trip_id, reminder_type) id
    FROM trip_reminders
    WHERE sent_at IS NULL
    ORDER BY trip_id, reminder_type, created_at ASC
  );

-- event_reminders: keep earliest pending row per (event_id, reminder_type)
DELETE FROM event_reminders er
WHERE er.sent_at IS NULL
  AND er.id NOT IN (
    SELECT DISTINCT ON (event_id, reminder_type) id
    FROM event_reminders
    WHERE sent_at IS NULL
    ORDER BY event_id, reminder_type, created_at ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_reminders_pending
  ON trip_reminders (trip_id, reminder_type)
  WHERE sent_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_reminders_pending
  ON event_reminders (event_id, reminder_type)
  WHERE sent_at IS NULL;
