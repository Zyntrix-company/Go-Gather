-- ═══════════════════════════════════════════════════════════════════
-- GatherrGo Notification System — DB Verification Queries
-- Replace :userId and :userId2 with real UUIDs before running.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Confirm all 5 notification migrations ran
SELECT name FROM migrations
WHERE name LIKE '%notification%' OR name IN (
  '022_activity_reminders',
  '023_notification_batch_queue',
  '024_user_notification_settings',
  '025_trip_notification_mutes',
  '026_user_digest'
)
ORDER BY name;

-- 2. Confirm new columns exist on users
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('notification_settings', 'timezone', 'last_digest_sent_at');

-- 3. View all notifications for a user, newest first
SELECT type, title, body, read, created_at
FROM notifications
WHERE user_id = :'userId'
ORDER BY created_at DESC;

-- 4. Check each notification type is present (after seeding)
SELECT type, COUNT(*) AS count
FROM notifications
WHERE user_id = :'userId'
GROUP BY type
ORDER BY type;

-- 5. Verify tab routing: Requests tab types
SELECT id, type, title, read
FROM notifications
WHERE user_id = :'userId'
  AND type IN ('FRIEND_REQUEST', 'TRIP_MEMBER_ADDED', 'EVENT_MEMBER_ADDED');

-- 6. Verify tab routing: Notifications tab types
SELECT id, type, title, read
FROM notifications
WHERE user_id = :'userId'
  AND type NOT IN ('FRIEND_REQUEST', 'TRIP_MEMBER_ADDED', 'EVENT_MEMBER_ADDED');

-- 7. Check notification_batch_queue rows
SELECT type, parent_name, event_count, window_closes_at, flushed_at
FROM notification_batch_queue
WHERE user_id = :'userId'
ORDER BY created_at DESC;

-- 8. Force-flush a batch queue row (run THEN wait for cron or hit /dev/flush-batches)
-- UPDATE notification_batch_queue
-- SET window_closes_at = NOW() - interval '1 minute'
-- WHERE user_id = :'userId' AND type = 'EXPENSE_ADDED' AND flushed_at IS NULL;

-- 9. Check activity reminders for a specific activity
-- SELECT reminder_minutes, remind_at, sent_at
-- FROM activity_reminders
-- WHERE activity_id = :'activityId';

-- 10. Force-fire an activity reminder (cron picks it up within 5 min)
-- UPDATE activity_reminders
-- SET remind_at = NOW() - interval '1 minute'
-- WHERE activity_id = :'activityId' AND sent_at IS NULL;

-- 11. Verify actor-exclusion: actor should have 0 rows for actions they took
-- (Replace :actorId and :type)
-- SELECT COUNT(*) FROM notifications
-- WHERE user_id = :'actorId' AND type = :'type';

-- 12. Check notification settings defaults
SELECT id, email,
       notification_settings->>'email_digest'           AS email_digest,
       notification_settings->>'lock_screen_reminders'  AS lock_reminders,
       notification_settings->>'quiet_hours_enabled'    AS quiet_hours,
       notification_settings->>'quiet_start'            AS quiet_start,
       notification_settings->>'quiet_end'              AS quiet_end,
       timezone
FROM users
WHERE id = :'userId';

-- 13. Test quiet hours suppression: force always-quiet for a user
-- UPDATE users
-- SET notification_settings = notification_settings || '{"quiet_start":"00:00","quiet_end":"23:59"}'::jsonb
-- WHERE id = :'userId';

-- 14. Restore normal quiet hours
-- UPDATE users
-- SET notification_settings = notification_settings || '{"quiet_start":"22:00","quiet_end":"08:00"}'::jsonb
-- WHERE id = :'userId';

-- 15. Test lock_screen_reminders toggle
-- UPDATE users
-- SET notification_settings = notification_settings || '{"lock_screen_reminders":false}'::jsonb
-- WHERE id = :'userId';

-- 16. Trip mute check
-- SELECT * FROM trip_notification_mutes WHERE user_id = :'userId';

-- 17. Unread counts per tab (mirrors frontend logic)
SELECT
  COUNT(*) FILTER (WHERE type NOT IN ('FRIEND_REQUEST','TRIP_MEMBER_ADDED','EVENT_MEMBER_ADDED') AND read = false) AS notifications_unread,
  COUNT(*) FILTER (WHERE type IN ('FRIEND_REQUEST','TRIP_MEMBER_ADDED','EVENT_MEMBER_ADDED') AND read = false)     AS requests_unread
FROM notifications
WHERE user_id = :'userId';

-- 18. TRIP_MILESTONE check (after calling POST /trips/:id/confirm)
SELECT user_id, type, title, body, data
FROM notifications
WHERE type = 'TRIP_MILESTONE'
ORDER BY created_at DESC
LIMIT 10;

-- 19. Digest eligibility check
SELECT u.id, u.email,
       u.notification_settings->>'email_digest' AS digest_pref,
       u.last_digest_sent_at,
       COUNT(n.id) AS unread_count
FROM users u
LEFT JOIN notifications n ON n.user_id = u.id AND n.read = false
WHERE u.notification_settings->>'email_digest' != 'never'
GROUP BY u.id, u.email, u.notification_settings, u.last_digest_sent_at
ORDER BY unread_count DESC;
