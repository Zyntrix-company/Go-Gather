const express = require('express');
const cors = require('cors');
const { sendEmail } = require('../../utils/mailer');
const logger = require('../../utils/logger');

const router = express.Router();

const allowedOrigins = process.env.CONTACT_ALLOWED_ORIGINS
  ? process.env.CONTACT_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['https://gatherrgo.com', 'http://localhost:5173', 'http://localhost:3000'];

const contactCors = cors({
  origin: allowedOrigins,
  credentials: true,
});

// Handle preflight
router.options('/', contactCors);

router.post('/', contactCors, async (req, res) => {
  const { name, email, subject, country, message } = req.body;

  if (!name || !email || !subject || !country || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const html = `
    <p>New message from the GatherrGo contact form.</p>
    <br>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <p><strong>Country:</strong> ${country}</p>
    <br>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;

  const text = `New message from the GatherrGo contact form.\n\nName:    ${name}\nEmail:   ${email}\nSubject: ${subject}\nCountry: ${country}\n\nMessage:\n${message}`;

  try {
    await sendEmail({
      to: 'Hello@GatherrGo.com',
      subject: `New Contact Form Submission — ${subject}`,
      html,
      text,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Contact form email failed', { error: error.message });
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
