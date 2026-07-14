const path = require('path');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const logger = require('./logger');
const { query: db } = require('../config/database');

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gatherrgo';
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

// Notification types that warrant immediate lock-screen interruption
const CRITICAL_TYPES = new Set([
  'TRIP_CANCELLED',
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'TRIP_MEMBER_ADDED',
  'EVENT_MEMBER_ADDED',
]);

let _auth = null;

const getAuth = () => {
  if (_auth) return _auth;

  // Production: credentials passed as base64-encoded JSON env var (no file needed)
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    try {
      const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      _auth = new GoogleAuth({ credentials, scopes: [FCM_SCOPE] });
      return _auth;
    } catch (e) {
      logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_B64', { error: e.message });
      return null;
    }
  }

  // Local dev fallback: file path via GOOGLE_APPLICATION_CREDENTIALS
  const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!rawPath) return null;
  const keyFile = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(__dirname, '../../', rawPath);
  _auth = new GoogleAuth({ keyFile, scopes: [FCM_SCOPE] });
  return _auth;
};

const getAccessToken = async () => {
  const auth = getAuth();
  if (!auth) return null;
  const client = await auth.getClient();
  const tokenResult = await client.getAccessToken();
  return tokenResult.token;
};

// Returns true if current time in the user's timezone falls inside the quiet window
const isInQuietHours = (notificationSettings, timezone) => {
  if (!notificationSettings?.quiet_hours_enabled) return false;
  const quietStart = notificationSettings.quiet_start || '22:00';
  const quietEnd   = notificationSettings.quiet_end   || '08:00';

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour   = parseInt(parts.find((p) => p.type === 'hour').value, 10) % 24; // % 24 handles '24' for midnight on some Node versions
  const minute = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  const current = hour * 60 + minute;

  const [sh, sm] = quietStart.split(':').map(Number);
  const [eh, em] = quietEnd.split(':').map(Number);
  const start = sh * 60 + sm;
  const end   = eh * 60 + em;

  // Overnight range (e.g. 22:00 – 08:00)
  return start > end ? current >= start || current < end : current >= start && current < end;
};

// Queue a batched FCM push — increments event_count if an open window already exists
const resolveBatchTarget = (data = {}) => {
  if (data.parentKind === 'gallery_album' || data.parentType === 'gallery_album') {
    return {
      parentId: data.parentId,
      parentName: data.albumName || data.parentName || '',
      parentKind: 'gallery_album',
    };
  }
  if (data.tripId) {
    return {
      parentId: data.tripId,
      parentName: data.tripName || data.parentName || '',
      parentKind: 'trip',
    };
  }
  if (data.eventId) {
    return {
      parentId: data.eventId,
      parentName: data.eventName || data.parentName || '',
      parentKind: 'event',
    };
  }
  return {
    parentId: data.parentId,
    parentName: data.parentName || data.albumName || '',
    parentKind: data.parentKind || 'trip',
  };
};

const queueBatchedPush = async (userId, type, parentId, parentName, parentKind = 'trip') => {
  if (!userId || !parentId) return;
  try {
    await db(
      `INSERT INTO notification_batch_queue (user_id, type, parent_id, parent_name, parent_kind, window_closes_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + interval '2 hours')
       ON CONFLICT (user_id, type, parent_id) WHERE flushed_at IS NULL
       DO UPDATE SET event_count = notification_batch_queue.event_count + 1`,
      [userId, type, parentId, parentName || '', parentKind],
    );
  } catch (err) {
    logger.error('Failed to queue batched push', { userId, type, error: err.message });
  }
};

/**
 * Clear the FCM token for a specific device token value across all users.
 * Called when FCM returns UNREGISTERED or INVALID_ARGUMENT for a token.
 */
const clearInvalidToken = async (token) => {
  try {
    await db('UPDATE users SET fcm_token = NULL WHERE fcm_token = $1', [token]);
    logger.info('Cleared invalid FCM token', { tokenSuffix: token.slice(-8) });
  } catch (err) {
    logger.error('Failed to clear invalid FCM token', { error: err.message });
  }
};

/**
 * Register (or transfer) an FCM device token for a user.
 * Removes the token from any other user first to prevent cross-user delivery.
 */
const registerDeviceToken = async (userId, deviceToken, platform) => {
  if (!deviceToken) return;
  try {
    await db(
      'UPDATE users SET fcm_token = NULL, platform = NULL WHERE fcm_token = $1 AND id != $2',
      [deviceToken, userId],
    );
    await db(
      'UPDATE users SET fcm_token = $1, platform = $2, updated_at = NOW() WHERE id = $3',
      [deviceToken, platform || null, userId],
    );
    logger.info('FCM token saved', { userId, platform });
  } catch (err) {
    logger.error('FCM token save failed', { userId, error: err.message });
  }
};

/**
 * Send a push notification via FCM v1 HTTP API.
 * Retries once on transient 5xx errors. Clears the token on UNREGISTERED / INVALID_ARGUMENT.
 *
 * @param {string} token
 * @param {{title: string, body: string}} notification
 * @param {object} [data]                    Optional data payload (values auto-stringified)
 * @param {'critical'|'default'} [priority]  'critical' = immediate lock-screen interrupt
 */
const sendFCMNotification = async (token, notification, data = {}, priority = 'default') => {
  if (!token) return;

  const accessToken = await getAccessToken();
  if (!accessToken) {
    logger.warn('GOOGLE_APPLICATION_CREDENTIALS not set — skipping push notification');
    return;
  }

  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  const isCritical = priority === 'critical';

  const message = {
    message: {
      token,
      notification: { title: notification.title, body: notification.body },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channel_id: isCritical ? 'critical' : 'default',
          notification_priority: isCritical ? 'PRIORITY_HIGH' : 'PRIORITY_DEFAULT',
        },
      },
      // iOS — ready when APNs cert is added in Firebase console
      apns: {
        headers: { 'apns-priority': isCritical ? '10' : '5' },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'interruption-level': isCritical ? 'time-sensitive' : 'active',
          },
        },
      },
    },
  };

  const doSend = () =>
    axios.post(FCM_URL, message, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

  try {
    await doSend();
    logger.info('FCM notification sent', { tokenSuffix: token.slice(-8), priority });
  } catch (error) {
    const status = error.response?.status;
    const fcmStatus = error.response?.data?.error?.status;

    // Clear stale device tokens immediately — no retry needed
    if (fcmStatus === 'UNREGISTERED' || fcmStatus === 'INVALID_ARGUMENT') {
      logger.warn('FCM token invalid/unregistered — clearing', { tokenSuffix: token.slice(-8), fcmStatus });
      await clearInvalidToken(token);
      return;
    }

    // Retry once on transient server errors (5xx)
    if (status >= 500) {
      try {
        await doSend();
        logger.info('FCM notification sent (retry)', { tokenSuffix: token.slice(-8), priority });
        return;
      } catch (retryErr) {
        logger.error('FCM notification failed after retry', {
          detail: retryErr.response?.data ?? retryErr.message,
          tokenSuffix: token?.slice(-8),
        });
        return;
      }
    }

    logger.error('FCM notification failed', {
      detail: error.response?.data ?? error.message,
      tokenSuffix: token?.slice(-8),
    });
  }
};

/**
 * Notify multiple users by their stored FCM tokens.
 * FCM v1 does not support multi-token batching — sends one request per token.
 *
 * @param {Array<{fcm_token: string}>} users
 * @param {{title: string, body: string}} notification
 * @param {object} [data]
 */
const notifyUsers = async (users, notification, data = {}) => {
  const tokens = users.map((u) => u.fcm_token).filter(Boolean);
  if (tokens.length === 0) return;
  await Promise.allSettled(
    tokens.map((token) => sendFCMNotification(token, notification, data))
  );
};

/**
 * Persist a notification row for one user then push via FCM.
 * The row is always written; FCM push is best-effort (fire-and-forget).
 *
 * @param {string} userId
 * @param {{title: string, body: string}} notification
 * @param {string} type                  Notification type key (e.g. 'TRIP_REMINDER')
 * @param {object} [data]                Extra data stored in JSONB and sent in push payload
 */
const createAndSendNotification = async (userId, notification, type, data = {}, options = {}) => {
  if (!userId) return;
  try {
    await db(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, notification.title, notification.body, JSON.stringify(data)],
    );
  } catch (err) {
    logger.error('Failed to persist notification', { userId, type, error: err.message });
  }

  if (options.batched) {
    const { parentId, parentName, parentKind } = resolveBatchTarget(data);
    await queueBatchedPush(userId, type, parentId, parentName, parentKind);
    return;
  }

  // Fetch FCM token + notification settings (best-effort push)
  try {
    const result = await db(
      'SELECT fcm_token, notification_settings, timezone FROM users WHERE id = $1',
      [userId],
    );
    const row = result.rows[0];
    const token = row?.fcm_token;
    if (!token) return;

    const isCritical = CRITICAL_TYPES.has(type);

    // Quiet hours — suppress non-critical pushes
    if (!isCritical && isInQuietHours(row.notification_settings, row.timezone)) {
      logger.info('Suppressed push due to quiet hours', { userId, type });
      return;
    }

    // Trip mute — suppress non-critical pushes for muted trips
    if (!isCritical && data.tripId) {
      const muteCheck = await db(
        'SELECT 1 FROM trip_notification_mutes WHERE user_id = $1 AND trip_id = $2',
        [userId, data.tripId],
      );
      if (muteCheck.rowCount > 0) {
        logger.info('Suppressed push due to trip mute', { userId, type, tripId: data.tripId });
        return;
      }
    }

    const priority = isCritical ? 'critical' : 'default';
    await sendFCMNotification(token, notification, { ...data, type }, priority);
  } catch (err) {
    logger.error('Failed to push notification after persist', { userId, type, error: err.message });
  }
};

/**
 * Persist notification rows for multiple users then push via FCM.
 * users must have at least { id } — fcm_token / notification_settings / timezone
 * are fetched from DB in a single bulk query so quiet-hours is applied per recipient.
 *
 * @param {Array<{id: string}>} users
 * @param {{title: string, body: string}} notification
 * @param {string} type
 * @param {object} [data]
 */
const createAndSendNotifications = async (users, notification, type, data = {}, options = {}) => {
  if (!users || users.length === 0) return;

  // Bulk-insert one notification row per user
  try {
    const values = users
      .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
      .join(', ');
    const params = users.flatMap((u) => [
      u.id,
      type,
      notification.title,
      notification.body,
      JSON.stringify(data),
    ]);
    await db(
      `INSERT INTO notifications (user_id, type, title, body, data) VALUES ${values}`,
      params,
    );
  } catch (err) {
    logger.error('Failed to bulk-persist notifications', { type, error: err.message });
  }

  if (options.batched) {
    const { parentId, parentName, parentKind } = resolveBatchTarget(data);
    await Promise.allSettled(
      users.map((u) => queueBatchedPush(u.id, type, parentId, parentName, parentKind)),
    );
    return;
  }

  const isCritical = CRITICAL_TYPES.has(type);
  const userIds = users.map((u) => u.id);

  // Bulk-fetch token + notification prefs — callers only need to supply { id }
  let recipientMap = {};
  try {
    const settingsResult = await db(
      'SELECT id, fcm_token, notification_settings, timezone FROM users WHERE id = ANY($1::uuid[])',
      [userIds],
    );
    for (const row of settingsResult.rows) recipientMap[row.id] = row;
  } catch (err) {
    logger.error('Failed to fetch recipient settings for bulk push', { type, error: err.message });
    return;
  }

  // Filter muted trip recipients (non-critical only)
  let recipientIds = userIds;
  if (!isCritical && data.tripId) {
    try {
      const muteResult = await db(
        'SELECT user_id FROM trip_notification_mutes WHERE trip_id = $1 AND user_id = ANY($2::uuid[])',
        [data.tripId, userIds],
      );
      const mutedIds = new Set(muteResult.rows.map((r) => r.user_id));
      if (mutedIds.size > 0) recipientIds = userIds.filter((id) => !mutedIds.has(id));
    } catch (err) {
      logger.error('Failed to check trip mutes', { type, error: err.message });
    }
  }

  const priority = isCritical ? 'critical' : 'default';
  await Promise.allSettled(
    recipientIds.map((id) => {
      const row = recipientMap[id];
      if (!row?.fcm_token) return Promise.resolve();
      if (!isCritical && isInQuietHours(row.notification_settings, row.timezone)) {
        logger.info('Bulk push suppressed due to quiet hours', { userId: id, type });
        return Promise.resolve();
      }
      return sendFCMNotification(row.fcm_token, notification, { ...data, type }, priority);
    }),
  );
};

/**
 * Fire-and-forget a notification. Notifications are always a side effect of some
 * other action that has already committed, so neither a rejected promise nor a
 * synchronous throw inside `promiseFactory` may be allowed to escape.
 */
const notifySafely = (promiseFactory, context) => {
  try {
    const result = promiseFactory();
    if (result && typeof result.catch === 'function') {
      result.catch((err) => logger.error('Notification failed', { context, err: err.message }));
    }
  } catch (err) {
    logger.error('Notification threw synchronously', { context, err: err.message });
  }
};

module.exports = { sendFCMNotification, notifyUsers, createAndSendNotification, createAndSendNotifications, isInQuietHours, registerDeviceToken, notifySafely };
