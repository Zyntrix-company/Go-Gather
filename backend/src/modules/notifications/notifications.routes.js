const { Router } = require('express');
const controller = require('./notifications.controller');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

router.use(authenticateJWT);

// GET /notifications?page=1
router.get('/', controller.getNotifications);

// GET /notifications/unread-count  — must be before /:id to avoid param clash
router.get('/unread-count', controller.getUnreadCount);

// PATCH /notifications/read-all
router.patch('/read-all', controller.markAllRead);

// PATCH /notifications/:id/read
router.patch('/:id/read', controller.markRead);

module.exports = router;
