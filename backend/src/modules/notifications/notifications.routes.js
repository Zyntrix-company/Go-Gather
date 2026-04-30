const { Router } = require('express');
const controller = require('./notifications.controller');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

// Dev-only: manually trigger cron jobs (no auth, local only)
if (process.env.NODE_ENV !== 'production') {
  const { processBatchedPushes } = require('../../utils/batching.cron');
  const { processDigests } = require('../../utils/digest.cron');
  router.post('/dev/flush-batches', async (req, res) => {
    const count = await processBatchedPushes();
    res.json({ flushed: count });
  });
  router.post('/dev/run-digest', async (req, res) => {
    const count = await processDigests();
    res.json({ sent: count });
  });
}

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
