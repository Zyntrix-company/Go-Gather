-- Allow 1_week_before reminder type for events (previously only event_start and 1_day_before)
ALTER TABLE event_reminders
  DROP CONSTRAINT IF EXISTS event_reminders_reminder_type_check;

ALTER TABLE event_reminders
  ADD CONSTRAINT event_reminders_reminder_type_check
  CHECK (reminder_type IN ('event_start', '1_day_before', '1_week_before'));
