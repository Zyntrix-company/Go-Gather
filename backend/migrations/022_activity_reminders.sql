-- Activity reminders: per-user, per-activity, lock-screen-only (not stored in notifications table)
CREATE TABLE IF NOT EXISTS activity_reminders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id      UUID        NOT NULL,
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id          UUID        NOT NULL,
  remind_at        TIMESTAMPTZ NOT NULL,
  reminder_minutes INTEGER     NOT NULL,  -- 10, 30, or 60 minutes before activity
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup for the cron: only unsent, due rows
CREATE INDEX IF NOT EXISTS idx_act_rem_due
  ON activity_reminders (remind_at)
  WHERE sent_at IS NULL;

-- Fast cleanup on activity delete (no FK because activities have no UUID PK referenced here)
CREATE INDEX IF NOT EXISTS idx_act_rem_activity
  ON activity_reminders (activity_id);
