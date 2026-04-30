-- Per-trip notification mutes: FCM push is suppressed but DB row is still written
CREATE TABLE IF NOT EXISTS trip_notification_mutes (
  user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  trip_id  UUID REFERENCES trips(id) ON DELETE CASCADE,
  muted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, trip_id)
);
