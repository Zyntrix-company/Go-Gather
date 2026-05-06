const { Router } = require('express');
const controller = require('./notifications.controller');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

// Dev-only: manually trigger cron jobs and seed test data
if (process.env.NODE_ENV !== 'production') {
  const { processBatchedPushes } = require('../../utils/batching.cron');
  const { processDigests } = require('../../utils/digest.cron');
  const { query: db } = require('../../config/database');

  router.post('/dev/flush-batches', async (req, res) => {
    const count = await processBatchedPushes();
    res.json({ flushed: count });
  });

  router.post('/dev/run-digest', async (req, res) => {
    const count = await processDigests();
    res.json({ sent: count });
  });

  // Seed one of every notification type for the authenticated user.
  // Requires a valid JWT. Does NOT send FCM pushes — DB only.
  router.post('/dev/seed-all', authenticateJWT, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const fakeTrip  = '00000000-0000-0000-0001-000000000001';
      const fakeEvent = '00000000-0000-0000-0002-000000000002';

      const seeds = [
        {
          type: 'FRIEND_REQUEST',
          title: 'Aarav Sharma wants to connect',
          body: 'Tap to view their profile.',
          data: { userId: '00000000-0000-0000-0099-000000000099' },
        },
        {
          type: 'FRIEND_ACCEPTED',
          title: 'Priya Mehta accepted your request',
          body: 'You are now connected on GatherrGo.',
          data: { userId: '00000000-0000-0000-0098-000000000098' },
        },
        {
          type: 'TRIP_MEMBER_ADDED',
          title: 'Added to Bali Trip 🌴',
          body: 'You have been added to "Bali Trip 2025".',
          data: { tripId: fakeTrip, tripName: 'Bali Trip 2025' },
        },
        {
          type: 'EVENT_MEMBER_ADDED',
          title: 'Added to Holi Bash 🎨',
          body: 'You have been added to "Holi Bash".',
          data: { eventId: fakeEvent, eventName: 'Holi Bash' },
        },
        {
          type: 'TRIP_CANCELLED',
          title: 'Trip Cancelled',
          body: '"Bali Trip 2025" has been cancelled by the organiser.',
          data: { tripId: fakeTrip, tripName: 'Bali Trip 2025' },
        },
        {
          type: 'ITINERARY_UPDATED',
          title: 'Itinerary Updated',
          body: 'Rohan Kapoor updated an activity in "Bali Trip 2025".',
          data: { tripId: fakeTrip, tripName: 'Bali Trip 2025' },
        },
        {
          type: 'DOCUMENT_UPLOADED',
          title: 'Document Added',
          body: 'Neha Singh added a document to "Bali Trip 2025".',
          data: { tripId: fakeTrip, parentName: 'Bali Trip 2025' },
        },
        {
          type: 'EXPENSE_ADDED',
          title: 'New Expense Added',
          body: 'Rohan Kapoor added an expense of ₹1,200 to "Bali Trip 2025".',
          data: { tripId: fakeTrip, tripName: 'Bali Trip 2025', amount: '1200', currency: 'INR' },
        },
        {
          type: 'NEW_MEMBER_JOINED',
          title: 'New Member Joined',
          body: 'Arjun Verma joined "Bali Trip 2025".',
          data: { tripId: fakeTrip },
        },
        {
          type: 'TRIP_MILESTONE',
          title: 'Trip Confirmed 🎉',
          body: '"Bali Trip 2025" has been confirmed. You\'re going!',
          data: { tripId: fakeTrip, tripName: 'Bali Trip 2025' },
        },
        {
          type: 'TRIP_REMINDER',
          title: '📅 1 day to go!',
          body: '"Bali Trip 2025" is just 1 day away. Start packing!',
          data: { tripId: fakeTrip, tripName: 'Bali Trip 2025', reminderType: '1_day_before' },
        },
        {
          type: 'EVENT_REMINDER',
          title: '📅 Event Tomorrow!',
          body: 'Your event "Holi Bash" is tomorrow. Get ready!',
          data: { eventId: fakeEvent, eventName: 'Holi Bash', reminderType: '1_day_before' },
        },
      ];

      const placeholders = seeds
        .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
        .join(', ');
      const params = seeds.flatMap((n) => [userId, n.type, n.title, n.body, JSON.stringify(n.data)]);

      await db(
        `INSERT INTO notifications (user_id, type, title, body, data) VALUES ${placeholders}`,
        params,
      );

      res.json({ seeded: seeds.length, types: seeds.map((n) => n.type) });
    } catch (err) { next(err); }
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
