const cron = require('node-cron');
const { query: db } = require('../config/database');
const { sendFCMNotification, isInQuietHours } = require('./fcm.util');
const logger = require('./logger');

const BATCH_MESSAGES = {
  ITINERARY_UPDATED: (count, name) => ({
    title: 'Itinerary Updated',
    body: `${count} update(s) to "${name}"`,
  }),
  DOCUMENT_UPLOADED: (count, name) => ({
    title: 'Documents Added',
    body: `${count} document(s) added to "${name}"`,
  }),
  EXPENSE_ADDED: (count, name) => ({
    title: 'Expenses Added',
    body: `${count} expense(s) added to "${name}"`,
  }),
};

const processBatchedPushes = async () => {
  const result = await db(
    `SELECT bq.*, u.fcm_token, u.notification_settings, u.timezone
     FROM notification_batch_queue bq
     JOIN users u ON u.id = bq.user_id
     WHERE bq.window_closes_at <= NOW() AND bq.flushed_at IS NULL
     LIMIT 200`,
    [],
  );

  let flushed = 0;
  for (const row of result.rows) {
    try {
      const builder = BATCH_MESSAGES[row.type];
      if (builder && row.fcm_token) {
        // Suppress if quiet hours
        if (isInQuietHours(row.notification_settings, row.timezone)) {
          logger.info('Batch push suppressed due to quiet hours', { userId: row.user_id, type: row.type });
        } else {
          // Suppress if trip is muted
          let muted = false;
          try {
            const muteCheck = await db(
              'SELECT 1 FROM trip_notification_mutes WHERE user_id = $1 AND trip_id = $2',
              [row.user_id, row.parent_id],
            );
            muted = muteCheck.rowCount > 0;
          } catch (_) { /* non-fatal */ }

          if (!muted) {
            const { title, body } = builder(row.event_count, row.parent_name);
            await sendFCMNotification(
              row.fcm_token,
              { title, body },
              { type: row.type, parentId: row.parent_id },
              'default',
            );
          }
        }
      }
      await db('UPDATE notification_batch_queue SET flushed_at = NOW() WHERE id = $1', [row.id]);
      flushed++;
    } catch (err) {
      logger.error('Failed to flush batch push', { id: row.id, error: err.message });
    }
  }

  if (flushed > 0) logger.info('Batched pushes flushed', { count: flushed });
  return flushed;
};

const startBatchingCron = () => {
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Running batching cron job');
    try {
      await processBatchedPushes();
    } catch (err) {
      logger.error('Batching cron job failed', { error: err.message });
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  logger.info('Batching cron started (every 30 min, IST)');
};

module.exports = { startBatchingCron, processBatchedPushes };
