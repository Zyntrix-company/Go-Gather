const { Router } = require('express');
const ctrl = require('./ai.controller');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

// All AI routes require authentication
router.use(authenticateJWT);

// POST /ai/chat — Non-streaming response from Swee
router.post('/chat', ctrl.chat);

// POST /ai/chat/stream — SSE streaming response from Swee
router.post('/chat/stream', ctrl.chatStream);

// DELETE /ai/chat/:userId — Clear conversation (client-side history; server acknowledges)
router.delete('/chat/:userId', ctrl.clearConversation);

// POST /ai/report — Report a Swee response
router.post('/report', ctrl.reportIssue);

module.exports = router;
