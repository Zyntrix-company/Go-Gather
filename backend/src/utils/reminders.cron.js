const cron = require('node-cron');
const { query: db } = require('../config/database');
const { notifyUsers } = require('./fcm.util');
const logger = require('./logger');

const TRIP_NOTIF_MAP = {
  trip_start:    { title: '🚀 Trip starts today!',  body: (name) => `Your trip "${name}" starts today. Have a great trip!` },
  '1_day_before':{ title: '✈️ Trip tomorrow!',      body: (name) => `"${name}" starts tomorrow. Time to pack!` },
  '1_week_before':{ title: '📅 1 week to go!',      body: (name) => `"${name}" is just 1 week away. Get ready!` },
};

const EVENT_NOTIF_MAP = {
  event_start:    { title: '🎉 Event starts today!', body: (name) => `Your event "${name}" starts today. Enjoy!` },
  '1_day_before': { title: '📆 Event tomorrow!',     body: (name) => `"${name}" is tomorrow. Don't forget!` },
  '1_week_before':{ title: '📅 1 week to go!',       body: (name) => `Your event "${name}" is in 1 week. Get ready!` },
};

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
        `SELECT u.fcm_token FROM trip_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.trip_id = $1 AND u.fcm_token IS NOT NULL`,
        [reminder.trip_id],
      );

      const map = TRIP_NOTIF_MAP[reminder.reminder_type] || {
        title: 'Trip Reminder',
        body: (name) => `Reminder for your trip "${name}"`,
      };

      await notifyUsers(membersResult.rows, {
        title: map.title,
        body: map.body(reminder.trip_name),
      }, { type: 'TRIP_REMINDER', reminderType: reminder.reminder_type, tripId: reminder.trip_id });

      await db('UPDATE trip_reminders SET sent_at = NOW() WHERE id = $1', [reminder.id]);
      logger.info('Trip reminder sent', { reminderId: reminder.id, type: reminder.reminder_type, tokens: membersResult.rowCount });
    } catch (err) {
      logger.error('Failed to process trip reminder', { reminderId: reminder.id, error: err.message });
    }
  }

  return pendingResult.rowCount;
};

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
        `SELECT u.fcm_token FROM event_members em
         JOIN users u ON u.id = em.user_id
         WHERE em.event_id = $1 AND u.fcm_token IS NOT NULL`,
        [reminder.event_id],
      );

      const map = EVENT_NOTIF_MAP[reminder.reminder_type] || {
        title: 'Event Reminder',
        body: (name) => `Reminder for your event "${name}"`,
      };

      await notifyUsers(membersResult.rows, {
        title: map.title,
        body: map.body(reminder.event_name),
      }, { type: 'EVENT_REMINDER', reminderType: reminder.reminder_type, eventId: reminder.event_id });

      await db('UPDATE event_reminders SET sent_at = NOW() WHERE id = $1', [reminder.id]);
      logger.info('Event reminder sent', { reminderId: reminder.id, type: reminder.reminder_type, tokens: membersResult.rowCount });
    } catch (err) {
      logger.error('Failed to process event reminder', { reminderId: reminder.id, error: err.message });
    }
  }

  return pendingResult.rowCount;
};

const processReminders = async () => {
  logger.info('Running reminders cron job');
  try {
    const [trips, events] = await Promise.all([
      processTripReminders(),
      processEventReminders(),
    ]);
    if (trips === 0 && events === 0) {
      logger.info('No pending reminders');
    }
  } catch (err) {
    logger.error('Reminders cron job failed', { error: err.message });
  }
};

const startRemindersCron = () => {
  cron.schedule('0 * * * *', processReminders, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  logger.info('Reminders cron started (hourly, IST)');
};

module.exports = { startRemindersCron, processReminders };
