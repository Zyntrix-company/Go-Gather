const cron = require('node-cron');
const { query: db } = require('../config/database');
const { sendEmail, wrapEmail } = require('./mailer');
const logger = require('./logger');

const SKIP_TYPES = new Set(['WELCOME', 'TRIP_REMINDER', 'EVENT_REMINDER', 'ACTIVITY_REMINDER']);

const processDigests = async () => {
  const usersResult = await db(
    `SELECT u.id, u.email, p.full_name, u.notification_settings, u.last_digest_sent_at
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.notification_settings->>'email_digest' != 'never'
       AND u.email IS NOT NULL`,
    [],
  );

  let sent = 0;
  for (const user of usersResult.rows) {
    try {
      const digest = user.notification_settings?.email_digest || 'daily';
      const lastSent = user.last_digest_sent_at ? new Date(user.last_digest_sent_at) : null;
      const now = Date.now();

      // Cadence gate
      if (digest === 'daily' && lastSent && now - lastSent.getTime() < 23 * 3600 * 1000) continue;
      if (digest === 'weekly' && lastSent && now - lastSent.getTime() < (6 * 24 + 23) * 3600 * 1000) continue;

      // Fetch unread notifications since last digest
      const notifResult = await db(
        `SELECT type, title, body, data, created_at
         FROM notifications
         WHERE user_id = $1
           AND read = false
           AND created_at > COALESCE($2, NOW() - interval '7 days')
           AND type != ALL($3::text[])
         ORDER BY created_at DESC
         LIMIT 50`,
        [user.id, lastSent || null, [...SKIP_TYPES]],
      );

      if (notifResult.rows.length === 0) continue;

      // Group by trip/event parent
      const groupMap = new Map();
      for (const n of notifResult.rows) {
        const parentId = n.data?.tripId || n.data?.eventId || 'general';
        const parentName = n.data?.tripName || n.data?.parentName || n.data?.eventName || 'General';
        if (!groupMap.has(parentId)) groupMap.set(parentId, { name: parentName, items: [] });
        groupMap.get(parentId).items.push(n);
      }

      // Build email sections
      const sectionsHtml = [...groupMap.values()].map((group) => `
        <div style="margin-bottom:24px;">
          <h3 style="margin:0 0 8px 0; font-size:16px; font-weight:700; color:#0D9488;
                     border-bottom:1px solid #E5E7EB; padding-bottom:8px;">
            ${group.name}
          </h3>
          <ul style="margin:0; padding-left:20px; color:#374151; font-size:14px; line-height:1.8;">
            ${group.items.map((n) => `<li>${n.body}</li>`).join('')}
          </ul>
        </div>
      `).join('');

      const date = new Date().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      const firstName = user.full_name ? user.full_name.split(' ')[0] : 'there';

      const html = wrapEmail(`
        <h2 style="margin:0 0 6px 0; font-size:20px; font-weight:700; color:#111827;">
          Your GatherrGo update
        </h2>
        <p style="margin:0 0 24px 0; font-size:13px; color:#6B7280;">${date}</p>
        <p style="margin:0 0 20px 0; font-size:15px; color:#374151; line-height:1.65;">
          Hi ${firstName}, here&rsquo;s what happened while you were away:
        </p>
        ${sectionsHtml}
        <p style="margin:24px 0 0 0; font-size:14px; color:#6B7280;">
          Open GatherrGo to view all updates and respond to your group.
        </p>
      `);

      await sendEmail({
        to: user.email,
        subject: `Your GatherrGo update — ${date}`,
        html,
      });

      await db('UPDATE users SET last_digest_sent_at = NOW() WHERE id = $1', [user.id]);
      sent++;
    } catch (err) {
      logger.error('Failed to send digest email', { userId: user.id, error: err.message });
    }
  }

  if (sent > 0) logger.info('Digest emails sent', { count: sent });
  return sent;
};

const startDigestCron = () => {
  // Daily at 08:00 IST
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running digest cron job');
    try {
      await processDigests();
    } catch (err) {
      logger.error('Digest cron job failed', { error: err.message });
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  logger.info('Digest cron started (daily 08:00 IST)');
};

module.exports = { startDigestCron, processDigests };
