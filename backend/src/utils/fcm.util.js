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

/**
 * Send a push notification via FCM v1 HTTP API.
 *
 * @param {string} token
 * @param {{title: string, body: string}} notification
 * @param {object} [data]                    Optional data payload (values auto-stringified)
 * @param {'critical'|'default'} [priority]  'critical' = immediate lock-screen interrupt
 */
const sendFCMNotification = async (token, notification, data = {}, priority = 'default') => {
  if (!token) return;

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      logger.warn('GOOGLE_APPLICATION_CREDENTIALS not set — skipping push notification');
      return;
    }

    // FCM v1 requires all data values to be strings
    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );

    const isCritical = priority === 'critical';

    const message = {
      message: {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: stringData,
        android: {
          priority: 'high', // keep high so FCM delivers promptly; visual tier set by channel
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

    await axios.post(FCM_URL, message, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
    logger.info('FCM notification sent', { tokenSuffix: token.slice(-8), priority });
  } catch (error) {
    const detail = error.response?.data ?? error.message;
    logger.error('FCM notification failed', { detail, token: token?.slice(-8) });
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
const createAndSendNotification = async (userId, notification, type, data = {}) => {
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

  // Fetch the user's current FCM token and push (best-effort)
  try {
    const result = await db('SELECT fcm_token FROM users WHERE id = $1', [userId]);
    const token = result.rows[0]?.fcm_token;
    const priority = CRITICAL_TYPES.has(type) ? 'critical' : 'default';
    if (token) await sendFCMNotification(token, notification, { ...data, type }, priority);
  } catch (err) {
    logger.error('Failed to push notification after persist', { userId, type, error: err.message });
  }
};

/**
 * Persist notification rows for multiple users then push via FCM.
 * users must have at least { id } — fcm_token is fetched from DB as a single bulk query.
 *
 * @param {Array<{id: string}>} users
 * @param {{title: string, body: string}} notification
 * @param {string} type
 * @param {object} [data]
 */
const createAndSendNotifications = async (users, notification, type, data = {}) => {
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

  // Push to each user's FCM token (tokens already on the user objects, or fetch them)
  const tokens = users.map((u) => u.fcm_token).filter(Boolean);
  if (tokens.length === 0) return;
  const priority = CRITICAL_TYPES.has(type) ? 'critical' : 'default';
  await Promise.allSettled(
    tokens.map((token) => sendFCMNotification(token, notification, { ...data, type }, priority))
  );
};

module.exports = { sendFCMNotification, notifyUsers, createAndSendNotification, createAndSendNotifications };
