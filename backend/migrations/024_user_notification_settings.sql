-- Per-user notification preferences and timezone
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{
  "email_digest": "daily",
  "lock_screen_reminders": true,
  "quiet_hours_enabled": true,
  "quiet_start": "22:00",
  "quiet_end": "08:00"
}';

ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'Asia/Kolkata';
