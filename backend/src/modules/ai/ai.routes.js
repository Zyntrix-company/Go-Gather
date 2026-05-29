const { Router } = require('express');
const ctrl = require('./ai.controller');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

// All AI routes require authentication
router.use(authenticateJWT);

// POST /ai/chat — Non-streaming chat with Swee; returns { reply, pendingAction }
router.post('/chat', ctrl.chat);

// POST /ai/chat/stream — SSE streaming chat with Swee
router.post('/chat/stream', ctrl.chatStream);

// DELETE /ai/chat/:userId — Clear conversation (client-side history; server acknowledges)
router.delete('/chat/:userId', ctrl.clearConversation);

// POST /ai/execute — Execute a confirmed Swee action (create/update trip or event)
router.post('/execute', ctrl.executeAction);

// POST /ai/report — Report a Swee response issue
router.post('/report', ctrl.reportIssue);

module.exports = router;
