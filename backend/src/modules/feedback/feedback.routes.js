/**
 * General in-app feedback / "Report a Problem" (Support screen).
 * Same feedback table Swee's report-an-issue uses (POST /ai/report), just
 * type='feedback' instead of 'swee_report' since it isn't tied to a chat message.
 */
const express = require('express');
const authenticateJWT = require('../../middleware/authenticate');
const { query: db } = require('../../config/database');
const logger = require('../../utils/logger');

const router = express.Router();

router.post('/', authenticateJWT, async (req, res, next) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'message is required', statusCode: 400 });
  }

  try {
    await db(
      `INSERT INTO feedback (user_id, type, message, status, created_at)
       VALUES ($1, 'feedback', $2, 'open', NOW())`,
      [req.user.id, message.trim().slice(0, 2000)],
    );
    res.status(201).json({ success: true });
  } catch (err) {
    logger.error('Feedback submit failed', { error: err.message, userId: req.user?.id });
    next(err);
  }
});

module.exports = router;
