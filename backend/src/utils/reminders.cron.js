const cron = require('node-cron');
const { query: db } = require('../config/database');
const { sendFCMNotification } = require('./fcm.util');
const logger = require('./logger');

/**
 * Processes unsent trip reminders.
 * Runs every hour. Queries trip_reminders where scheduled_at <= NOW() AND sent_at IS NULL.
 * Sends FCM push to all trip members, then marks sent_at = NOW().
 */
const processReminders = async () => {
  logger.info('Running trip reminders cron job');

  try {
    const pendingResult = await db(
      `SELECT
         tr.id,
         tr.trip_id,
         tr.reminder_type,
         t.name AS trip_name,
         t.start_date
       FROM trip_reminders tr
       JOIN trips t ON t.id = tr.trip_id
       WHERE tr.scheduled_at <= NOW() AND tr.sent_at IS NULL
       LIMIT 50`,
      [],
    );

    if (pendingResult.rowCount === 0) {
      logger.info('No pending reminders');
      return;
    }

    for (const reminder of pendingResult.rows) {
      try {
        // Get all trip members with FCM tokens
        const membersResult = await db(
          `SELECT u.fcm_token
           FROM trip_members tm
           JOIN users u ON u.id = tm.user_id
           WHERE tm.trip_id = $1 AND u.fcm_token IS NOT NULL`,
          [reminder.trip_id],
        );

        const tokens = membersResult.rows.map((r) => r.fcm_token).filter(Boolean);

        const notificationMap = {
          trip_start: {
            title: '🚀 Trip starts today!',
            body: `Your trip "${reminder.trip_name}" starts today. Have a great trip!`,
          },
          '1_day_before': {
            title: '✈️ Trip tomorrow!',
            body: `"${reminder.trip_name}" starts tomorrow. Time to pack!`,
          },
          '1_week_before': {
            title: '📅 1 week to go!',
            body: `"${reminder.trip_name}" is just 1 week away. Get ready!`,
          },
        };

        const notif = notificationMap[reminder.reminder_type] || {
          title: 'Trip Reminder',
          body: `Reminder for your trip "${reminder.trip_name}"`,
        };

        if (tokens.length > 0) {
          await sendFCMNotification(tokens, notif, {
            tripId: reminder.trip_id,
            type: 'TRIP_REMINDER',
            reminderType: reminder.reminder_type,
          });
        }

        // Mark as sent
        await db(
          'UPDATE trip_reminders SET sent_at = NOW() WHERE id = $1',
          [reminder.id],
        );

        logger.info('Reminder sent', {
          reminderId: reminder.id,
          tripId: reminder.trip_id,
          type: reminder.reminder_type,
          tokenCount: tokens.length,
        });
      } catch (innerErr) {
        logger.error('Failed to process reminder', {
          reminderId: reminder.id,
          error: innerErr.message,
        });
      }
    }
  } catch (err) {
    logger.error('Reminder cron job failed', { error: err.message });
  }
};

/**
 * Start the reminders cron job.
 * Schedule: every hour at minute 0.
 */
const startRemindersCron = () => {
  // Run every hour
  cron.schedule('0 * * * *', processReminders, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  logger.info('Trip reminders cron job started (runs hourly)');
};

module.exports = { startRemindersCron, processReminders };
