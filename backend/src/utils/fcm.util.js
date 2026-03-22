const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * Send a push notification via FCM (Firebase Cloud Messaging) legacy API.
 * Fire-and-forget — failures are logged but do NOT propagate.
 *
 * @param {string|string[]} tokens  - FCM device token(s)
 * @param {object} notification
 * @param {string} notification.title
 * @param {string} notification.body
 * @param {object} [data]            - Optional data payload
 */
const sendFCMNotification = async (tokens, notification, data = {}) => {
  const fcmKey = config.fcm && config.fcm.serverKey;
  if (!fcmKey) {
    logger.warn('FCM_SERVER_KEY not configured — skipping push notification');
    return;
  }

  const tokenList = Array.isArray(tokens) ? tokens : [tokens];
  const validTokens = tokenList.filter(Boolean);
  if (validTokens.length === 0) return;

  const payload = {
    notification: {
      title: notification.title,
      body: notification.body,
      sound: 'default',
    },
    data,
    registration_ids: validTokens,
  };

  try {
    const response = await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      payload,
      {
        headers: {
          Authorization: `key=${fcmKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      },
    );
    logger.info('FCM notification sent', {
      tokenCount: validTokens.length,
      successCount: response.data.success,
    });
  } catch (error) {
    // Fire-and-forget: log but do not throw
    logger.error('FCM notification failed', { error: error.message });
  }
};

/**
 * Notify a list of users (by their stored FCM tokens from DB) about an event.
 * @param {Array<{fcm_token: string}>} users
 * @param {{title: string, body: string}} notification
 * @param {object} [data]
 */
const notifyUsers = async (users, notification, data = {}) => {
  const tokens = users.map((u) => u.fcm_token).filter(Boolean);
  if (tokens.length === 0) return;
  return sendFCMNotification(tokens, notification, data);
};

module.exports = { sendFCMNotification, notifyUsers };
