const aiService = require('./ai.service');
const logger = require('../../utils/logger');

/**
 * POST /ai/chat
 * Non-streaming chat with Swee. Returns { reply, pendingAction }.
 * pendingAction is non-null when Swee has collected enough info and is showing a recap.
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

    await aiService.chatStream(
      req.user.id,
      message.trim(),
      conversationHistory,
      tripContext,
      res,
    );
  } catch (error) {
    logger.error('Swee stream error', { error: error.message, userId: req.user?.id });
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
 * DELETE /ai/chat/:userId — Clear conversation (client-side history; server acknowledges).
 */
const clearConversation = async (_req, res) => {
  return res.status(200).json({ success: true });
};

/**
 * POST /ai/execute
 * Execute a confirmed Swee action (create_trip, create_event, update_trip, update_event, add_note).
 * Body: { pendingAction: { intent, draft, tripId?, targetTripName?, ... } }
 * Returns: { reply, created: { id, type, name } | null }
 */
const executeAction = async (req, res, next) => {
  try {
    const { pendingAction } = req.body;

    if (!pendingAction || typeof pendingAction !== 'object') {
      return res.status(400).json({ error: 'BadRequest', message: 'pendingAction is required' });
    }

    if (!pendingAction.readyToCreate) {
      return res.status(400).json({ error: 'BadRequest', message: 'Action is not ready for execution' });
    }

    const result = await aiService.executeAction(req.user.id, pendingAction);
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Swee execute error', { error: error.message, userId: req.user?.id });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: 'ExecuteError', message: error.message });
    }
    next(error);
  }
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

module.exports = { chat, chatStream, clearConversation, executeAction, reportIssue };
