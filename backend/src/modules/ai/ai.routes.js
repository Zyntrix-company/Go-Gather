const { Router } = require('express');
const ctrl = require('./ai.controller');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

// All AI routes require authentication
router.use(authenticateJWT);

// Conversations
router.get('/conversations', ctrl.listConversations);
router.post('/conversations', ctrl.createConversation);
router.get('/conversations/:id', ctrl.getConversation);
router.get('/conversations/:id/messages', ctrl.getConversationMessages);
router.delete('/conversations/:id', ctrl.deleteConversation);

// POST /ai/chat — Non-streaming chat with Swee; returns { reply, pendingAction, conversationId }
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
