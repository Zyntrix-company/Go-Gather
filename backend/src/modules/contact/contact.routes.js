const express = require('express');
const cors = require('cors');
const { sendEmail } = require('../../utils/mailer');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const router = express.Router();

const allowedOrigins = process.env.CONTACT_ALLOWED_ORIGINS
  ? process.env.CONTACT_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['https://gatherrgo.com', 'http://localhost:5173', 'http://localhost:3000'];

const contactCors = cors({ origin: allowedOrigins, credentials: true });

router.options('/', contactCors);

router.post('/', contactCors, async (req, res, next) => {
  const { name, email, subject, country, message } = req.body;

  if (!name || !email || !subject || !country || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  let submissionId;
  try {
    // Persist first — fail hard so nothing is lost silently
    const { rows } = await query(
      `INSERT INTO contact_submissions (name, email, subject, country, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, email, subject, country, message],
    );
    submissionId = rows[0].id;
  } catch (err) {
    logger.error('Contact form DB insert failed', { error: err.message });
    return next(err);
  }

  const html = `
    <p>New message from the GatherrGo contact form.</p>
    <br>
    <p><strong>Submission ID:</strong> ${submissionId}</p>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <p><strong>Country:</strong> ${country}</p>
    <br>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;

  const text = `New message from the GatherrGo contact form.\n\nID:      ${submissionId}\nName:    ${name}\nEmail:   ${email}\nSubject: ${subject}\nCountry: ${country}\n\nMessage:\n${message}`;

  try {
    await sendEmail({
      to: process.env.CONTACT_EMAIL || 'Hello@GatherrGo.com',
      subject: `New Contact Form Submission — ${subject}`,
      html,
      text,
    });
  } catch (error) {
    // Row is already persisted; email failure is non-fatal
    logger.error('Contact form email failed', { submissionId, error: error.message });
  }

  return res.status(200).json({ success: true });
});

module.exports = router;
