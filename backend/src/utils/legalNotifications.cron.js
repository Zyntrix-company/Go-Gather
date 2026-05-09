const cron = require('node-cron');
const { query } = require('../config/database');
const logger = require('./logger');
const { sendLegalUpdateEmail } = require('./mailer');

const CHUNK = 40;

/**
 * Process one batch for the oldest pending legal notification job.
 * @returns {number} number of recipients attempted in this invocation (0 if idle)
 */
const processLegalNotificationJobs = async () => {
  const jobRes = await query(
    'SELECT * FROM legal_notification_jobs WHERE completed_at IS NULL ORDER BY created_at ASC LIMIT 1',
  );
  if (!jobRes.rows.length) return 0;

  const job = jobRes.rows[0];

  await query(
    'UPDATE legal_notification_jobs SET started_at = COALESCE(started_at, NOW()) WHERE id = $1',
    [job.id],
  );

  const meta = await query(
    `SELECT effective_at FROM legal_document_versions
     WHERE document_type = $1 AND version = $2 AND published_at IS NOT NULL
     LIMIT 1`,
    [job.document_type, job.version],
  );
  const effectiveAt = meta.rows[0]?.effective_at || new Date();

  const usersRes = await query(
    `SELECT id, email FROM users
     WHERE is_verified = true AND COALESCE(is_platform_admin, false) = false
       AND email IS NOT NULL AND trim(email) <> ''
       AND ($1::uuid IS NULL OR id > $1)
     ORDER BY id ASC LIMIT $2`,
    [job.cursor_user_id, CHUNK],
  );

  if (usersRes.rows.length === 0) {
    await query(
      'UPDATE legal_notification_jobs SET completed_at = NOW(), last_error = NULL WHERE id = $1',
      [job.id],
    );
    return 0;
  }

  let failures = 0;
  for (const u of usersRes.rows) {
    try {
      await sendLegalUpdateEmail(u.email, {
        documentType: job.document_type,
        version: job.version,
        effectiveAt,
      });
    } catch (err) {
      failures += 1;
      logger.error('Legal notification email failed', { to: u.email, err: err.message });
    }
  }

  const lastId = usersRes.rows[usersRes.rows.length - 1].id;
  const emailsSent = job.emails_sent + usersRes.rows.length;
  const lastErr = failures ? `${failures} send failure(s) in batch` : null;

  if (usersRes.rows.length < CHUNK) {
    await query(
      `UPDATE legal_notification_jobs
         SET completed_at = NOW(), cursor_user_id = $1, emails_sent = $2, last_error = $3
       WHERE id = $4`,
      [lastId, emailsSent, lastErr, job.id],
    );
  } else {
    await query(
      `UPDATE legal_notification_jobs
         SET cursor_user_id = $1, emails_sent = $2, last_error = $3
       WHERE id = $4`,
      [lastId, emailsSent, lastErr, job.id],
    );
  }

  return usersRes.rows.length;
};

const startLegalNotificationCron = () => {
  cron.schedule('* * * * *', async () => {
    try {
      for (let i = 0; i < 15; i += 1) {
        const n = await processLegalNotificationJobs();
        if (n === 0) break;
      }
    } catch (err) {
      logger.error('Legal notification cron failed', { error: err.message });
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  logger.info('Legal notification email cron started (every minute, IST)');
};

module.exports = { startLegalNotificationCron, processLegalNotificationJobs };
