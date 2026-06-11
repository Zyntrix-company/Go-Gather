const aiService = require('./ai.service');
const conversationsService = require('./conversations.service');
const logger = require('../../utils/logger');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * POST /ai/chat
 * Returns { reply, pendingAction, conversationId, messageId }.
 */
const chat = async (req, res, next) => {
  try {
    const { message, conversationHistory, tripContext, conversationId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'BadRequest', message: 'message is required' });
    }

    if (conversationId && !isUuid(conversationId)) {
      return res.status(400).json({ error: 'BadRequest', message: 'conversationId must be a valid UUID' });
    }

    const result = await aiService.chat(req.user.id, message.trim(), {
      conversationId: conversationId || null,
      conversationHistory,
      tripContext,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Swee chat error', { error: error.message, userId: req.user?.id });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: 'ChatError', message: error.message });
    }
    next(error);
  }
};

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

/** @deprecated Use DELETE /ai/conversations/:id */
const clearConversation = async (_req, res) => {
  return res.status(200).json({ success: true });
};

const executeAction = async (req, res, next) => {
  try {
    const { pendingAction, conversationId } = req.body;

    if (!pendingAction || typeof pendingAction !== 'object') {
      return res.status(400).json({ error: 'BadRequest', message: 'pendingAction is required' });
    }

    if (!pendingAction.readyToCreate) {
      return res.status(400).json({ error: 'BadRequest', message: 'Action is not ready for execution' });
    }

    if (conversationId && !isUuid(conversationId)) {
      return res.status(400).json({ error: 'BadRequest', message: 'conversationId must be a valid UUID' });
    }

    const result = await aiService.executeAction(req.user.id, pendingAction);

    if (conversationId) {
      try {
        await conversationsService.appendConfirmExchange(req.user.id, conversationId, {
          assistantContent: result.reply,
          createdResult: result.created ?? null,
        });
      } catch (persistErr) {
        logger.warn('executeAction persist failed', { error: persistErr.message });
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Swee execute error', { error: error.message, userId: req.user?.id });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: 'ExecuteError', message: error.message });
    }
    next(error);
  }
};

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

// ─── Conversations CRUD ───────────────────────────────────────────────────────

const listConversations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await conversationsService.listConversations(req.user.id, { page, limit });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('listConversations error', { error: error.message });
    next(error);
  }
};

const createConversation = async (req, res, next) => {
  try {
    const { tripContext } = req.body || {};
    const conversation = await conversationsService.createConversation(req.user.id, tripContext || null);
    return res.status(201).json(conversation);
  } catch (error) {
    logger.error('createConversation error', { error: error.message });
    next(error);
  }
};

const getConversation = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'BadRequest', message: 'Invalid conversation id' });
    }
    const conversation = await conversationsService.getConversation(req.user.id, req.params.id);
    return res.status(200).json(conversation);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'NotFound', message: error.message });
    }
    next(error);
  }
};

const getConversationMessages = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'BadRequest', message: 'Invalid conversation id' });
    }
    const before = req.query.before || null;
    const limit = parseInt(req.query.limit, 10) || 30;
    const result = await conversationsService.listMessages(req.user.id, req.params.id, { before, limit });
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'NotFound', message: error.message });
    }
    next(error);
  }
};

const deleteConversation = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'BadRequest', message: 'Invalid conversation id' });
    }
    const result = await conversationsService.deleteConversation(req.user.id, req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'NotFound', message: error.message });
    }
    next(error);
  }
};

module.exports = {
  chat,
  chatStream,
  clearConversation,
  executeAction,
  reportIssue,
  listConversations,
  createConversation,
  getConversation,
  getConversationMessages,
  deleteConversation,
};
