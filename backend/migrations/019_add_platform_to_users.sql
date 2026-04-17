-- Store the device platform alongside the FCM token.
-- Used for iOS-specific push handling (APNS badge resets, channel routing) when iOS ships.
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform VARCHAR(10);
