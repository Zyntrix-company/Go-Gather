-- Rollback 073: new users start with quiet hours ON again (the 024 default).

ALTER TABLE users ALTER COLUMN notification_settings SET DEFAULT '{
  "email_digest": "daily",
  "lock_screen_reminders": true,
  "quiet_hours_enabled": true,
  "quiet_start": "22:00",
  "quiet_end": "08:00"
}';
