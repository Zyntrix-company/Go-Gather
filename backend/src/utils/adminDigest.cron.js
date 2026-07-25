/**
 * Weekly business summary emailed to every platform admin (is_platform_admin = true).
 * Content mirrors the Business Insights dashboard for the trailing 7 days.
 */

const cron = require('node-cron');
const { query: db } = require('../config/database');
const { sendEmail, wrapEmail } = require('./mailer');
const logger = require('./logger');

const buildSummary = async () => {
  const { rows } = await db(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE is_platform_admin = false
        AND created_at >= NOW() - INTERVAL '7 days')                                    AS new_users,
      (SELECT COUNT(*) FROM users WHERE is_platform_admin = false
        AND last_login_at >= NOW() - INTERVAL '7 days')                                 AS active_users,
      (SELECT COUNT(*) FROM trips WHERE created_at >= NOW() - INTERVAL '7 days')        AS new_trips,
      (SELECT COUNT(*) FROM events WHERE created_at >= NOW() - INTERVAL '7 days')       AS new_events,
      (SELECT COUNT(*) FROM contact_submissions WHERE created_at >= NOW() - INTERVAL '7 days') AS new_feedback,
      (SELECT COUNT(*) FROM contact_submissions WHERE read_at IS NULL)                  AS unread_feedback
  `);
  return rows[0];
};

const sendAdminWeeklyDigest = async () => {
  const summary = await buildSummary();

  const { rows: admins } = await db(
    `SELECT id, email FROM users WHERE is_platform_admin = true AND deleted_at IS NULL AND email IS NOT NULL`,
  );
  if (!admins.length) return 0;

  const dateRange = (() => {
    const to = new Date();
    const from = new Date(to.getTime() - 6 * 24 * 3600 * 1000);
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(from)} – ${fmt(to)}, ${to.getFullYear()}`;
  })();

  const row = (label, value) => `
    <tr>
      <td style="padding:8px 0; font-size:14px; color:#374151;">${label}</td>
      <td style="padding:8px 0; font-size:16px; font-weight:700; color:#111827; text-align:right;">${value}</td>
    </tr>`;

  const html = wrapEmail(`
    <h2 style="margin:0 0 6px 0; font-size:20px; font-weight:700; color:#111827;">
      Weekly Insights — GatherrGo
    </h2>
    <p style="margin:0 0 24px 0; font-size:13px; color:#6B7280;">${dateRange}</p>
    <table style="width:100%; border-collapse:collapse;">
      ${row('New users', summary.new_users)}
      ${row('Active users (signed in)', summary.active_users)}
      ${row('Trips created', summary.new_trips)}
      ${row('Events created', summary.new_events)}
      ${row('New feedback submissions', summary.new_feedback)}
      ${row('Unread feedback (all time)', summary.unread_feedback)}
    </table>
    <p style="margin:24px 0 0 0; font-size:14px; color:#6B7280;">
      Open the admin panel for the full breakdown and custom date ranges.
    </p>
  `);

  let sent = 0;
  for (const admin of admins) {
    try {
      await sendEmail({ to: admin.email, subject: `Weekly Insights — ${dateRange}`, html });
      sent++;
    } catch (err) {
      logger.error('Failed to send admin weekly digest', { adminId: admin.id, error: err.message });
    }
  }
  logger.info('Admin weekly digest sent', { count: sent });
  return sent;
};

const startAdminDigestCron = () => {
  // Monday 08:00 IST
  cron.schedule('0 8 * * 1', async () => {
    logger.info('Running admin weekly digest cron job');
    try {
      await sendAdminWeeklyDigest();
    } catch (err) {
      logger.error('Admin weekly digest cron job failed', { error: err.message });
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  logger.info('Admin weekly digest cron started (Monday 08:00 IST)');
};

module.exports = { startAdminDigestCron, sendAdminWeeklyDigest };
