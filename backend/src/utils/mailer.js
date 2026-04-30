const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { sesClient } = require('../config/aws');
const config = require('../config');
const logger = require('./logger');

// ─── Logo URL ─────────────────────────────────────────────────────────────────
//
// The logo (1042×212 teal-on-transparent PNG) is uploaded to S3 at brand/logo.png.
// CloudFront is NOT used here — the distribution's behavior restricts the brand/
// prefix to direct S3 access only (confirmed via HTTP probe).
//
// Priority:
//   1. S3 direct  → https://<bucket>.s3.<region>.amazonaws.com/brand/logo.png
//      (public bucket, always accessible, no CDN cache issues)
//   2. Website     → https://www.gatherrgo.com/logo.png
//      (logo.png copied to frontend/public/ — serves once deployed)
//
// The image is placed on a WHITE header background so the teal logo is visible.
// alt="Gatherrgo" is the semantic fallback for clients that block images.

const _getLogoUrl = () => {
  if (config.s3.bucket && config.aws.region) {
    return `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/brand/logo.png`;
  }
  return `${config.websiteUrl}/logo.png`;
};

// ─── Shared layout ────────────────────────────────────────────────────────────

/**
 * Wraps content in a consistent, mobile-responsive transactional email layout.
 *
 * Design:
 *   - Outer: light-grey full-width background, 16px side padding (safe on 320px screens)
 *   - Card:  white, max-width 600px, rounded corners
 *   - Header: WHITE background + teal bottom border → teal logo is visible
 *   - Body:  24px padding (gives 272px content on a 320px iPhone SE)
 *   - Footer: logo (small) + support email + copyright
 *
 * @param {string} innerHtml
 * @returns {string} Full HTML document
 */
const wrapEmail = (innerHtml) => {
  const year        = new Date().getFullYear();
  const logoUrl     = _getLogoUrl();
  const supportEmail =
    config.ses.supportEmail || config.ses.fromEmail || 'support@gatherrgo.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--[if !mso]><!-->
  <style>
    @media only screen and (max-width:480px) {
      .email-card   { border-radius:0 !important; }
      .email-body   { padding:20px !important; }
      .email-header { padding:20px !important; }
      .email-footer { padding:16px 20px !important; }
      .otp-block    { padding:16px 18px !important; }
      .otp-digits   { font-size:24px !important; letter-spacing:4px !important; }
      .cta-table    { width:100% !important; }
      .cta-td       { border-radius:6px !important; }
      .cta-link     { padding:14px 20px !important; font-size:15px !important; display:block !important; }
      .logo-header  { max-width:150px !important; }
      .logo-footer  { max-width:100px !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#F3F4F6;
             font-family:'Segoe UI',Arial,sans-serif; -webkit-text-size-adjust:100%;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:#F3F4F6; padding:32px 16px;">
    <tr>
      <td align="center" style="padding:0;">

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" class="email-card"
               style="width:100%; max-width:600px; background-color:#ffffff;
                      border-radius:16px; overflow:hidden;
                      box-shadow:0 2px 16px rgba(0,0,0,0.08);">

          <!-- ── Header: white bg so teal logo is visible ── -->
          <tr>
            <td class="email-header"
                style="background-color:#ffffff; padding:28px 32px; text-align:center;
                       border-bottom:3px solid #0D9488;">
              <img src="${logoUrl}"
                   alt="Gatherrgo"
                   width="200"
                   height="auto"
                   class="logo-header"
                   style="display:block; margin:0 auto; max-width:200px;
                          width:200px; border:0;" />
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td class="email-body"
                style="padding:32px 32px 24px 32px;">
              ${innerHtml}
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="padding:0 24px;">
              <hr style="border:none; border-top:1px solid #E5E7EB; margin:0;" />
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td class="email-footer"
                style="padding:20px 32px 24px 32px; text-align:center;
                       background-color:#F9FAFB; border-radius:0 0 16px 16px;">

              <!-- Logo in footer (smaller) -->
              <img src="${logoUrl}"
                   alt="Gatherrgo"
                   width="120"
                   height="auto"
                   class="logo-footer"
                   style="display:block; margin:0 auto 12px auto; max-width:120px;
                          width:120px; border:0;" />

              <p style="margin:0 0 6px 0; font-size:12px; color:#9CA3AF; line-height:1.5;">
                Questions? Reply to this email or reach us at
                <a href="mailto:${supportEmail}"
                   style="color:#6B7280; text-decoration:underline;">${supportEmail}</a>.
              </p>
              <p style="margin:0; font-size:12px; color:#9CA3AF;">
                &copy; ${year} Gatherrgo. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

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
 * @param {string}  options.to      Recipient address
 * @param {string}  options.subject Subject line
 * @param {string}  options.html    HTML body
 * @param {string} [options.text]   Plain-text fallback
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const params = {
    Source: config.ses.fromEmail,
    Destination: { ToAddresses: [to] },
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
 * OTP copy approach: large monospace block + "Tap and hold to copy" instruction.
 * JavaScript Clipboard API is blocked in all email clients, so we rely on the
 * OS long-press / text-selection gesture.
 * Letter-spacing is kept at 6px (not 12px) to prevent line-wrapping on 320px screens.
 */
const sendOTPEmail = async (email, otp, title, body) => {
  const html = wrapEmail(`
    <h2 style="margin:0 0 10px 0; font-size:20px; font-weight:700; color:#111827;">
      ${title}
    </h2>
    <p style="margin:0 0 24px 0; font-size:15px; color:#374151; line-height:1.6;">
      ${body}
    </p>

    <!-- OTP block -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin-bottom:10px;">
      <tr>
        <td align="center">
          <div class="otp-block"
               style="display:inline-block; background-color:#F0FDF9;
                      border:2px dashed #0D9488; border-radius:12px;
                      padding:20px 32px;">
            <span class="otp-digits"
                  style="font-size:32px; font-weight:700; letter-spacing:6px;
                         color:#0D9488; font-family:'Courier New',Courier,monospace;
                         user-select:all; -webkit-user-select:all;">
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
    subject: `Gatherrgo \u2014 ${title}`,
    html,
    text: `${body}\n\nYour code: ${otp}\n\nThis code expires in 15 minutes.`,
  });
};

const sendVerificationOTPEmail = async (email, otp) =>
  sendOTPEmail(
    email, otp,
    'Email Verification',
    'To complete your registration, please use the following verification code.',
  );

const sendPasswordResetOTPEmail = async (email, otp) =>
  sendOTPEmail(
    email, otp,
    'Password Reset',
    'You requested a password reset. Use the code below to verify your request.',
  );

// ─── Welcome email ────────────────────────────────────────────────────────────

const sendWelcomeEmail = async (email, fullName) => {
  const year         = new Date().getFullYear();
  const supportEmail = config.ses.supportEmail || config.ses.fromEmail || 'support@gatherrgo.com';
  const firstName    = fullName ? fullName.split(' ')[0] : 'there';

  const html = wrapEmail(`
    <h1 style="margin:0 0 8px 0; font-size:22px; font-weight:700; color:#111827;">
      Welcome to Gatherrgo, ${firstName}!
    </h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#374151; line-height:1.65;">
      We are delighted to have you on board. Your profile is now complete and you are
      all set to start planning and sharing unforgettable trips with the people who
      matter most.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#F0FDF9; border-left:4px solid #0D9488;
                  border-radius:6px; margin-bottom:28px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 10px 0; font-size:14px; font-weight:700; color:#0D9488;">
            Here is what you can do next:
          </p>
          <ul style="margin:0; padding-left:18px; color:#374151;
                     font-size:14px; line-height:2;">
            <li>Create your first trip and invite friends</li>
            <li>Explore upcoming gatherings near you</li>
            <li>Share photos, notes, and plans with your group</li>
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin:0; font-size:14px; color:#374151;">
      Warm regards,<br />
      <strong style="color:#0D9488;">The Gatherrgo Team</strong>
    </p>
  `);

  const text = [
    `Welcome to Gatherrgo, ${firstName}!`,
    '',
    'Your profile is now complete. You can start creating trips, inviting friends, and exploring gatherings.',
    '',
    `Questions? Reply to this email or contact us at ${supportEmail}.`,
    '',
    'Warm regards,',
    'The Gatherrgo Team',
    '',
    `\u00A9 ${year} Gatherrgo. All rights reserved.`,
  ].join('\n');

  return sendEmail({
    to: email,
    subject: 'Welcome to Gatherrgo \u2014 You are all set!',
    html,
    text,
  });
};

// ─── Trip cancelled email ─────────────────────────────────────────────────────

const sendTripCancelledEmail = async (recipientEmail, recipientName, tripName) => {
  const firstName = recipientName ? recipientName.split(' ')[0] : 'there';
  const html = wrapEmail(`
    <h2 style="margin:0 0 10px 0; font-size:20px; font-weight:700; color:#111827;">
      Trip Cancelled
    </h2>
    <p style="margin:0 0 20px 0; font-size:15px; color:#374151; line-height:1.65;">
      Hi ${firstName}, we&rsquo;re sorry to let you know that
      <strong>&ldquo;${tripName}&rdquo;</strong> has been cancelled by the organiser.
    </p>
    <p style="margin:0 0 28px 0; font-size:15px; color:#374151; line-height:1.65;">
      Open the app to browse other upcoming trips or start planning a new one.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" class="cta-table"
           style="margin:0 auto 28px auto; width:100%; max-width:240px;">
      <tr>
        <td class="cta-td" style="border-radius:8px; background-color:#0D9488;">
          <a href="${config.websiteUrl || 'https://gatherrgo.com'}" class="cta-link"
             style="display:block; padding:14px 32px; color:#ffffff;
                    text-decoration:none; font-size:16px; font-weight:700;
                    border-radius:8px; text-align:center;
                    font-family:'Segoe UI',Arial,sans-serif;">
            Open GatherrGo
          </a>
        </td>
      </tr>
    </table>
  `);
  return sendEmail({ to: recipientEmail, subject: `"${tripName}" has been cancelled`, html });
};

// ─── Friend request email ─────────────────────────────────────────────────────

const sendConnectionRequestEmail = async (recipientEmail, recipientName, requesterName) => {
  const firstName = recipientName ? recipientName.split(' ')[0] : 'there';
  const html = wrapEmail(`
    <h2 style="margin:0 0 10px 0; font-size:20px; font-weight:700; color:#111827;">
      New Connection Request
    </h2>
    <p style="margin:0 0 20px 0; font-size:15px; color:#374151; line-height:1.65;">
      Hi ${firstName}, <strong>${requesterName}</strong> wants to connect with you on GatherrGo.
    </p>
    <p style="margin:0 0 28px 0; font-size:15px; color:#374151; line-height:1.65;">
      Open the app to accept or decline the request.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" class="cta-table"
           style="margin:0 auto 28px auto; width:100%; max-width:240px;">
      <tr>
        <td class="cta-td" style="border-radius:8px; background-color:#0D9488;">
          <a href="${config.websiteUrl || 'https://gatherrgo.com'}" class="cta-link"
             style="display:block; padding:14px 32px; color:#ffffff;
                    text-decoration:none; font-size:16px; font-weight:700;
                    border-radius:8px; text-align:center;
                    font-family:'Segoe UI',Arial,sans-serif;">
            View Request
          </a>
        </td>
      </tr>
    </table>
  `);
  return sendEmail({
    to: recipientEmail,
    subject: `${requesterName} wants to connect on GatherrGo`,
    html,
  });
};

// ─── Friend request accepted email ───────────────────────────────────────────

const sendRequestAcceptedEmail = async (recipientEmail, recipientName, accepterName) => {
  const firstName = recipientName ? recipientName.split(' ')[0] : 'there';
  const html = wrapEmail(`
    <h2 style="margin:0 0 10px 0; font-size:20px; font-weight:700; color:#111827;">
      Connection Accepted!
    </h2>
    <p style="margin:0 0 20px 0; font-size:15px; color:#374151; line-height:1.65;">
      Hi ${firstName}, <strong>${accepterName}</strong> accepted your connection request.
      You&rsquo;re now connected on GatherrGo!
    </p>
    <p style="margin:0 0 28px 0; font-size:15px; color:#374151; line-height:1.65;">
      Start planning a trip together.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" class="cta-table"
           style="margin:0 auto 28px auto; width:100%; max-width:240px;">
      <tr>
        <td class="cta-td" style="border-radius:8px; background-color:#0D9488;">
          <a href="${config.websiteUrl || 'https://gatherrgo.com'}" class="cta-link"
             style="display:block; padding:14px 32px; color:#ffffff;
                    text-decoration:none; font-size:16px; font-weight:700;
                    border-radius:8px; text-align:center;
                    font-family:'Segoe UI',Arial,sans-serif;">
            Open GatherrGo
          </a>
        </td>
      </tr>
    </table>
  `);
  return sendEmail({
    to: recipientEmail,
    subject: `${accepterName} accepted your connection request`,
    html,
  });
};

module.exports = {
  sendEmail,
  sendVerificationOTPEmail,
  sendPasswordResetOTPEmail,
  sendWelcomeEmail,
  sendTripCancelledEmail,
  sendConnectionRequestEmail,
  sendRequestAcceptedEmail,
  wrapEmail,
};
