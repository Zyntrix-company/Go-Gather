/**
 * Daily storage snapshot — persists today's totals into storage_snapshots so
 * /admin/storage/history has data points to chart. Upsert-based, safe to re-run.
 */

const cron = require('node-cron');
const { snapshotStorageToday } = require('../modules/admin/storage.service');
const logger = require('./logger');

const startStorageSnapshotCron = () => {
  // 02:00 IST — off-peak, well clear of the 08:00 digest crons
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running storage snapshot cron job');
    try {
      const agg = await snapshotStorageToday();
      logger.info('Storage snapshot recorded', { totalBytes: agg.totalBytes });
    } catch (err) {
      logger.error('Storage snapshot cron job failed', { error: err.message });
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  logger.info('Storage snapshot cron started (daily 02:00 IST)');
};

module.exports = { startStorageSnapshotCron };
