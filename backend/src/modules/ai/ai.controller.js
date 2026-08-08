const aiService = require('./ai.service');
const conversationsService = require('./conversations.service');
const sweeMetrics = require('./swee.metrics');
const aiUsageService = require('./aiUsage.service');
const { geminiRateLimitMessage, serviceBusyMessage } = require('./swee.messages');
const logger = require('../../utils/logger');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * POST /ai/chat
 * Returns { reply, pendingAction, conversationId, messageId }.
 */
// Attachments sent inline as base64 with the chat message (documents / photos Swee reads).
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024; // ~12MB decoded per file
const ALLOWED_ATTACHMENT_MIME = /^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf|text\/plain)$/i;

function sanitizeAttachments(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const cleaned = [];
  for (const a of raw.slice(0, MAX_ATTACHMENTS)) {
    if (!a || typeof a !== 'object') continue;
    const { mimeType, data, name } = a;
    if (typeof mimeType !== 'string' || !ALLOWED_ATTACHMENT_MIME.test(mimeType)) continue;
    if (typeof data !== 'string' || !data) continue;
    // base64 length → approx decoded byte size
    if (Math.floor((data.length * 3) / 4) > MAX_ATTACHMENT_BYTES) continue;
    cleaned.push({
      mimeType,
      data,
      name: typeof name === 'string' ? name.slice(0, 200) : 'attachment',
    });
  }
  return cleaned;
}

const chat = async (req, res, next) => {
  try {
    const { message, conversationHistory, tripContext, conversationId, attachments } = req.body;

    const attachmentList = sanitizeAttachments(attachments);
    const hasText = typeof message === 'string' && message.trim();

    if (!hasText && attachmentList.length === 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'message or an attachment is required' });
    }

    if (conversationId && !isUuid(conversationId)) {
      return res.status(400).json({ error: 'BadRequest', message: 'conversationId must be a valid UUID' });
    }

    const result = await aiService.chat(req.user.id, hasText ? message.trim() : '', {
      conversationId: conversationId || null,
      conversationHistory,
      tripContext,
      attachments: attachmentList,
    });

    sweeMetrics.recordChatResult(true);
    aiUsageService.logUsageEvent(true);
    return res.status(200).json(result);
  } catch (error) {
    sweeMetrics.recordChatResult(false, error.sweeErrorCode || error.name || 'error');
    aiUsageService.logUsageEvent(false, error.sweeErrorCode || error.name || 'error');

    if (error.sweeErrorCode === 'GEMINI_RATE_LIMIT') {
      logger.warn('Swee chat Gemini rate limit', { userId: req.user?.id, statusCode: 429 });
      return res.status(429).json({
        error: 'GeminiRateLimit',
        limitType: 'gemini',
        message: error.message || geminiRateLimitMessage(),
      });
    }
    if (error.sweeErrorCode === 'SERVICE_UNAVAILABLE' || error.sweeErrorCode === 'CIRCUIT_OPEN') {
      logger.warn('Swee chat service unavailable', {
        userId: req.user?.id,
        statusCode: 503,
        code: error.sweeErrorCode,
      });
      return res.status(503).json({
        error: 'ServiceBusy',
        limitType: 'service',
        message: error.message || serviceBusyMessage(),
      });
    }
    logger.error('Swee chat error', { error: error.message, userId: req.user?.id, statusCode: error.statusCode });
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

const setConversationStarred = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ error: 'BadRequest', message: 'Invalid conversation id' });
    }
    const conversation = await conversationsService.setConversationStarred(
      req.user.id, req.params.id, !!req.body?.starred,
    );
    return res.status(200).json(conversation);
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
  setConversationStarred,
};
