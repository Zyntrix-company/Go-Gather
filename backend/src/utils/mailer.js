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

/**
 * Send a welcome email to a user who just completed their profile.
 * @param {string} email      Recipient email address
 * @param {string} fullName   User's full name
 */
const sendWelcomeEmail = async (email, fullName) => {
  const year = new Date().getFullYear();
  const logoUrl = `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/brand/logo.png`;
  const firstName = fullName ? fullName.split(' ')[0] : 'there';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Welcome to GatherGo</title>
    </head>
    <body style="margin:0; padding:0; background-color:#F0FDF9; font-family:'Segoe UI', Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0FDF9; padding:40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                   style="max-width:600px; width:100%; background-color:#ffffff;
                          border-radius:12px; overflow:hidden;
                          box-shadow:0 4px 24px rgba(13,148,136,0.10);">

              <!-- Header -->
              <tr>
                <td style="background-color:#0D9488; padding:32px 40px; text-align:center;">
                  <img src="${logoUrl}"
                       alt="GatherGo"
                       width="160"
                       style="display:block; margin:0 auto; max-width:160px;"
                       onerror="this.style.display='none'" />
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px 40px 24px 40px;">
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
                                border-radius:6px; padding:20px 24px; margin-bottom:28px;">
                    <tr>
                      <td>
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

                  <p style="margin:0 0 32px 0; font-size:15px; color:#374151; line-height:1.6;">
                    If you have any questions or need assistance, our support team is always here
                    to help. Simply reply to this email and we will get back to you promptly.
                  </p>

                  <p style="margin:0; font-size:15px; color:#374151;">
                    Warm regards,<br />
                    <strong style="color:#0D9488;">The GatherGo Team</strong>
                  </p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding:0 40px;">
                  <hr style="border:none; border-top:1px solid #E5E7EB; margin:0;" />
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 40px; text-align:center;">
                  <p style="margin:0 0 4px 0; font-size:12px; color:#9CA3AF;">
                    This is an automated message. Please do not reply to this email.
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
    </html>
  `;

  const text = `Welcome to GatherGo, ${firstName}!\n\nYour profile is now complete. You can start creating trips, inviting friends, and exploring gatherings.\n\nIf you need help, contact our support team.\n\nWarm regards,\nThe GatherGo Team\n\nThis is an automated message. Please do not reply directly to this email.\n© ${year} GatherGo. All rights reserved.`;

  return sendEmail({
    to: email,
    subject: 'Welcome to GatherGo — You are all set!',
    html,
    text,
  });
};

module.exports = {
  sendEmail,
  sendVerificationOTPEmail,
  sendPasswordResetOTPEmail,
  sendWelcomeEmail,
};
