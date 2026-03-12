const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { sesClient } = require('../config/aws');
const config = require('../config');
const logger = require('./logger');

/**
 * Send an email via AWS SES.
 * @param {object} options
 * @param {string} options.to        Recipient email address
 * @param {string} options.subject   Email subject
 * @param {string} options.html      HTML body
 * @param {string} [options.text]    Plain-text body (optional fallback)
 * @returns {Promise<object>}        SES send result
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const params = {
    Source: config.ses.fromEmail,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
        ...(text && { Text: { Data: text, Charset: 'UTF-8' } }),
      },
    },
  };

  try {
    const result = await sesClient.send(new SendEmailCommand(params));
    logger.info('Email sent successfully', { to, messageId: result.MessageId });
    return result;
  } catch (error) {
    logger.error('Failed to send email via SES', { to, error: error.message });
    throw error;
  }
};

/**
 * Send an email with a 6-digit OTP.
 */
const sendOTPEmail = async (email, otp, title, body) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2D3748;">GatherGo</h1>
      </div>
      <h2 style="color: #2D3748;">${title}</h2>
      <p style="color: #4A5568; font-size: 16px;">${body}</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="background-color: #F7FAFC; border: 2px dashed #E2E8F0; padding: 20px;
                    border-radius: 12px; display: inline-block;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 12px; color: #4F46E5;">
            ${otp}
          </span>
        </div>
      </div>
      <p style="color: #718096; font-size: 14px;">This code expires in <strong>15 minutes</strong>.</p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 30px 0;">
      <p style="color: #A0AEC0; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} GatherGo. All rights reserved.</p>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `GatherGo — ${title}`,
    html,
    text: `${body}: ${otp}. Expires in 15 minutes.`,
  });
};

const sendVerificationOTPEmail = async (email, otp) => {
  return sendOTPEmail(email, otp, 'Email Verification', 'To complete your registration, please use the following verification code.');
};

const sendPasswordResetOTPEmail = async (email, otp) => {
  return sendOTPEmail(email, otp, 'Password Reset', 'You requested a password reset. Use the code below to verify your request.');
};

module.exports = {
  sendEmail,
  sendVerificationOTPEmail,
  sendPasswordResetOTPEmail,
};
