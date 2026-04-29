const cron = require('node-cron');
const { query: db } = require('../config/database');
const { createAndSendNotifications, sendFCMNotification } = require('./fcm.util');
const logger = require('./logger');

// ── Reminder message maps ─────────────────────────────────────────────────────

const TRIP_NOTIF_MAP = {
  trip_start:      { title: '🚀 Trip starts today!',  body: (name) => `Your trip "${name}" starts today. Have a great trip!` },
  '1_day_before':  { title: '✈️ Trip tomorrow!',      body: (name) => `"${name}" starts tomorrow. Time to pack!` },
  '3_days_before': { title: '📅 3 days to go!',       body: (name) => `"${name}" is just 3 days away. Start packing!` },
  '1_week_before': { title: '📅 1 week to go!',       body: (name) => `"${name}" is just 1 week away. Get ready!` },
};

const EVENT_NOTIF_MAP = {
  event_start:     { title: '🎉 Event starts today!', body: (name) => `Your event "${name}" starts today. Enjoy!` },
  '1_day_before':  { title: '📆 Event tomorrow!',     body: (name) => `"${name}" is tomorrow. Don't forget!` },
  '3_days_before': { title: '📅 3 days to go!',       body: (name) => `Your event "${name}" is in 3 days. Get ready!` },
  '1_week_before': { title: '📅 1 week to go!',       body: (name) => `Your event "${name}" is in 1 week. Get ready!` },
};

// ── Trip reminders ────────────────────────────────────────────────────────────

const processTripReminders = async () => {
  const pendingResult = await db(
    `SELECT tr.id, tr.trip_id, tr.reminder_type, t.name AS trip_name
     FROM trip_reminders tr
     JOIN trips t ON t.id = tr.trip_id
     WHERE tr.scheduled_at <= NOW() AND tr.sent_at IS NULL
     LIMIT 50`,
    [],
  );

  for (const reminder of pendingResult.rows) {
    try {
      const membersResult = await db(
        `SELECT u.id, u.fcm_token FROM trip_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.trip_id = $1`,
        [reminder.trip_id],
      );

      const map = TRIP_NOTIF_MAP[reminder.reminder_type] || {
        title: 'Trip Reminder',
        body: (name) => `Reminder for your trip "${name}"`,
      };

      await createAndSendNotifications(
        membersResult.rows,
        { title: map.title, body: map.body(reminder.trip_name) },
        'TRIP_REMINDER',
        { reminderType: reminder.reminder_type, tripId: reminder.trip_id },
      );

      await db('UPDATE trip_reminders SET sent_at = NOW() WHERE id = $1', [reminder.id]);
      logger.info('Trip reminder sent', { reminderId: reminder.id, type: reminder.reminder_type, tokens: membersResult.rowCount });
    } catch (err) {
      logger.error('Failed to process trip reminder', { reminderId: reminder.id, error: err.message });
    }
  }

  return pendingResult.rowCount;
};

// ── Event reminders ───────────────────────────────────────────────────────────

const processEventReminders = async () => {
  const pendingResult = await db(
    `SELECT er.id, er.event_id, er.reminder_type, e.name AS event_name
     FROM event_reminders er
     JOIN events e ON e.id = er.event_id
     WHERE er.scheduled_at <= NOW() AND er.sent_at IS NULL
     LIMIT 50`,
    [],
  );

  for (const reminder of pendingResult.rows) {
    try {
      const membersResult = await db(
        `SELECT u.id, u.fcm_token FROM event_members em
         JOIN users u ON u.id = em.user_id
         WHERE em.event_id = $1`,
        [reminder.event_id],
      );

      const map = EVENT_NOTIF_MAP[reminder.reminder_type] || {
        title: 'Event Reminder',
        body: (name) => `Reminder for your event "${name}"`,
      };

      await createAndSendNotifications(
        membersResult.rows,
        { title: map.title, body: map.body(reminder.event_name) },
        'EVENT_REMINDER',
        { reminderType: reminder.reminder_type, eventId: reminder.event_id },
      );

      await db('UPDATE event_reminders SET sent_at = NOW() WHERE id = $1', [reminder.id]);
      logger.info('Event reminder sent', { reminderId: reminder.id, type: reminder.reminder_type, tokens: membersResult.rowCount });
    } catch (err) {
      logger.error('Failed to process event reminder', { reminderId: reminder.id, error: err.message });
    }
  }

  return pendingResult.rowCount;
};

// ── Activity reminders ────────────────────────────────────────────────────────

const REMINDER_MINUTES = [10, 30, 60];

/**
 * Create (or replace) activity_reminders rows for all trip members.
 * Called whenever an activity is created or updated.
 * Activity reminders are lock-screen pushes only — NOT stored in notifications table.
 *
 * @param {string} activityId
 * @param {string} tripId
 * @param {string} activityDate   ISO date string: "YYYY-MM-DD"
 * @param {string} activityTime   Time string: "HH:MM:00" (null = skip scheduling)
 */
const scheduleActivityReminders = async (activityId, tripId, activityDate, activityTime) => {
  if (!activityDate || !activityTime) return;

  // Combine date + time as IST (UTC+5:30)
  const startMs = new Date(`${activityDate}T${activityTime}+05:30`).getTime();
  if (isNaN(startMs)) return;

  const now = Date.now();

  // Clear existing unsent reminders for this activity (handles updates)
  await db('DELETE FROM activity_reminders WHERE activity_id = $1 AND sent_at IS NULL', [activityId]);

  // Fetch all trip members
  const membersResult = await db(
    'SELECT u.id FROM trip_members tm JOIN users u ON u.id = tm.user_id WHERE tm.trip_id = $1',
    [tripId],
  );
  if (membersResult.rows.length === 0) return;

  // Build rows to insert: one per (member × reminder interval) where remind_at is in the future
  const toInsert = [];
  for (const member of membersResult.rows) {
    for (const minutes of REMINDER_MINUTES) {
      const remindAt = startMs - minutes * 60 * 1000;
      if (remindAt > now) {
        toInsert.push({ userId: member.id, remindAt: new Date(remindAt).toISOString(), minutes });
      }
    }
  }

  if (toInsert.length === 0) return;

  const valueClauses = toInsert
    .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
    .join(', ');
  const params = toInsert.flatMap((r) => [activityId, r.userId, tripId, r.remindAt, r.minutes]);

  await db(
    `INSERT INTO activity_reminders (activity_id, user_id, trip_id, remind_at, reminder_minutes)
     VALUES ${valueClauses}`,
    params,
  );

  logger.info('Activity reminders scheduled', { activityId, count: toInsert.length });
};

const processActivityReminders = async () => {
  const result = await db(
    `SELECT ar.id, ar.user_id, ar.trip_id, ar.activity_id, ar.reminder_minutes,
            a.title AS activity_name, t.name AS trip_name, u.fcm_token
     FROM activity_reminders ar
     JOIN trip_activities a ON a.id = ar.activity_id
     JOIN trips t ON t.id = ar.trip_id
     JOIN users u ON u.id = ar.user_id
     WHERE ar.remind_at <= NOW() AND ar.sent_at IS NULL
     LIMIT 100`,
    [],
  );

  for (const row of result.rows) {
    try {
      if (row.fcm_token) {
        // Push only — do NOT insert into notifications table
        await sendFCMNotification(
          row.fcm_token,
          {
            title: '⏰ Activity Reminder',
            body: `"${row.activity_name}" starts in ${row.reminder_minutes} min — ${row.trip_name}`,
          },
          { tripId: row.trip_id, activityId: row.activity_id, type: 'ACTIVITY_REMINDER' },
          'default',
        );
      }
      await db('UPDATE activity_reminders SET sent_at = NOW() WHERE id = $1', [row.id]);
    } catch (err) {
      logger.error('Failed to process activity reminder', { id: row.id, error: err.message });
    }
  }

  return result.rowCount;
};

// ── Main cron entry point ─────────────────────────────────────────────────────

const processReminders = async () => {
  logger.info('Running reminders cron job');
  try {
    const [trips, events, activities] = await Promise.all([
      processTripReminders(),
      processEventReminders(),
      processActivityReminders(),
    ]);
    if (trips === 0 && events === 0 && activities === 0) {
      logger.info('No pending reminders');
    }
  } catch (err) {
    logger.error('Reminders cron job failed', { error: err.message });
  }
};

// Every 5 minutes — needed for 10-min activity reminders; trip/event reminders
// re-use the same job (they check scheduled_at, so running more often is safe)
const startRemindersCron = () => {
  cron.schedule('*/5 * * * *', processReminders, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  logger.info('Reminders cron started (every 5 min, IST)');
};

module.exports = { startRemindersCron, processReminders, scheduleActivityReminders };
