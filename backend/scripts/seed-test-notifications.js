/**
 * Seed all notification types for one or more users.
 *
 * Usage:
 *   node backend/scripts/seed-test-notifications.js <userId> [userId2 ...]
 *
 * Example:
 *   node backend/scripts/seed-test-notifications.js abc-uuid-1 def-uuid-2
 *
 * The script inserts one row of every notification type into the notifications
 * table using fake but realistic data. No FCM pushes are sent.
 * Run from the repo root or from the backend/ directory.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { query: db } = require('../src/config/database');

const userIds = process.argv.slice(2);
if (userIds.length === 0) {
  console.error('Usage: node seed-test-notifications.js <userId> [userId2 ...]');
  process.exit(1);
}

const FAKE_TRIP_ID  = '00000000-0000-0000-0001-000000000001';
const FAKE_EVENT_ID = '00000000-0000-0000-0002-000000000002';

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
    data: { tripId: FAKE_TRIP_ID, tripName: 'Bali Trip 2025' },
  },
  {
    type: 'EVENT_MEMBER_ADDED',
    title: 'Added to Holi Bash 🎨',
    body: 'You have been added to "Holi Bash".',
    data: { eventId: FAKE_EVENT_ID, eventName: 'Holi Bash' },
  },
  {
    type: 'TRIP_CANCELLED',
    title: 'Trip Cancelled',
    body: '"Bali Trip 2025" has been cancelled by the organiser.',
    data: { tripId: FAKE_TRIP_ID, tripName: 'Bali Trip 2025' },
  },
  {
    type: 'ITINERARY_UPDATED',
    title: 'Itinerary Updated',
    body: 'Rohan Kapoor updated an activity in "Bali Trip 2025".',
    data: { tripId: FAKE_TRIP_ID, tripName: 'Bali Trip 2025' },
  },
  {
    type: 'DOCUMENT_UPLOADED',
    title: 'Document Added',
    body: 'Neha Singh added a document to "Bali Trip 2025".',
    data: { tripId: FAKE_TRIP_ID, parentName: 'Bali Trip 2025' },
  },
  {
    type: 'EXPENSE_ADDED',
    title: 'New Expense Added',
    body: 'Rohan Kapoor added an expense of ₹1,200 to "Bali Trip 2025".',
    data: { tripId: FAKE_TRIP_ID, tripName: 'Bali Trip 2025', amount: '1200', currency: 'INR' },
  },
  {
    type: 'NEW_MEMBER_JOINED',
    title: 'New Member Joined',
    body: 'Arjun Verma joined "Bali Trip 2025".',
    data: { tripId: FAKE_TRIP_ID },
  },
  {
    type: 'TRIP_MILESTONE',
    title: 'Trip Confirmed 🎉',
    body: '"Bali Trip 2025" has been confirmed. You\'re going!',
    data: { tripId: FAKE_TRIP_ID, tripName: 'Bali Trip 2025' },
  },
  {
    type: 'TRIP_REMINDER',
    title: '📅 1 day to go!',
    body: '"Bali Trip 2025" is just 1 day away. Start packing!',
    data: { tripId: FAKE_TRIP_ID, tripName: 'Bali Trip 2025', reminderType: '1_day_before' },
  },
  {
    type: 'EVENT_REMINDER',
    title: '📅 Event Tomorrow!',
    body: 'Your event "Holi Bash" is tomorrow. Get ready!',
    data: { eventId: FAKE_EVENT_ID, eventName: 'Holi Bash', reminderType: '1_day_before' },
  },
  {
    type: 'GALLERY_LIKED',
    title: 'Gallery Activity',
    body: 'Priya Mehta liked "Bali Trip 2025"',
    data: { parentType: 'trip', tripId: FAKE_TRIP_ID, tripName: 'Bali Trip 2025', screen: 'gallery' },
  },
  {
    type: 'GALLERY_COMMENT',
    title: 'New Gallery Comment',
    body: 'Rohan Kapoor commented on "Summer BBQ": Great shots!',
    data: {
      parentType: 'gallery_album',
      parentId: '00000000-0000-0000-0003-000000000003',
      albumOwnerId: '00000000-0000-0000-0099-000000000099',
      albumOwnerName: 'You',
      screen: 'gallery',
    },
  },
];

async function seed(userId) {
  const placeholders = seeds
    .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
    .join(', ');
  const params = seeds.flatMap((n) => [
    userId,
    n.type,
    n.title,
    n.body,
    JSON.stringify(n.data),
  ]);

  await db(
    `INSERT INTO notifications (user_id, type, title, body, data) VALUES ${placeholders}`,
    params,
  );
  console.log(`✓ Seeded ${seeds.length} notifications for user ${userId}`);
}

(async () => {
  try {
    for (const id of userIds) {
      await seed(id);
    }
    console.log('\nDone. Open the app and pull-to-refresh the Notifications screen.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
