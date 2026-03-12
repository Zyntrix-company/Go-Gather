const {
  CreatePlatformEndpointCommand,
  PublishCommand,
} = require('@aws-sdk/client-sns');
const { snsClient } = require('../config/aws');
const config = require('../config');
const logger = require('./logger');

/**
 * Register (or re-register) a device push endpoint with AWS SNS.
 *
 * @param {string} deviceToken  FCM / APNS device token from the mobile client
 * @param {'ios'|'android'} platform
 * @returns {Promise<string>}  The SNS EndpointArn
 */
const registerDeviceEndpoint = async (deviceToken, platform) => {
  const platformAppArn =
    platform === 'ios'
      ? config.sns.platformAppArnIos
      : config.sns.platformAppArnAndroid;

  if (!platformAppArn) {
    logger.warn('SNS Platform Application ARN not configured', { platform });
    return null;
  }

  try {
    const command = new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformAppArn,
      Token: deviceToken,
    });

    const result = await snsClient.send(command);
    logger.info('SNS endpoint registered', {
      endpointArn: result.EndpointArn,
      platform,
    });
    return result.EndpointArn;
  } catch (error) {
    logger.error('Failed to register SNS endpoint', {
      platform,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Send a push notification to a specific SNS endpoint.
 *
 * @param {string} endpointArn  The target SNS endpoint ARN
 * @param {object} message
 * @param {string} message.title
 * @param {string} message.body
 * @param {object} [message.data]  Optional data payload
 * @returns {Promise<object>}
 */
const sendPushNotification = async (endpointArn, message) => {
  if (!endpointArn) {
    logger.warn('No endpointArn provided — skipping push notification');
    return null;
  }

  const payload = {
    default: message.body,
    GCM: JSON.stringify({
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data || {},
    }),
    APNS: JSON.stringify({
      aps: {
        alert: {
          title: message.title,
          body: message.body,
        },
        sound: 'default',
      },
      ...( message.data || {}),
    }),
  };

  try {
    const command = new PublishCommand({
      TargetArn: endpointArn,
      Message: JSON.stringify(payload),
      MessageStructure: 'json',
    });

    const result = await snsClient.send(command);
    logger.info('Push notification sent', {
      endpointArn,
      messageId: result.MessageId,
    });
    return result;
  } catch (error) {
    logger.error('Failed to send push notification', {
      endpointArn,
      error: error.message,
    });
    throw error;
  }
};

module.exports = { registerDeviceEndpoint, sendPushNotification };
