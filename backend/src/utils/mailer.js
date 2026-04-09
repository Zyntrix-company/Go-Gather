const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { sesClient } = require('../config/aws');
const config = require('../config');
const logger = require('./logger');

// ─── Shared layout helpers ────────────────────────────────────────────────────

/**
 * Returns an <img> tag when CloudFront is configured, or a text fallback.
 * The alt attribute is the primary fallback for email clients that block images.
 * No onerror JS — not supported in email clients.
 */
const _logoHtml = () => {
  const domain = config.s3.cloudfrontDomain;
  if (domain) {
    return `<img src="https://${domain}/brand/logo.png" alt="GatherGo"
                 width="160" height="auto"
                 style="display:block; margin:0 auto; max-width:160px;" />`;
  }
  // Logo asset not configured — render brand name as text
  return `<span style="font-size:26px; font-weight:700; color:#ffffff;
                        letter-spacing:-0.5px; font-family:'Segoe UI',Arial,sans-serif;">
            GatherGo
          </span>`;
};

/**
 * Wraps inner HTML in a consistent, mobile-responsive email layout.
 * All user-facing transactional emails should use this.
 *
 * @param {string} innerHtml  Content to place in the white body card
 * @returns {string}          Full HTML document string
 */
const wrapEmail = (innerHtml) => {
  const year = new Date().getFullYear();
  // Support email: explicit env > SES from address > hard-coded fallback
  const supportEmail =
    config.ses.supportEmail || config.ses.fromEmail || 'support@gathergo.app';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background-color:#F7FAFC; font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:#F7FAFC; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0"
               style="width:100%; max-width:600px; background-color:#ffffff;
                      border-radius:12px; overflow:hidden;
                      box-shadow:0 4px 24px rgba(13,148,136,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#0D9488; padding:24px 32px; text-align:center;">
              ${_logoHtml()}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              ${innerHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none; border-top:1px solid #E5E7EB; margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; text-align:center;">
              <p style="margin:0 0 4px 0; font-size:12px; color:#9CA3AF;">
                Questions? Reply to this email or reach us at
                <a href="mailto:${supportEmail}"
                   style="color:#6B7280; text-decoration:underline;">${supportEmail}</a>.
              </p>
              <p style="margin:0; font-size:12px; color:#9CA3AF;">
                &copy; ${year} GatherGo. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ─── Core send ────────────────────────────────────────────────────────────────

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

// ─── OTP emails ───────────────────────────────────────────────────────────────

/**
 * Send an email with a 6-digit OTP.
 * OTP copy approach: large monospace block + "Tap and hold to copy" instruction.
 * JavaScript clipboard APIs are not supported in email clients, so we rely on
 * the native text-selection gesture. The letter-spacing is kept moderate (6px)
 * to avoid line-wrapping on narrow screens.
 */
const sendOTPEmail = async (email, otp, title, body) => {
  const html = wrapEmail(`
    <h2 style="margin:0 0 12px 0; font-size:20px; font-weight:700; color:#134E4A;">
      ${title}
    </h2>
    <p style="margin:0 0 24px 0; font-size:15px; color:#374151; line-height:1.6;">
      ${body}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin-bottom:10px;">
      <tr>
        <td align="center">
          <div style="display:inline-block; background-color:#F7FAFC;
                      border:2px dashed #CBD5E0; border-radius:12px;
                      padding:20px 28px;">
            <span style="font-size:28px; font-weight:700; letter-spacing:6px;
                         color:#4F46E5; font-family:'Courier New',Courier,monospace;">
              ${otp}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px 0; font-size:13px; color:#6B7280; text-align:center;">
      Tap and hold the code above to copy it.
    </p>
    <p style="margin:0; font-size:14px; color:#6B7280; text-align:center;">
      This code expires in <strong>15 minutes</strong>.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `GatherGo \u2014 ${title}`,
    html,
    text: `${body}\n\nYour code: ${otp}\n\nThis code expires in 15 minutes.`,
  });
};

const sendVerificationOTPEmail = async (email, otp) => {
  return sendOTPEmail(
    email,
    otp,
    'Email Verification',
    'To complete your registration, please use the following verification code.',
  );
};

const sendPasswordResetOTPEmail = async (email, otp) => {
  return sendOTPEmail(
    email,
    otp,
    'Password Reset',
    'You requested a password reset. Use the code below to verify your request.',
  );
};

// ─── Welcome email ────────────────────────────────────────────────────────────

/**
 * Send a welcome email to a user who just completed their profile.
 * @param {string} email      Recipient email address
 * @param {string} fullName   User's full name
 */
const sendWelcomeEmail = async (email, fullName) => {
  const year = new Date().getFullYear();
  const supportEmail =
    config.ses.supportEmail || config.ses.fromEmail || 'support@gathergo.app';
  const firstName = fullName ? fullName.split(' ')[0] : 'there';

  const html = wrapEmail(`
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#134E4A;">
      Welcome to GatherGo, ${firstName}!
    </h1>
    <p style="margin:0 0 24px 0; font-size:16px; color:#374151; line-height:1.6;">
      We are delighted to have you on board. Your profile is now complete and you are
      all set to start planning and sharing unforgettable trips with the people who
      matter most.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#F0FDF9; border-left:4px solid #0D9488;
                  border-radius:6px; margin-bottom:28px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 12px 0; font-size:15px; font-weight:600; color:#0D9488;">
            Here is what you can do next:
          </p>
          <ul style="margin:0; padding-left:20px; color:#374151; font-size:14px; line-height:2;">
            <li>Create your first trip and invite friends</li>
            <li>Explore upcoming gatherings near you</li>
            <li>Share photos, notes, and plans with your group</li>
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin:0; font-size:15px; color:#374151;">
      Warm regards,<br />
      <strong style="color:#0D9488;">The GatherGo Team</strong>
    </p>
  `);

  const text = [
    `Welcome to GatherGo, ${firstName}!`,
    '',
    'Your profile is now complete. You can start creating trips, inviting friends, and exploring gatherings.',
    '',
    `Questions? Reply to this email or contact us at ${supportEmail}.`,
    '',
    'Warm regards,',
    'The GatherGo Team',
    '',
    `\u00A9 ${year} GatherGo. All rights reserved.`,
  ].join('\n');

  return sendEmail({
    to: email,
    subject: 'Welcome to GatherGo \u2014 You are all set!',
    html,
    text,
  });
};

module.exports = {
  sendEmail,
  sendVerificationOTPEmail,
  sendPasswordResetOTPEmail,
  sendWelcomeEmail,
  wrapEmail,
};
