/**
 * GatherGo — Comprehensive Seed Script
 *
 * Creates 8 users, 6 trips (upcoming / ongoing / past / archived), a wider
 * friend graph, gallery photos (trip + event + one activity-linked), expenses,
 * activities, notes, polls, and invite tokens so API flows can be exercised
 * immediately after running this script.
 *
 * Run from the backend/ folder:
 *   node seed.js
 *
 * ─── Users ──────────────────────────────────────────────────────────────────
 *   alice   test@gathergo.com      +919876543210   @alice_gg    (primary)
 *   bob     bob@gathergo.com       +919876543211   @bob_gg
 *   charlie charlie@gathergo.com   +919876543212   @charlie_gg
 *   diana   diana@gathergo.com     +919876543213   @diana_gg
 *   eve     eve@gathergo.com       +919876543214   @eve_gg
 *   frank   frank@gathergo.com     +919876543215   @frank_gg
 *   grace   grace@gathergo.com     +919876543216   @grace_gg
 *   henry   henry@gathergo.com     +919876543217   @henry_gg
 *
 * ─── Trips ──────────────────────────────────────────────────────────────────
 *   UPCOMING  — "Goa Trip 2027"           admin alice, bob + charlie
 *   UPCOMING  — "Udaipur Long Weekend"   admin alice, bob + grace
 *   ONGOING   — "Manali Winter 2026"     admin alice, charlie
 *   PAST      — "Kerala Backwaters"      admin alice, bob
 *   PAST      — "Jaipur Heritage 2025"   admin alice, frank
 *   ARCHIVED  — "Kasol Trekking 2025"    admin alice, bob
 *
 * ─── Events ─────────────────────────────────────────────────────────────────
 *   UPCOMING  — "Diwali Night 2026"       alice admin, bob
 *   UPCOMING  — "NYE Party 2026"         alice admin, bob + charlie + grace
 *   UPCOMING  — "Pune Tech Meetup"        bob admin, alice + henry
 *   PAST      — "Holi 2024"               alice admin, charlie
 *
 * Gallery `photos` rows use Unsplash file_url; s3_key is a seed placeholder
 * (list/count APIs work; presigned image GET may 404 without real S3 objects).
 *
 * All passwords: TestPass123!
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
  host:     process.env.AWS_RDS_HOST,
  port:     parseInt(process.env.AWS_RDS_PORT, 10) || 5432,
  database: process.env.AWS_RDS_DB,
  user:     process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl:      { rejectUnauthorized: false },
});

// ── Fixed UUIDs (copy into Postman variables) ─────────────────────────────────

const IDS = {
  // Users
  alice:   'a0000000-0000-4000-8000-000000000001',
  bob:     'a0000000-0000-4000-8000-000000000002',
  charlie: 'a0000000-0000-4000-8000-000000000003',
  diana:   'a0000000-0000-4000-8000-000000000004',
  eve:     'a0000000-0000-4000-8000-000000000005',
  frank:   'a0000000-0000-4000-8000-000000000006',
  grace:   'a0000000-0000-4000-8000-000000000007',
  henry:   'a0000000-0000-4000-8000-000000000008',

  // Trips
  upcomingTrip: 'b0000000-0000-4000-8000-000000000001',
  ongoingTrip:  'b0000000-0000-4000-8000-000000000002',
  pastTrip:     'b0000000-0000-4000-8000-000000000003',
  archivedTrip: 'b0000000-0000-4000-8000-000000000004',
  udaipurTrip:  'b0000000-0000-4000-8000-000000000005',
  jaipurTrip:   'b0000000-0000-4000-8000-000000000006',

  // Expenses (upcoming trip — multi-user splits for balance testing)
  expense1: 'c0000000-0000-4000-8000-000000000001', // Hotel, equal, alice paid
  expense2: 'c0000000-0000-4000-8000-000000000002', // Scuba, percentage, bob paid
  expense3: 'c0000000-0000-4000-8000-000000000003', // Food, amount, charlie paid
  expense4: 'c0000000-0000-4000-8000-000000000004', // Ongoing trip expense
  expense5: 'c0000000-0000-4000-8000-000000000005', // Past trip expense (settled)

  // Polls
  poll1: 'd0000000-0000-4000-8000-000000000001',
  poll2: 'd0000000-0000-4000-8000-000000000002',

  // Friend connections
  connAliceBob:     'f0000000-0000-4000-8000-000000000001',
  connAliceCharlie: 'f0000000-0000-4000-8000-000000000002',
  connAliceDiana:   'f0000000-0000-4000-8000-000000000003',
  connEveAlice:     'f0000000-0000-4000-8000-000000000004',
  connAliceFrank:   'f0000000-0000-4000-8000-000000000005',
  connGraceAlice:   'f0000000-0000-4000-8000-000000000006',
  connBobCharlie:   'f0000000-0000-4000-8000-000000000007',
  connCharlieDiana: 'f0000000-0000-4000-8000-000000000008',
  connCharlieHenry: 'f0000000-0000-4000-8000-000000000009',

  // Activities
  actUpcoming1: 'e0000000-0000-4000-8000-000000000001',
  actUpcoming2: 'e0000000-0000-4000-8000-000000000002',
  actUpcoming3: 'e0000000-0000-4000-8000-000000000003',
  actOngoing1:  'e0000000-0000-4000-8000-000000000004',
  actOngoing2:  'e0000000-0000-4000-8000-000000000005', // completed
  actPast1:     'e0000000-0000-4000-8000-000000000006', // completed
  actPast2:     'e0000000-0000-4000-8000-000000000007', // completed

  // Notes
  note1: 'ac000000-0000-4000-8000-000000000001',
  note2: 'ac000000-0000-4000-8000-000000000002',
  note3: 'ac000000-0000-4000-8000-000000000003',

  // Events
  upcomingEvent: 'e1000000-0000-4000-8000-000000000001',
  pastEvent:     'e1000000-0000-4000-8000-000000000002',
  eventNYE:      'e1000000-0000-4000-8000-000000000003',
  eventMeetup:   'e1000000-0000-4000-8000-000000000004',

  // Udaipur trip activities
  actUdaipur1: 'e0000000-0000-4000-8000-000000000008',
  actUdaipur2: 'e0000000-0000-4000-8000-000000000009',

  // Gallery photos (shared `photos` table)
  photoGoa1:     'a5000000-0000-4000-8000-000000000001',
  photoGoa2:     'a5000000-0000-4000-8000-000000000002',
  photoGoa3:     'a5000000-0000-4000-8000-000000000003',
  photoGoaAct:   'a5000000-0000-4000-8000-000000000004',
  photoKerala1:  'a5000000-0000-4000-8000-000000000005',
  photoKerala2:  'a5000000-0000-4000-8000-000000000006',
  photoUdaipur1: 'a5000000-0000-4000-8000-000000000007',
  photoDiwali1:  'a5000000-0000-4000-8000-000000000008',
  photoDiwali2:  'a5000000-0000-4000-8000-000000000009',
  photoHoli1:    'a5000000-0000-4000-8000-00000000000a',
  photoNYE1:     'a5000000-0000-4000-8000-00000000000b',
  photoManali1:  'a5000000-0000-4000-8000-00000000000c',
  photoManali2:  'a5000000-0000-4000-8000-00000000000d',
  photoKasol1:   'a5000000-0000-4000-8000-00000000000e',
  photoKasol2:   'a5000000-0000-4000-8000-00000000000f',
  photoJaipur1:  'a5000000-0000-4000-8000-000000000010',
  photoJaipur2:  'a5000000-0000-4000-8000-000000000011',
  photoMeetup1:  'a5000000-0000-4000-8000-000000000012',
  photoNYE2:     'a5000000-0000-4000-8000-000000000013',

  // Event expenses
  eventExpense1: 'e2000000-0000-4000-8000-000000000001', // Venue, equal, alice paid
  eventExpense2: 'e2000000-0000-4000-8000-000000000002', // Catering, percentage, alice paid

  // Event polls
  eventPoll1: 'e3000000-0000-4000-8000-000000000001',

  // Event notes
  eventNote1: 'e4000000-0000-4000-8000-000000000001',
};

const PASSWORD = 'TestPass123!';

// ── Helper ────────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('\n🌱 GatherGo comprehensive seed starting…\n');

    // ── 1. Hash password (shared by all seed users) ───────────────────────────
    console.log('  Hashing password…');
    const hash = await bcrypt.hash(PASSWORD, 12);

    // ── 2. Users ──────────────────────────────────────────────────────────────
    console.log('  Seeding users…');
    const users = [
      [IDS.alice,   'test@gathergo.com',    '+919876543210', 'alice_gg'],
      [IDS.bob,     'bob@gathergo.com',     '+919876543211', 'bob_gg'],
      [IDS.charlie, 'charlie@gathergo.com', '+919876543212', 'charlie_gg'],
      [IDS.diana,   'diana@gathergo.com',   '+919876543213', 'diana_gg'],
      [IDS.eve,     'eve@gathergo.com',     '+919876543214', 'eve_gg'],
      [IDS.frank,   'frank@gathergo.com',   '+919876543215', 'frank_gg'],
      [IDS.grace,   'grace@gathergo.com',   '+919876543216', 'grace_gg'],
      [IDS.henry,   'henry@gathergo.com',   '+919876543217', 'henry_gg'],
    ];
    for (const [id, email, phone, username] of users) {
      await client.query(
        `INSERT INTO users (id, email, phone, password_hash, is_verified, is_profile_complete, username)
         VALUES ($1, $2, $3, $4, true, true, $5)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email, phone = EXCLUDED.phone,
           password_hash = EXCLUDED.password_hash,
           username = EXCLUDED.username`,
        [id, email, phone, hash, username],
      );
    }

    // ── 3. Profiles ───────────────────────────────────────────────────────────
    console.log('  Seeding profiles…');
    const profiles = [
      [IDS.alice,   'Alice Sharma',   '1998-06-15', 'female', 'India', 'Explorer & foodie 🌏'],
      [IDS.bob,     'Bob Mehta',      '1997-03-22', 'male',   'India', 'Mountain lover'],
      [IDS.charlie, 'Charlie Verma',  '1999-11-05', 'male',   'India', 'Beach bum'],
      [IDS.diana,   'Diana Kapoor',   '2000-07-18', 'female', 'India', 'New here!'],
      [IDS.eve,     'Eve Nair',       '1996-02-14', 'female', 'India', 'Wanderlust forever'],
      [IDS.frank,   'Frank Joshi',    '1995-09-30', 'male',   'India', 'History walks & coffee'],
      [IDS.grace,   'Grace Thomas',   '2001-01-08', 'female', 'India', 'Photography & road trips'],
      [IDS.henry,   'Henry Banerjee', '1997-12-01', 'male',   'India', 'Cycling & tech meetups'],
    ];
    for (const [uid, name, dob, gender, country, bio] of profiles) {
      await client.query(
        `INSERT INTO profiles (user_id, full_name, dob, gender, country, bio)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           full_name = EXCLUDED.full_name, bio = EXCLUDED.bio`,
        [uid, name, dob, gender, country, bio],
      );
    }

    // ── 4. Friend connections ─────────────────────────────────────────────────
    console.log('  Seeding friend connections…');
    const connections = [
      [IDS.connAliceBob, IDS.alice, IDS.bob, 'accepted'],
      [IDS.connAliceCharlie, IDS.alice, IDS.charlie, 'accepted'],
      [IDS.connAliceDiana, IDS.alice, IDS.diana, 'pending'],
      [IDS.connEveAlice, IDS.eve, IDS.alice, 'pending'],
      [IDS.connAliceFrank, IDS.alice, IDS.frank, 'accepted'],
      [IDS.connGraceAlice, IDS.grace, IDS.alice, 'accepted'],
      [IDS.connBobCharlie, IDS.bob, IDS.charlie, 'accepted'],
      [IDS.connCharlieDiana, IDS.charlie, IDS.diana, 'accepted'],
      [IDS.connCharlieHenry, IDS.charlie, IDS.henry, 'accepted'],
    ];
    for (const [id, req, addr, status] of connections) {
      await client.query(
        `INSERT INTO friend_connections (id, requester_id, addressee_id, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [id, req, addr, status],
      );
    }

    // ── 5. Friend invite token (for /invites/claim/:token testing) ───────────
    console.log('  Seeding friend invite token…');
    await client.query(
      `INSERT INTO friend_invites (id, invited_by, token, expires_at)
       VALUES ('fd000000-0000-4000-8000-000000000001', $1, 'friend-invite-seed-token-001',
               NOW() + INTERVAL '7 days')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.alice],
    );

    // ── 6. Trips ──────────────────────────────────────────────────────────────
    console.log('  Seeding trips…');

    // UPCOMING — starts in the future
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Goa Trip 2027', '2027-04-10', '2027-04-15',
               'Goa, India', 15.2993249, 74.1239960, $2,
               'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.upcomingTrip, IDS.alice],
    );

    // ONGOING — today falls within start_date..end_date
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Manali Winter 2026', '2026-01-01', '2026-12-31',
               'Manali, Himachal Pradesh', 32.2396153, 77.1887145, $2,
               'https://images.unsplash.com/photo-1477587458883-47145ed94245')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.ongoingTrip, IDS.alice],
    );

    // PAST — end_date in the past
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Kerala Backwaters', '2024-03-15', '2024-03-20',
               'Alleppey, Kerala', 9.4980762, 76.3388484, $2,
               'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.pastTrip, IDS.alice],
    );

    // ARCHIVED — past trip that has been archived
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url, archived_at)
       VALUES ($1, 'Kasol Trekking 2025', '2025-09-01', '2025-09-07',
               'Kasol, Himachal Pradesh', 32.0100000, 77.3148000, $2,
               'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
               '2025-10-01T10:00:00Z')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url, archived_at = EXCLUDED.archived_at`,
      [IDS.archivedTrip, IDS.alice],
    );

    // UPCOMING — long weekend (more gallery / member coverage)
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Udaipur Long Weekend', '2026-12-05', '2026-12-08',
               'Udaipur, Rajasthan', 24.5854452, 73.7124790, $2,
               'https://images.pexels.com/photos/3581364/pexels-photo-3581364.jpeg?auto=compress&cs=tinysrgb&w=1400')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.udaipurTrip, IDS.alice],
    );

    // PAST — heritage weekend (extra past trip for profiles & gallery lists)
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Jaipur Heritage 2025', '2025-01-10', '2025-01-14',
               'Jaipur, Rajasthan', 26.9124336, 75.7872709, $2,
               'https://images.unsplash.com/photo-1599661046289-e31897846e41')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.jaipurTrip, IDS.alice],
    );

    // ── 7. Trip members ───────────────────────────────────────────────────────
    console.log('  Seeding trip members…');
    const members = [
      // Upcoming: alice admin, bob + charlie members
      [IDS.upcomingTrip, IDS.alice,   'admin'],
      [IDS.upcomingTrip, IDS.bob,     'member'],
      [IDS.upcomingTrip, IDS.charlie, 'member'],
      // Ongoing: alice admin, charlie member
      [IDS.ongoingTrip, IDS.alice,   'admin'],
      [IDS.ongoingTrip, IDS.charlie, 'member'],
      // Past: alice admin, bob member
      [IDS.pastTrip, IDS.alice, 'admin'],
      [IDS.pastTrip, IDS.bob,   'member'],
      // Archived: alice admin, bob member
      [IDS.archivedTrip, IDS.alice, 'admin'],
      [IDS.archivedTrip, IDS.bob,   'member'],
      // Udaipur: alice admin, bob + grace
      [IDS.udaipurTrip, IDS.alice, 'admin'],
      [IDS.udaipurTrip, IDS.bob,   'member'],
      [IDS.udaipurTrip, IDS.grace, 'member'],
      // Jaipur past: alice admin, frank
      [IDS.jaipurTrip, IDS.alice, 'admin'],
      [IDS.jaipurTrip, IDS.frank, 'member'],
    ];
    for (const [tripId, userId, role] of members) {
      await client.query(
        `INSERT INTO trip_members (trip_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (trip_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [tripId, userId, role],
      );
    }

    // ── 8. Trip invite token (pending — for claim flow testing) ──────────────
    console.log('  Seeding trip invite token…');
    await client.query(
      `INSERT INTO trip_invites (id, trip_id, invited_by, email, token, expires_at)
       VALUES ('dc000000-0000-4000-8000-000000000001',
               $1, $2, 'outsider@example.com',
               'trip-invite-seed-token-001', NOW() + INTERVAL '7 days')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.upcomingTrip, IDS.alice],
    );

    // ── 9. Activities ─────────────────────────────────────────────────────────
    console.log('  Seeding activities…');

    // UPCOMING TRIP — 3 activities (all upcoming; one linked to expense later)
    const upcomingActivities = [
      [IDS.actUpcoming1, IDS.upcomingTrip, IDS.alice,   'Beach Day',         '2027-04-11', '10:00:00', 'Baga Beach',          'Bring sunscreen and towels.',      false, null],
      [IDS.actUpcoming2, IDS.upcomingTrip, IDS.bob,     'Sunset Cruise',     '2027-04-12', '17:30:00', 'Dona Paula Jetty',    'Book tickets in advance.',         false, null],
      [IDS.actUpcoming3, IDS.upcomingTrip, IDS.charlie, 'Scuba Diving',      '2027-04-13', '09:00:00', 'Grande Island',       'Bring underwater camera.',         false, null],
    ];

    // ONGOING TRIP — 1 upcoming + 1 completed
    const ongoingActivities = [
      [IDS.actOngoing1,  IDS.ongoingTrip,  IDS.alice,   'Snow Trek',         '2026-06-15', '07:00:00', 'Solang Valley',       'Carry warm layers.',               false, null],
      [IDS.actOngoing2,  IDS.ongoingTrip,  IDS.charlie, 'Rohtang Pass Visit','2026-03-10', '08:00:00', 'Rohtang Pass',        'Permit required — book online.',   true,  null],
    ];

    // PAST TRIP — all completed
    const pastActivities = [
      [IDS.actPast1, IDS.pastTrip, IDS.alice, 'Houseboat Stay',      '2024-03-16', '14:00:00', 'Alleppey Backwaters', 'Overnight on the houseboat.',      true, null],
      [IDS.actPast2, IDS.pastTrip, IDS.bob,   'Kathakali Show',      '2024-03-18', '18:30:00', 'Cochin Cultural Centre', 'Traditional dance performance.',  true, null],
    ];

    const udaipurActivities = [
      [IDS.actUdaipur1, IDS.udaipurTrip, IDS.alice, 'City Palace & Old Town', '2026-12-06', '09:30:00', 'City Palace, Udaipur', 'Guided walk + museum tickets.', false, null],
      [IDS.actUdaipur2, IDS.udaipurTrip, IDS.grace, 'Sunset Boat Dinner',     '2026-12-07', '18:00:00', 'Lake Pichola',         'Dress code: smart casual.',     false, null],
    ];

    for (const [id, tripId, createdBy, title, date, time, loc, desc, done, expId] of [
      ...upcomingActivities, ...ongoingActivities, ...pastActivities, ...udaipurActivities,
    ]) {
      await client.query(
        `INSERT INTO trip_activities
           (id, trip_id, created_by, title, activity_date, activity_time,
            location_name, description, is_completed, expense_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [id, tripId, createdBy, title, date, time, loc, desc, done, expId],
      );
    }

    // ── 10. Expenses (shared table — parent_type='trip') ──────────────────────
    console.log('  Seeding expenses…');

    // Expense 1: Hotel — equal split, alice paid, 3 people (alice, bob, charlie), ₹9000
    await client.query(
      `INSERT INTO expenses (id, parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
       VALUES ($1, 'trip', $2, 'Hotel Booking (3 nights)', 9000.00, 'accommodation', $3, 'equal', $3)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.expense1, IDS.upcomingTrip, IDS.alice],
    );
    for (const [uid, amt] of [[IDS.alice, 3000], [IDS.bob, 3000], [IDS.charlie, 3000]]) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount)
         VALUES ($1, $2, $3) ON CONFLICT (expense_id, user_id) DO NOTHING`,
        [IDS.expense1, uid, amt],
      );
    }

    // Expense 2: Scuba Package — percentage split, bob paid, ₹4000
    // bob 50% (₹2000), alice 30% (₹1200), charlie 20% (₹800)
    await client.query(
      `INSERT INTO expenses (id, parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
       VALUES ($1, 'trip', $2, 'Scuba Diving Package', 4000.00, 'entertainment', $3, 'percentage', $3)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.expense2, IDS.upcomingTrip, IDS.bob],
    );
    for (const [uid, amt, pct] of [
      [IDS.bob, 2000, 50], [IDS.alice, 1200, 30], [IDS.charlie, 800, 20],
    ]) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
         VALUES ($1, $2, $3, $4) ON CONFLICT (expense_id, user_id) DO NOTHING`,
        [IDS.expense2, uid, amt, pct],
      );
    }

    // Expense 3: Group Dinner — amount split, charlie paid, ₹3600
    // alice ₹1500, bob ₹1200, charlie ₹900
    await client.query(
      `INSERT INTO expenses (id, parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
       VALUES ($1, 'trip', $2, 'Group Dinner at Thalassa', 3600.00, 'food', $3, 'amount', $3)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.expense3, IDS.upcomingTrip, IDS.charlie],
    );
    for (const [uid, amt] of [[IDS.alice, 1500], [IDS.bob, 1200], [IDS.charlie, 900]]) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount)
         VALUES ($1, $2, $3) ON CONFLICT (expense_id, user_id) DO NOTHING`,
        [IDS.expense3, uid, amt],
      );
    }

    // Link expense2 (Scuba) to the Scuba Diving activity
    await client.query(
      `UPDATE trip_activities SET expense_id = $1 WHERE id = $2`,
      [IDS.expense2, IDS.actUpcoming3],
    );

    // ── 9b. Gallery photos (shared `photos` — photoCount on /users/:id/gallery)
    console.log('  Seeding gallery photos…');
    // Goa
    const uBeach    = 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200'; // Goa beach shoreline
    const uResort   = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200'; // Goa resort pool
    const uGoaBoat  = 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200';    // Goa harbour / fishing boats
    // Kerala
    const uBackwater  = 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200'; // Kerala backwaters (houseboat)
    const uKeralaCanal= 'https://images.unsplash.com/photo-1593693411515-c20261bcad6e?w=1200'; // Kerala canal / coconut palms
    // Udaipur
    const uPalace   = 'https://images.pexels.com/photos/3581364/pexels-photo-3581364.jpeg?auto=compress&cs=tinysrgb&w=1200'; // Udaipur City Palace
    // Manali
    const uManali   = 'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=1200'; // Manali snowy peaks
    const uSolang   = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200'; // Solang Valley snow
    // Kasol / Parvati Valley
    const uKasol    = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200'; // Parvati Valley forest trail
    const uKasolRiver = 'https://images.unsplash.com/photo-1455156218388-5e61b526818b?w=1200'; // mountain river trek
    // Jaipur
    const uHawaMahal = 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200'; // Hawa Mahal, Jaipur
    const uAmberFort = 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200'; // Amber Fort, Jaipur
    // Events
    const uLights   = 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200'; // Diwali festival lights
    const uHoli     = 'https://images.unsplash.com/photo-1580136608263-f526cf971b99?w=1200'; // Holi colours
    const uParty    = 'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=1200'; // NYE rooftop party
    const uMumbaiNight = 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200'; // Mumbai skyline at night
    const uMeetup   = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200'; // tech conference / meetup

    const galleryInserts = [
      // Goa trip
      [IDS.photoGoa1,    'trip',  IDS.upcomingTrip,  IDS.alice,   uBeach,       'seed/trips/goa/01.jpg',          'Shoreline at Baga',          null],
      [IDS.photoGoa2,    'trip',  IDS.upcomingTrip,  IDS.bob,     uResort,      'seed/trips/goa/02.jpg',          'Resort pool',                null],
      [IDS.photoGoa3,    'trip',  IDS.upcomingTrip,  IDS.charlie, uGoaBoat,     'seed/trips/goa/03.jpg',          'Fishing boats at harbour',   null],
      [IDS.photoGoaAct,  'trip',  IDS.upcomingTrip,  IDS.bob,     uBeach,       'seed/trips/goa/beach-day.jpg',   'Beach day',                  IDS.actUpcoming1],
      // Kerala trip
      [IDS.photoKerala1, 'trip',  IDS.pastTrip,      IDS.alice,   uBackwater,   'seed/trips/kerala/01.jpg',       'Houseboat morning',          null],
      [IDS.photoKerala2, 'trip',  IDS.pastTrip,      IDS.bob,     uKeralaCanal, 'seed/trips/kerala/02.jpg',       'Canal cruise through palms', null],
      // Udaipur trip
      [IDS.photoUdaipur1,'trip',  IDS.udaipurTrip,   IDS.grace,   uPalace,      'seed/trips/udaipur/01.jpg',      'City Palace view',           null],
      // Manali ongoing trip
      [IDS.photoManali1, 'trip',  IDS.ongoingTrip,   IDS.alice,   uManali,      'seed/trips/manali/01.jpg',       'Snow peaks at Manali',       null],
      [IDS.photoManali2, 'trip',  IDS.ongoingTrip,   IDS.charlie, uSolang,      'seed/trips/manali/02.jpg',       'Solang Valley',              IDS.actOngoing1],
      // Kasol archived trip
      [IDS.photoKasol1,  'trip',  IDS.archivedTrip,  IDS.alice,   uKasol,       'seed/trips/kasol/01.jpg',        'Parvati Valley trail',       null],
      [IDS.photoKasol2,  'trip',  IDS.archivedTrip,  IDS.bob,     uKasolRiver,  'seed/trips/kasol/02.jpg',        'Mountain river crossing',    null],
      // Jaipur past trip
      [IDS.photoJaipur1, 'trip',  IDS.jaipurTrip,    IDS.alice,   uHawaMahal,   'seed/trips/jaipur/01.jpg',       'Hawa Mahal, Pink City',      null],
      [IDS.photoJaipur2, 'trip',  IDS.jaipurTrip,    IDS.frank,   uAmberFort,   'seed/trips/jaipur/02.jpg',       'Amber Fort at sunrise',      null],
      // Events
      [IDS.photoDiwali1, 'event', IDS.upcomingEvent, IDS.alice,   uLights,      'seed/events/diwali/01.jpg',      'Diwali lights setup',        null],
      [IDS.photoDiwali2, 'event', IDS.upcomingEvent, IDS.bob,     uParty,       'seed/events/diwali/02.jpg',      'Stage and decorations',      null],
      [IDS.photoHoli1,   'event', IDS.pastEvent,     IDS.charlie, uHoli,        'seed/events/holi/01.jpg',        'Colours flying high',        null],
      [IDS.photoNYE1,    'event', IDS.eventNYE,      IDS.grace,   uParty,       'seed/events/nye/01.jpg',         'Countdown deck',             null],
      [IDS.photoNYE2,    'event', IDS.eventNYE,      IDS.alice,   uMumbaiNight, 'seed/events/nye/02.jpg',         'Mumbai skyline midnight',    null],
      [IDS.photoMeetup1, 'event', IDS.eventMeetup,   IDS.bob,     uMeetup,      'seed/events/meetup/01.jpg',      'Pune Tech Meetup stage',     null],
    ];
    for (const [id, pType, pId, uploadedBy, fileUrl, s3Key, caption, actId] of galleryInserts) {
      await client.query(
        `INSERT INTO photos (id, parent_type, parent_id, uploaded_by, file_url, s3_key, caption, mime_type, activity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'image/jpeg', $8)
         ON CONFLICT (id) DO NOTHING`,
        [id, pType, pId, uploadedBy, fileUrl, s3Key, caption, actId],
      );
    }

    // Expense 4: Ongoing trip — equal split, alice paid, ₹5000
    await client.query(
      `INSERT INTO expenses (id, parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
       VALUES ($1, 'trip', $2, 'Manali Resort (2 nights)', 5000.00, 'accommodation', $3, 'equal', $3)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.expense4, IDS.ongoingTrip, IDS.alice],
    );
    for (const [uid, amt] of [[IDS.alice, 2500], [IDS.charlie, 2500]]) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount)
         VALUES ($1, $2, $3) ON CONFLICT (expense_id, user_id) DO NOTHING`,
        [IDS.expense4, uid, amt],
      );
    }

    // Expense 5: Past trip — equal split, alice paid, ₹2400 (already settled)
    await client.query(
      `INSERT INTO expenses (id, parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
       VALUES ($1, 'trip', $2, 'Houseboat (overnight)', 2400.00, 'accommodation', $3, 'equal', $3)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.expense5, IDS.pastTrip, IDS.alice],
    );
    for (const [uid, amt] of [[IDS.alice, 1200], [IDS.bob, 1200]]) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount)
         VALUES ($1, $2, $3) ON CONFLICT (expense_id, user_id) DO NOTHING`,
        [IDS.expense5, uid, amt],
      );
    }
    // Bob has already settled with alice in the past trip
    await client.query(
      `INSERT INTO settlements (parent_type, parent_id, paid_by, paid_to, amount)
       VALUES ('trip', $1, $2, $3, 1200.00)`,
      [IDS.pastTrip, IDS.bob, IDS.alice],
    );

    // ── 11. Notes (shared table — parent_type='trip') ─────────────────────────
    console.log('  Seeding notes…');
    const notes = [
      [IDS.note1, IDS.upcomingTrip, IDS.alice,   'Packing List',       'Sunscreen, passport, waterproof bag, cash (₹5000 min).', 'todo'],
      [IDS.note2, IDS.upcomingTrip, IDS.bob,     'Hotel Details',      'Taj Exotica: Check-in 2PM. Booking ref: TJ2027GOA. Free breakfast included.', 'important'],
      [IDS.note3, IDS.ongoingTrip,  IDS.charlie, 'Manali Tips',        'Rohtang Pass permit required. Carry warm clothes. ATMs work till Kullu.', 'general'],
    ];
    for (const [id, tripId, createdBy, title, content, category] of notes) {
      await client.query(
        `INSERT INTO notes (id, parent_type, parent_id, created_by, title, content, category)
         VALUES ($1, 'trip', $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [id, tripId, createdBy, title, content, category],
      );
    }

    // ── 11b. Note favorites ───────────────────────────────────────────────────
    console.log('  Seeding note favorites…');
    const noteFavorites = [
      [IDS.note1, IDS.alice],
      [IDS.note1, IDS.bob],
      [IDS.note2, IDS.alice],
    ];
    for (const [noteId, userId] of noteFavorites) {
      await client.query(
        `INSERT INTO note_favorites (note_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (note_id, user_id) DO NOTHING`,
        [noteId, userId],
      );
    }

    // ── 12. Polls (shared table — parent_type='trip') ─────────────────────────
    console.log('  Seeding polls…');

    await client.query(
      `INSERT INTO polls (id, parent_type, parent_id, created_by, question)
       VALUES ($1, 'trip', $2, $3, 'Which beach should we visit on day 1?')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.poll1, IDS.upcomingTrip, IDS.alice],
    );
    // Store option IDs to cast votes
    const opts1 = await client.query(
      `INSERT INTO poll_options (poll_id, option_text, display_order)
       VALUES ($1, 'Baga Beach', 1), ($1, 'Anjuna Beach', 2), ($1, 'Palolem Beach', 3)
       ON CONFLICT DO NOTHING
       RETURNING id, option_text`,
      [IDS.poll1],
    );

    // Cast votes: alice → Baga, bob → Anjuna, charlie → Baga
    if (opts1.rows.length > 0) {
      const baga   = opts1.rows.find((r) => r.option_text === 'Baga Beach')?.id;
      const anjuna = opts1.rows.find((r) => r.option_text === 'Anjuna Beach')?.id;
      if (baga) {
        await client.query(
          `INSERT INTO poll_votes (poll_id, option_id, user_id)
           VALUES ($1,$2,$3),($1,$2,$4)
           ON CONFLICT (poll_id, user_id) DO NOTHING`,
          [IDS.poll1, baga, IDS.alice, IDS.charlie],
        );
      }
      if (anjuna) {
        await client.query(
          `INSERT INTO poll_votes (poll_id, option_id, user_id)
           VALUES ($1,$2,$3)
           ON CONFLICT (poll_id, user_id) DO NOTHING`,
          [IDS.poll1, anjuna, IDS.bob],
        );
      }
    }

    // Second poll on upcoming trip
    await client.query(
      `INSERT INTO polls (id, parent_type, parent_id, created_by, question)
       VALUES ($1, 'trip', $2, $3, 'How should we split the taxi fare?')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.poll2, IDS.upcomingTrip, IDS.bob],
    );
    await client.query(
      `INSERT INTO poll_options (poll_id, option_text, display_order)
       VALUES ($1, 'Split equally', 1), ($1, 'Each pay own share', 2)
       ON CONFLICT DO NOTHING`,
      [IDS.poll2],
    );

    // ── 13. Events ───────────────────────────────────────────────────────────
    console.log('  Seeding events…');

    // UPCOMING event
    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Diwali Night 2026', '2026-10-20', 'Festival',
               'Annual Diwali celebration with fireworks and dinner.',
               'Mumbai, India', 19.0760, 72.8777, $2,
               'https://images.unsplash.com/photo-1519677100203-a0e668c92439')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.upcomingEvent, IDS.alice],
    );

    // PAST event
    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Holi 2024', '2024-03-25', 'Festival',
               NULL,
               'Delhi, India', 28.6139, 77.2090, $2,
               'https://images.unsplash.com/photo-1580136608263-f526cf971b99')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.pastEvent, IDS.alice],
    );

    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'NYE Party 2026', '2026-12-31', 'Party',
               'Rooftop countdown, DJ, and midnight snacks.',
               'Bandra, Mumbai', 19.0544, 72.8406, $2,
               'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=1400')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.eventNYE, IDS.alice],
    );

    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Pune Tech Meetup', '2026-05-15', 'Networking',
               'Founders & builders coffee meetup — 40 seats.',
               'Koregaon Park, Pune', 18.5362, 73.8939, $2,
               'https://images.unsplash.com/photo-1540575467063-178a50c2df87')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.eventMeetup, IDS.bob],
    );

    // ── 13a. Event members ────────────────────────────────────────────────────
    console.log('  Seeding event members…');
    const eventMembers = [
      [IDS.upcomingEvent, IDS.alice,   'admin'],
      [IDS.upcomingEvent, IDS.bob,     'member'],
      [IDS.pastEvent,     IDS.alice,   'admin'],
      [IDS.pastEvent,     IDS.charlie, 'member'],
      [IDS.eventNYE, IDS.alice,   'admin'],
      [IDS.eventNYE, IDS.bob,     'member'],
      [IDS.eventNYE, IDS.charlie, 'member'],
      [IDS.eventNYE, IDS.grace,   'member'],
      [IDS.eventMeetup, IDS.bob,   'admin'],
      [IDS.eventMeetup, IDS.alice, 'member'],
      [IDS.eventMeetup, IDS.henry, 'member'],
    ];
    for (const [eventId, userId, role] of eventMembers) {
      await client.query(
        `INSERT INTO event_members (event_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [eventId, userId, role],
      );
    }

    // ── 13b. Event invite token (pending — for claim flow testing) ────────────
    console.log('  Seeding event invite token…');
    await client.query(
      `INSERT INTO event_invites (id, event_id, invited_by, email, token, expires_at)
       VALUES ('ea000000-0000-4000-8000-000000000001',
               $1, $2, 'outsider@example.com',
               'event-invite-seed-token-001', NOW() + INTERVAL '7 days')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.upcomingEvent, IDS.alice],
    );

    // ── 13c. Event reminders (upcoming event) ─────────────────────────────────
    console.log('  Seeding event reminders…');
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at)
       VALUES ($1, 'event_start',  '2026-10-20T03:30:00Z'),
              ($1, '1_day_before', '2026-10-19T03:30:00Z')`,
      [IDS.upcomingEvent],
    );
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at)
       VALUES ($1, 'event_start',  '2026-12-31T14:00:00Z'),
              ($1, '1_day_before', '2026-12-30T14:00:00Z')`,
      [IDS.eventNYE],
    );
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at)
       VALUES ($1, 'event_start',  '2026-05-15T04:30:00Z'),
              ($1, '1_day_before', '2026-05-14T04:30:00Z')`,
      [IDS.eventMeetup],
    );

    // ── 13d. Event expenses ───────────────────────────────────────────────────
    console.log('  Seeding event expenses…');

    // Venue Booking — equal split, alice paid, ₹6000
    await client.query(
      `INSERT INTO expenses (id, parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
       VALUES ($1, 'event', $2, 'Venue Booking', 6000.00, 'general', $3, 'equal', $3)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.eventExpense1, IDS.upcomingEvent, IDS.alice],
    );
    for (const [uid, amt] of [[IDS.alice, 3000], [IDS.bob, 3000]]) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount)
         VALUES ($1, $2, $3) ON CONFLICT (expense_id, user_id) DO NOTHING`,
        [IDS.eventExpense1, uid, amt],
      );
    }

    // Catering — percentage split, alice paid, ₹10000
    await client.query(
      `INSERT INTO expenses (id, parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
       VALUES ($1, 'event', $2, 'Catering', 10000.00, 'food', $3, 'percentage', $3)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.eventExpense2, IDS.upcomingEvent, IDS.alice],
    );
    for (const [uid, amt, pct] of [[IDS.alice, 6000, 60], [IDS.bob, 4000, 40]]) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
         VALUES ($1, $2, $3, $4) ON CONFLICT (expense_id, user_id) DO NOTHING`,
        [IDS.eventExpense2, uid, amt, pct],
      );
    }

    // ── 13e. Event poll ───────────────────────────────────────────────────────
    console.log('  Seeding event poll…');
    await client.query(
      `INSERT INTO polls (id, parent_type, parent_id, created_by, question)
       VALUES ($1, 'event', $2, $3, 'Which decoration theme should we go with?')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.eventPoll1, IDS.upcomingEvent, IDS.alice],
    );
    const eventPollOpts = await client.query(
      `INSERT INTO poll_options (poll_id, option_text, display_order)
       VALUES ($1, 'Bollywood', 1), ($1, 'Traditional', 2), ($1, 'Modern Glam', 3)
       ON CONFLICT DO NOTHING
       RETURNING id, option_text`,
      [IDS.eventPoll1],
    );
    if (eventPollOpts.rows.length > 0) {
      const bollywood = eventPollOpts.rows.find((r) => r.option_text === 'Bollywood')?.id;
      if (bollywood) {
        await client.query(
          `INSERT INTO poll_votes (poll_id, option_id, user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (poll_id, user_id) DO NOTHING`,
          [IDS.eventPoll1, bollywood, IDS.alice],
        );
      }
    }

    // ── 13f. Event note ───────────────────────────────────────────────────────
    console.log('  Seeding event note…');
    await client.query(
      `INSERT INTO notes (id, parent_type, parent_id, created_by, title, content, category)
       VALUES ($1, 'event', $2, $3, 'Guest List',
               'Alice, Bob, Charlie, Diana (TBC). RSVP by Oct 10.', 'important')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.eventNote1, IDS.upcomingEvent, IDS.alice],
    );

    // ── 14. Trip reminders (upcoming trip) ────────────────────────────────────
    console.log('  Seeding trip reminders…');
    const reminders = [
      [IDS.upcomingTrip, 'trip_start',    '2027-04-10T03:30:00Z'],
      [IDS.upcomingTrip, '1_day_before',  '2027-04-09T03:30:00Z'],
      [IDS.upcomingTrip, '1_week_before', '2027-04-03T03:30:00Z'],
    ];
    for (const [tripId, type, scheduledAt] of reminders) {
      await client.query(
        `INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at)
         VALUES ($1, $2, $3)`,
        [tripId, type, scheduledAt],
      );
    }

    await client.query('COMMIT');

    // ── Print summary ─────────────────────────────────────────────────────────
    console.log('\n✅  Seed complete!\n');
    console.log('══════════════════════════════════════════════════════════');
    console.log('  CREDENTIALS (all share the same password)');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  Password : ${PASSWORD}\n`);
    console.log('  User             Email                     ID');
    console.log('  ───────────────────────────────────────────────────────');
    console.log(`  alice (primary)  test@gathergo.com         ${IDS.alice}  @alice_gg`);
    console.log(`  bob              bob@gathergo.com          ${IDS.bob}  @bob_gg`);
    console.log(`  charlie          charlie@gathergo.com      ${IDS.charlie}  @charlie_gg`);
    console.log(`  diana            diana@gathergo.com        ${IDS.diana}  @diana_gg`);
    console.log(`  eve              eve@gathergo.com          ${IDS.eve}  @eve_gg`);
    console.log(`  frank            frank@gathergo.com        ${IDS.frank}  @frank_gg`);
    console.log(`  grace            grace@gathergo.com        ${IDS.grace}  @grace_gg`);
    console.log(`  henry            henry@gathergo.com        ${IDS.henry}  @henry_gg`);
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  TRIPS');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  UPCOMING  Goa Trip 2027           ${IDS.upcomingTrip}`);
    console.log(`  UPCOMING  Udaipur Long Weekend  ${IDS.udaipurTrip}`);
    console.log(`  ONGOING   Manali Winter 2026      ${IDS.ongoingTrip}`);
    console.log(`  PAST      Kerala Backwaters       ${IDS.pastTrip}`);
    console.log(`  PAST      Jaipur Heritage 2025    ${IDS.jaipurTrip}`);
    console.log(`  ARCHIVED  Kasol Trekking 2025     ${IDS.archivedTrip}`);
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  EVENTS');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  UPCOMING  Diwali Night 2026       ${IDS.upcomingEvent}`);
    console.log(`  UPCOMING  NYE Party 2026         ${IDS.eventNYE}`);
    console.log(`  UPCOMING  Pune Tech Meetup       ${IDS.eventMeetup}`);
    console.log(`  PAST      Holi 2024              ${IDS.pastEvent}`);
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  KEY IDs FOR POSTMAN');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  user_id (alice)    : ${IDS.alice}`);
    console.log(`  trip_id (upcoming) : ${IDS.upcomingTrip}`);
    console.log(`  trip_id (archived) : ${IDS.archivedTrip}`);
    console.log(`  event_id (upcoming): ${IDS.upcomingEvent}`);
    console.log(`  event_id (NYE)       : ${IDS.eventNYE}`);
    console.log(`  photo_id (sample)    : ${IDS.photoGoa1}`);
    console.log(`  expense_id (trip)  : ${IDS.expense1}`);
    console.log(`  expense_id (event) : ${IDS.eventExpense1}`);
    console.log(`  activity_id        : ${IDS.actUpcoming1}`);
    console.log(`  note_id (trip)     : ${IDS.note1}`);
    console.log(`  note_id (event)    : ${IDS.eventNote1}`);
    console.log(`  connection_id      : ${IDS.connAliceBob}   (alice↔bob, accepted)`);
    console.log(`  connection_id      : ${IDS.connEveAlice}   (eve→alice, PENDING — alice can accept)`);
    console.log(`  invite_token       : friend-invite-seed-token-001   (friend invite)`);
    console.log(`  invite_token       : trip-invite-seed-token-001     (trip invite)`);
    console.log(`  invite_token       : event-invite-seed-token-001    (event invite)`);
    console.log(`  target_user_id     : ${IDS.bob}   (bob's profile)`);
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  FRIEND STATES (as alice)');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  bob     → accepted   (can invite to trip/event via friendIds)`);
    console.log(`  charlie → accepted   (also bob↔charlie, charlie↔diana, charlie↔henry)`);
    console.log(`  frank   → accepted   (alice sent)`);
    console.log(`  grace   → accepted   (grace sent to alice — accepted)`);
    console.log(`  diana   → pending from alice; accepted with charlie`);
    console.log(`  eve     → pending    (eve sent  — alice can accept/decline)`);
    console.log('══════════════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
