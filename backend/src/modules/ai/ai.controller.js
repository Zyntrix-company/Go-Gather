const aiService = require('./ai.service');
const logger = require('../../utils/logger');

/**
 * POST /ai/chat — Non-streaming chat with Swee.
 */
const chat = async (req, res, next) => {
  try {
    const { message, conversationHistory, tripContext } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'BadRequest', message: 'message is required' });
    }

    const result = await aiService.chat(
      req.user.id,
      message.trim(),
      conversationHistory,
      tripContext,
    );

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Swee chat error', { error: error.message, userId: req.user?.id });
    next(error);
  }
};

/**
 * POST /ai/chat/stream — SSE streaming chat with Swee.
 */
const chatStream = async (req, res, next) => {
  try {
    const { message, conversationHistory, tripContext } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'BadRequest', message: 'message is required' });
    }

    // chatStream writes directly to res and calls res.end()
    await aiService.chatStream(
      req.user.id,
      message.trim(),
      conversationHistory,
      tripContext,
      res,
    );
  } catch (error) {
    logger.error('Swee stream error', { error: error.message, userId: req.user?.id });
    // If headers not yet sent, pass to error handler; otherwise the stream is broken
    if (!res.headersSent) {
      next(error);
    } else {
      try {
        res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
        res.end();
      } catch (_) { /* already closed */ }
    }
  }
};

/**
 * DELETE /ai/chat/:userId — Clear conversation history.
 * Conversation history is held client-side; this endpoint just confirms the reset.
 */
const clearConversation = async (req, res) => {
  return res.status(200).json({ success: true });
};

/**
 * POST /ai/report — Report a Swee response issue.
 */
const reportIssue = async (req, res, next) => {
  try {
    const { messageId, reason } = req.body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'BadRequest', message: 'reason is required' });
    }

    await aiService.reportIssue(req.user.id, messageId, reason.trim());
    return res.status(201).json({ success: true });
  } catch (error) {
    logger.error('Swee report error', { error: error.message, userId: req.user?.id });
    next(error);
  }
};

module.exports = { chat, chatStream, clearConversation, reportIssue };
