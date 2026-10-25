-- Migration 073: New users start with quiet hours OFF.
-- Only the column default changes. Existing users keep whatever they have — we can't tell
-- who turned quiet hours on deliberately from who just got the old default.

ALTER TABLE users ALTER COLUMN notification_settings SET DEFAULT '{
  "email_digest": "daily",
  "lock_screen_reminders": true,
  "quiet_hours_enabled": false,
  "quiet_start": "22:00",
  "quiet_end": "08:00"
}';
