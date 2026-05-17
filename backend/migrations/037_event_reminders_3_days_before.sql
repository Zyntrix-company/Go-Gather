-- Allow 3_days_before on event_reminders (matches events.service.js + reminders.cron.js)
ALTER TABLE event_reminders
  DROP CONSTRAINT IF EXISTS event_reminders_reminder_type_check;

ALTER TABLE event_reminders
  ADD CONSTRAINT event_reminders_reminder_type_check
  CHECK (reminder_type IN ('event_start', '1_day_before', '3_days_before', '1_week_before'));
