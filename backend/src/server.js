const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { pool } = require('./config/database');
const { startRemindersCron } = require('./utils/reminders.cron');
const { startBatchingCron } = require('./utils/batching.cron');
const { startDigestCron } = require('./utils/digest.cron');

const PORT = config.port;

const startServer = async () => {
  try {
    // Verify database connectivity
    const client = await pool.connect();
    logger.info('Database connection verified');
    client.release();

    // Start background jobs
    startRemindersCron();
    startBatchingCron();
    startDigestCron();

    const server = app.listen(PORT, () => {
      logger.info(`GatherGo API running on port ${PORT}`, {
        environment: config.nodeEnv,
        port: PORT,
      });
    });

    /* ─── Graceful Shutdown ─── */
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await pool.end();
        logger.info('Database pool closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
