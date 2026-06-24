/**
 * GatherGo — Kabir seed script
 *
 * USER: Kabir Malhotra  kabir@gatherrgo.com  @kabir_gg  GatherrGo123!
 * Friends: ankan, pooja, vansh, alice (all accepted)
 *
 * TRIPS:
 *   UPCOMING  — "Spiti Valley Trek"   kabir + ankan + pooja + vansh
 *   ONGOING   — "Hampi Ruins Wknd"    kabir + ankan + vansh
 *   PAST      — "Varanasi Ganga"      kabir + pooja + ankan
 *
 * EVENTS:
 *   UPCOMING  — "Photography Meet"    kabir + vansh + ankan + pooja
 *   UPCOMING  — "Holi Brunch 2027"    kabir + pooja + vansh + ankan
 *   PAST      — "Kabir Bday Bash"     kabir + ankan + pooja + vansh + alice
 *
 * Each trip: 4–5 photos, 3–4 activities, 2–3 expenses, 1–2 polls, 2 notes, doc
 * Each event: 2 photos, 1 expense, 1 poll/note, reminders
 * Gallery likes + comments from friends
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const { normalizeAuthEmail } = require('../src/utils/email.util');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host:     process.env.AWS_RDS_HOST,
  port:     parseInt(process.env.AWS_RDS_PORT, 10) || 5432,
  database: process.env.AWS_RDS_DB,
  user:     process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl:      { rejectUnauthorized: false },
});

// ── Existing user IDs (from main seed) ────────────────────────────────────────
const EXISTING = {
  alice: 'a0000000-0000-4000-8000-000000000001',
  vansh: 'a0000000-0000-4000-8000-000000000009',
  ankan: 'a0000000-0000-4000-8000-00000000000a',
  pooja: 'a0000000-0000-4000-8000-00000000000b',
};

// ── New IDs ───────────────────────────────────────────────────────────────────
const K = {
  // User
  kabir: 'a0000000-0000-4000-8000-00000000000f',

  // Trips
  spitiTrip:    'b0000000-0000-4000-8000-00000000000b',
  hampiTrip:    'b0000000-0000-4000-8000-00000000000c',
  varanasiTrip: 'b0000000-0000-4000-8000-00000000000d',

  // Events
  photoMeetEvent: 'e1000000-0000-4000-8000-000000000007',
  holiBrunchEvent:'e1000000-0000-4000-8000-000000000008',
  bdayEvent:      'e1000000-0000-4000-8000-000000000009',

  // Activities — Spiti
  actSpiti1: 'e0000000-0000-4000-8000-000000000080',
  actSpiti2: 'e0000000-0000-4000-8000-000000000081',
  actSpiti3: 'e0000000-0000-4000-8000-000000000082',
  actSpiti4: 'e0000000-0000-4000-8000-000000000083',
  // Activities — Hampi
  actHampi1: 'e0000000-0000-4000-8000-000000000084',
  actHampi2: 'e0000000-0000-4000-8000-000000000085',
  actHampi3: 'e0000000-0000-4000-8000-000000000086',
  // Activities — Varanasi
  actVar1: 'e0000000-0000-4000-8000-000000000087',
  actVar2: 'e0000000-0000-4000-8000-000000000088',
  actVar3: 'e0000000-0000-4000-8000-000000000089',

  // Expenses — Spiti
  expSpiti1: 'c0000000-0000-4000-8000-00000000008b',
  expSpiti2: 'c0000000-0000-4000-8000-00000000008c',
  expSpiti3: 'c0000000-0000-4000-8000-00000000008d',
  // Expenses — Hampi
  expHampi1: 'c0000000-0000-4000-8000-00000000008e',
  expHampi2: 'c0000000-0000-4000-8000-00000000008f',
  // Expenses — Varanasi
  expVar1: 'c0000000-0000-4000-8000-000000000090',
  expVar2: 'c0000000-0000-4000-8000-000000000091',
  // Expenses — Events
  expPhotoMeet: 'c0000000-0000-4000-8000-000000000092',
  expHoliBrunch:'c0000000-0000-4000-8000-000000000093',
  expBday:      'c0000000-0000-4000-8000-000000000094',

  // Photos — Spiti (5)
  photoSpiti1: 'a5000000-0000-4000-8000-000000000085',
  photoSpiti2: 'a5000000-0000-4000-8000-000000000086',
  photoSpiti3: 'a5000000-0000-4000-8000-000000000087',
  photoSpiti4: 'a5000000-0000-4000-8000-000000000088',
  photoSpiti5: 'a5000000-0000-4000-8000-000000000089',
  // Photos — Hampi (4)
  photoHampi1: 'a5000000-0000-4000-8000-00000000008a',
  photoHampi2: 'a5000000-0000-4000-8000-00000000008b',
  photoHampi3: 'a5000000-0000-4000-8000-00000000008c',
  photoHampi4: 'a5000000-0000-4000-8000-00000000008d',
  // Photos — Varanasi (4)
  photoVar1: 'a5000000-0000-4000-8000-00000000008e',
  photoVar2: 'a5000000-0000-4000-8000-00000000008f',
  photoVar3: 'a5000000-0000-4000-8000-000000000090',
  photoVar4: 'a5000000-0000-4000-8000-000000000091',
  // Photos — Events (2 each)
  photoPhotoMeet1: 'a5000000-0000-4000-8000-000000000092',
  photoPhotoMeet2: 'a5000000-0000-4000-8000-000000000093',
  photoHoliBrunch1:'a5000000-0000-4000-8000-000000000094',
  photoHoliBrunch2:'a5000000-0000-4000-8000-000000000095',
  photoBday1: 'a5000000-0000-4000-8000-000000000096',
  photoBday2: 'a5000000-0000-4000-8000-000000000097',

  // Polls
  pollSpiti1:    'd0000000-0000-4000-8000-00000000000f',
  pollSpiti2:    'd0000000-0000-4000-8000-000000000010',
  pollHampi1:    'd0000000-0000-4000-8000-000000000011',
  pollVar1:      'd0000000-0000-4000-8000-000000000012',
  pollPhotoMeet: 'd0000000-0000-4000-8000-000000000013',
  pollBday:      'd0000000-0000-4000-8000-000000000014',

  // Notes
  noteSpiti1:    'ac000000-0000-4000-8000-000000000017',
  noteSpiti2:    'ac000000-0000-4000-8000-000000000018',
  noteHampi1:    'ac000000-0000-4000-8000-000000000019',
  noteHampi2:    'ac000000-0000-4000-8000-00000000001a',
  noteVar1:      'ac000000-0000-4000-8000-00000000001b',
  noteVar2:      'ac000000-0000-4000-8000-00000000001c',
  notePhotoMeet: 'ac000000-0000-4000-8000-00000000001d',
  noteBday:      'ac000000-0000-4000-8000-00000000001e',

  // Docs
  docSpiti:    'dd000000-0000-4000-8000-000000000001',
  docVar:      'dd000000-0000-4000-8000-000000000002',

  // Friend connections
  connKabirAnkan: 'f0000000-0000-4000-8000-00000000001f',
  connKabirPooja: 'f0000000-0000-4000-8000-000000000020',
  connKabirVansh: 'f0000000-0000-4000-8000-000000000021',
  connKabirAlice: 'f0000000-0000-4000-8000-000000000022',
};

// ── Image URLs ────────────────────────────────────────────────────────────────
// Spiti — high altitude desert/snow Himalayan
const IMG = {
  spitiPeaks:   'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1600&q=80',
  spitiSnow:    'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?auto=format&fit=crop&w=1600&q=80',
  spitiMtn:     'https://images.unsplash.com/photo-1547378291-be04e77e0e0b?auto=format&fit=crop&w=1600&q=80',
  spitiCamp:    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80',
  spitiRoad:    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1600&q=80',
  // Hampi — stone ruins / Karnataka heritage
  hampiFort:    'https://images.unsplash.com/photo-1548013146-8673ef918943?auto=format&fit=crop&w=1600&q=80',
  hampiLake:    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1600&q=80',
  hampiGolden:  'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1600&q=80',
  hampiRiver:   'https://images.unsplash.com/photo-1609766934741-d77f51e4da70?auto=format&fit=crop&w=1600&q=80',
  // Varanasi — ghats, Ganga
  varGhats:     'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1600&q=80',
  varBoats:     'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1600&q=80',
  varSunset:    'https://images.unsplash.com/photo-1559732277-7453b141e3a1?auto=format&fit=crop&w=1600&q=80',
  varRiver:     'https://images.unsplash.com/photo-1530866495567-afb7a318686e?auto=format&fit=crop&w=1600&q=80',
  // Events
  photoCamera:  'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1600&q=80',
  photoShoot:   'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1600&q=80',
  holiColors:   'https://images.unsplash.com/photo-1580136608263-f526cf971b99?auto=format&fit=crop&w=1600&q=80',
  holiCrowd:    'https://images.unsplash.com/photo-1576153192396-180ecef2a715?auto=format&fit=crop&w=1600&q=80',
  bdayRooftop:  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
  bdayCrowd:    'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=1600&q=80',
  // Kabir avatar — South Asian male portrait
  kabirAvatar:  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&h=800&q=80',
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('\n🌱 Kabir seed starting…\n');

    const hash = await bcrypt.hash('GatherrGo123!', 12);
    const emailNormalized = normalizeAuthEmail('kabir@gatherrgo.com');

    // ── 1. User ───────────────────────────────────────────────────────────────
    console.log('  User…');
    await client.query(
      `INSERT INTO users (id, email, email_normalized, phone, password_hash, is_verified, is_profile_complete, username)
       VALUES ($1, 'kabir@gatherrgo.com', $2, '+919876543224', $3, true, true, 'kabir_gg')
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email, email_normalized = EXCLUDED.email_normalized,
         phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash, username = EXCLUDED.username`,
      [K.kabir, emailNormalized, hash],
    );

    // ── 2. Profile ────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO profiles (user_id, full_name, dob, gender, country, bio, avatar_url)
       VALUES ($1, 'Kabir Malhotra', '1997-07-14', 'male', 'India',
               'Street photographer | Heritage hunter | Ganga > all', $2)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name, dob = EXCLUDED.dob,
         bio = EXCLUDED.bio, avatar_url = EXCLUDED.avatar_url`,
      [K.kabir, IMG.kabirAvatar],
    );

    // ── 3. Friend connections ─────────────────────────────────────────────────
    console.log('  Friends…');
    const conns = [
      [K.connKabirAnkan, K.kabir,        EXISTING.ankan, 'accepted'],
      [K.connKabirPooja, K.kabir,        EXISTING.pooja, 'accepted'],
      [K.connKabirVansh, K.kabir,        EXISTING.vansh, 'accepted'],
      [K.connKabirAlice, EXISTING.alice, K.kabir,        'accepted'],
    ];
    for (const [id, req, addr, status] of conns) {
      await client.query(
        `INSERT INTO friend_connections (id, requester_id, addressee_id, status)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [id, req, addr, status],
      );
    }

    // ── 4. Trips ──────────────────────────────────────────────────────────────
    console.log('  Trips…');

    // UPCOMING
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Spiti Valley Trek', '2026-09-10', '2026-09-18',
               'Kaza, Spiti Valley', 32.2274, 78.0698, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [K.spitiTrip, K.kabir, IMG.spitiPeaks],
    );

    // ONGOING — today is 2026-06-19, trip runs 06-17 to 06-21
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Hampi Ruins Wknd', '2026-06-17', '2026-06-21',
               'Hampi, Karnataka', 15.3350, 76.4600, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [K.hampiTrip, K.kabir, IMG.hampiFort],
    );

    // PAST
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Varanasi Ganga', '2026-02-10', '2026-02-14',
               'Varanasi, Uttar Pradesh', 25.3176, 82.9739, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [K.varanasiTrip, K.kabir, IMG.varGhats],
    );

    // Trip locations (migration 047)
    for (const [tripId, name, lat, lng] of [
      [K.spitiTrip,    'Kaza, Spiti Valley',        32.2274, 78.0698],
      [K.hampiTrip,    'Hampi, Karnataka',           15.3350, 76.4600],
      [K.varanasiTrip, 'Varanasi, Uttar Pradesh',   25.3176, 82.9739],
    ]) {
      await client.query(
        `INSERT INTO trip_locations (trip_id, name, lat, lng, sort_order)
         SELECT $1, $2, $3, $4, 0 WHERE NOT EXISTS
           (SELECT 1 FROM trip_locations WHERE trip_id = $1 AND sort_order = 0)`,
        [tripId, name, lat, lng],
      );
    }

    // ── 5. Trip members ───────────────────────────────────────────────────────
    const tripMembers = [
      [K.spitiTrip,    K.kabir,        'admin'],
      [K.spitiTrip,    EXISTING.ankan, 'member'],
      [K.spitiTrip,    EXISTING.pooja, 'member'],
      [K.spitiTrip,    EXISTING.vansh, 'member'],
      [K.hampiTrip,    K.kabir,        'admin'],
      [K.hampiTrip,    EXISTING.ankan, 'member'],
      [K.hampiTrip,    EXISTING.vansh, 'member'],
      [K.varanasiTrip, K.kabir,        'admin'],
      [K.varanasiTrip, EXISTING.pooja, 'member'],
      [K.varanasiTrip, EXISTING.ankan, 'member'],
    ];
    for (const [tripId, userId, role] of tripMembers) {
      await client.query(
        `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1,$2,$3)
         ON CONFLICT (trip_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [tripId, userId, role],
      );
    }

    // ── 6. Activities ─────────────────────────────────────────────────────────
    console.log('  Activities…');
    const activities = [
      // SPITI (upcoming)
      [K.actSpiti1, K.spitiTrip, K.kabir,        'Acclimatise in Kaza',          '2026-09-11', '10:00:00', 'Kaza Main Market, Spiti',       'Easy walks only — 3600m altitude. Drink 3L water, skip alcohol first 48hrs. Group dinner at Sichuan Kitchen.',                                        false, null],
      [K.actSpiti2, K.spitiTrip, EXISTING.ankan, 'Key Monastery Dawn Visit',     '2026-09-12', '06:00:00', 'Key Gompa, Spiti',              'Oldest monastery in Spiti — monks morning prayer at 6:30AM. Reach before sunrise for empty courtyard shots. Carry warm layers.',                   false, null],
      [K.actSpiti3, K.spitiTrip, EXISTING.pooja, 'Chandratal Lake Day Trek',     '2026-09-14', '05:30:00', 'Chandratal, Spiti',             'Half-moon lake at 4300m — otherworldly blue. 8km trek one way. Permits arranged. Pack lunch and emergency glucose.',                               false, null],
      [K.actSpiti4, K.spitiTrip, EXISTING.vansh, 'Langza Village & Fossil Hunt', '2026-09-16', '09:00:00', 'Langza, Spiti',                 '14,000ft village with a giant Buddha statue. Famous for marine fossils. Quiet morning walk before tourist buses arrive.',                            false, null],
      // HAMPI (ongoing)
      [K.actHampi1, K.hampiTrip, K.kabir,        'Virupaksha Temple at Dawn',    '2026-06-18', '05:45:00', 'Virupaksha Temple, Hampi',      'Main temple opens at 6AM — arrive before for golden light on the gopuram. Dress code enforced: cover shoulders.',                                     true,  null],
      [K.actHampi2, K.hampiTrip, EXISTING.ankan, 'Boulder Hopping — Hemakuta',   '2026-06-19', '07:00:00', 'Hemakuta Hill, Hampi',          'Best sunrise view in Hampi. Ancient Jain temples on the hill. Slippery rocks — wear grip shoes. Photography paradise.',                             false, null],
      [K.actHampi3, K.hampiTrip, EXISTING.vansh, 'Tungabhadra Coracle Ride',     '2026-06-20', '08:00:00', 'Tungabhadra River, Hampi',      'Circular bamboo-wicker boat ride across the river to reach Anegundi. 10min crossing — super fun. Morning light perfect for photos.',                false, null],
      // VARANASI (past, all completed)
      [K.actVar1, K.varanasiTrip, K.kabir,        'Ganga Aarti — Dashashwamedh',  '2026-02-11', '17:45:00', 'Dashashwamedh Ghat, Varanasi',  'Arrive by 5:30PM for front-row seats. 45min ceremony with fire lamps and chants — one of India\'s most moving experiences. No photos during aarti.',  true,  null],
      [K.actVar2, K.varanasiTrip, EXISTING.pooja, 'Sunrise Boat on the Ganga',    '2026-02-12', '05:30:00', 'Assi Ghat, Varanasi',           'Row boat from Assi to Manikarnika and back — 90min on the river. Early morning mist is magic. Fixed boat price Rs 500 for group.',                 true,  null],
      [K.actVar3, K.varanasiTrip, EXISTING.ankan, 'Sarnath Buddhist Circuit',     '2026-02-13', '09:00:00', 'Sarnath, Varanasi',             '10km from Varanasi — where Buddha gave his first sermon. Dhamek Stupa, museum with lion capital original. Tuk-tuk 45min.',                         true,  null],
    ];
    for (const [id, tripId, createdBy, title, date, time, loc, desc, done, expId] of activities) {
      await client.query(
        `INSERT INTO trip_activities
           (id, trip_id, created_by, title, activity_date, activity_time,
            location_name, description, is_completed, expense_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [id, tripId, createdBy, title, date, time, loc, desc, done, expId],
      );
    }

    // ── 7. Expenses ───────────────────────────────────────────────────────────
    console.log('  Expenses…');
    const addExp = async (id, pType, pId, desc, amount, cat, paidBy, splitType) => {
      await client.query(
        `INSERT INTO expenses (id, parent_type, parent_id, description, amount, category, paid_by, split_type, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$7) ON CONFLICT (id) DO NOTHING`,
        [id, pType, pId, desc, amount, cat, paidBy, splitType],
      );
    };
    const addSplit = async (expId, userId, amount, pct = null) => {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
         VALUES ($1,$2,$3,$4) ON CONFLICT (expense_id, user_id) DO NOTHING`,
        [expId, userId, amount, pct],
      );
    };

    // Spiti
    await addExp(K.expSpiti1, 'trip', K.spitiTrip, 'Homestay — 8 nights (Kaza)', 32000, 'accommodation', K.kabir, 'equal');
    for (const uid of [K.kabir, EXISTING.ankan, EXISTING.pooja, EXISTING.vansh]) await addSplit(K.expSpiti1, uid, 8000);

    await addExp(K.expSpiti2, 'trip', K.spitiTrip, 'Shared SUV — Manali to Kaza', 16000, 'transportation', EXISTING.vansh, 'equal');
    for (const uid of [K.kabir, EXISTING.ankan, EXISTING.pooja, EXISTING.vansh]) await addSplit(K.expSpiti2, uid, 4000);

    await addExp(K.expSpiti3, 'trip', K.spitiTrip, 'Trekking guide + permits', 6000, 'entertainment', EXISTING.ankan, 'equal');
    for (const uid of [K.kabir, EXISTING.ankan, EXISTING.pooja, EXISTING.vansh]) await addSplit(K.expSpiti3, uid, 1500);

    // Hampi
    await addExp(K.expHampi1, 'trip', K.hampiTrip, 'Guesthouse — 4 nights (Hampi Boulders)', 9600, 'accommodation', K.kabir, 'equal');
    for (const uid of [K.kabir, EXISTING.ankan, EXISTING.vansh]) await addSplit(K.expHampi1, uid, 3200);

    await addExp(K.expHampi2, 'trip', K.hampiTrip, 'Scooter rentals + fuel', 2400, 'transportation', EXISTING.ankan, 'equal');
    for (const uid of [K.kabir, EXISTING.ankan, EXISTING.vansh]) await addSplit(K.expHampi2, uid, 800);

    // Varanasi
    await addExp(K.expVar1, 'trip', K.varanasiTrip, 'Hotel Ganpati — 4 nights (Assi Ghat)', 12000, 'accommodation', K.kabir, 'equal');
    for (const uid of [K.kabir, EXISTING.pooja, EXISTING.ankan]) await addSplit(K.expVar1, uid, 4000);

    await addExp(K.expVar2, 'trip', K.varanasiTrip, 'Boat rides + Sarnath taxi', 2100, 'transportation', EXISTING.pooja, 'equal');
    for (const uid of [K.kabir, EXISTING.pooja, EXISTING.ankan]) await addSplit(K.expVar2, uid, 700);

    // Settlements — Varanasi settled
    await client.query(
      `INSERT INTO settlements (parent_type, parent_id, paid_by, paid_to, amount)
       VALUES ('trip',$1,$2,$3,4700.00), ('trip',$1,$4,$3,4700.00) ON CONFLICT DO NOTHING`,
      [K.varanasiTrip, EXISTING.pooja, K.kabir, EXISTING.ankan],
    );

    // ── 8. Photos ─────────────────────────────────────────────────────────────
    console.log('  Photos…');
    const photos = [
      // Spiti (5)
      [K.photoSpiti1, 'trip', K.spitiTrip, K.kabir,        IMG.spitiPeaks,   'seed/trips/spiti/01.jpg', 'Prayer flags at 4500m',           null, 0],
      [K.photoSpiti2, 'trip', K.spitiTrip, EXISTING.ankan, IMG.spitiSnow,    'seed/trips/spiti/02.jpg', 'Snow bowl above Kaza',            K.actSpiti3, 1],
      [K.photoSpiti3, 'trip', K.spitiTrip, EXISTING.pooja, IMG.spitiMtn,     'seed/trips/spiti/03.jpg', 'Himalayan peaks at golden hour',  null, 2],
      [K.photoSpiti4, 'trip', K.spitiTrip, EXISTING.vansh, IMG.spitiCamp,    'seed/trips/spiti/04.jpg', 'Camp under the Milky Way',        K.actSpiti4, 3],
      [K.photoSpiti5, 'trip', K.spitiTrip, K.kabir,        IMG.spitiRoad,    'seed/trips/spiti/05.jpg', 'Convoy on Spiti highway',         null, 4],
      // Hampi (4)
      [K.photoHampi1, 'trip', K.hampiTrip, K.kabir,        IMG.hampiFort,    'seed/trips/hampi/01.jpg', 'Virupaksha gopuram at sunrise',   K.actHampi1, 0],
      [K.photoHampi2, 'trip', K.hampiTrip, EXISTING.ankan, IMG.hampiLake,    'seed/trips/hampi/02.jpg', 'Hemakuta boulders at dusk',       K.actHampi2, 1],
      [K.photoHampi3, 'trip', K.hampiTrip, EXISTING.vansh, IMG.hampiGolden,  'seed/trips/hampi/03.jpg', 'Golden ruins in late light',      null, 2],
      [K.photoHampi4, 'trip', K.hampiTrip, K.kabir,        IMG.hampiRiver,   'seed/trips/hampi/04.jpg', 'Tungabhadra coracle crossing',    K.actHampi3, 3],
      // Varanasi (4)
      [K.photoVar1,   'trip', K.varanasiTrip, K.kabir,        IMG.varGhats,  'seed/trips/varanasi/01.jpg', 'Dashashwamedh Ghat aarti',    K.actVar1, 0],
      [K.photoVar2,   'trip', K.varanasiTrip, EXISTING.pooja, IMG.varBoats,  'seed/trips/varanasi/02.jpg', 'Morning row boats on Ganga',  K.actVar2, 1],
      [K.photoVar3,   'trip', K.varanasiTrip, EXISTING.ankan, IMG.varSunset, 'seed/trips/varanasi/03.jpg', 'Ganga sunset from Assi Ghat', null, 2],
      [K.photoVar4,   'trip', K.varanasiTrip, K.kabir,        IMG.varRiver,  'seed/trips/varanasi/04.jpg', 'Dhamek Stupa, Sarnath',       K.actVar3, 3],
      // Events
      [K.photoPhotoMeet1, 'event', K.photoMeetEvent, K.kabir,        IMG.photoCamera, 'seed/events/photomeet/01.jpg', 'Camera setups at the meetup',  null, 0],
      [K.photoPhotoMeet2, 'event', K.photoMeetEvent, EXISTING.vansh, IMG.photoShoot,  'seed/events/photomeet/02.jpg', 'Shooting session in progress', null, 1],
      [K.photoHoliBrunch1,'event', K.holiBrunchEvent, K.kabir,        IMG.holiColors,  'seed/events/holibrunch/01.jpg','Colour powder flying!',       null, 0],
      [K.photoHoliBrunch2,'event', K.holiBrunchEvent, EXISTING.pooja, IMG.holiCrowd,   'seed/events/holibrunch/02.jpg','Group holi chaos 2027',       null, 1],
      [K.photoBday1,      'event', K.bdayEvent,       K.kabir,        IMG.bdayRooftop, 'seed/events/bday/01.jpg',     'Rooftop birthday setup',       null, 0],
      [K.photoBday2,      'event', K.bdayEvent,       EXISTING.ankan, IMG.bdayCrowd,   'seed/events/bday/02.jpg',     'The squad — Kabir Bday',       null, 1],
    ];
    for (const [id, pType, pId, uploadedBy, fileUrl, s3Key, caption, actId, displayOrder] of photos) {
      await client.query(
        `INSERT INTO photos (id, parent_type, parent_id, uploaded_by, file_url, s3_key, caption, mime_type, activity_id, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'image/jpeg',$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [id, pType, pId, uploadedBy, fileUrl, s3Key, caption, actId, displayOrder],
      );
    }

    // ── 9. Docs ───────────────────────────────────────────────────────────────
    console.log('  Docs…');
    await client.query(
      `INSERT INTO docs (id, parent_type, parent_id, uploaded_by, file_name, file_url, s3_key, file_size_bytes, mime_type)
       VALUES ($1,'trip',$2,$3,'Spiti_Itinerary_Sep2026.pdf',
               'https://drive.google.com/file/d/spiti-itinerary-kabir-2026/view',
               'seed/trips/spiti/docs/itinerary.pdf', 245760, 'application/pdf')
       ON CONFLICT (id) DO NOTHING`,
      [K.docSpiti, K.spitiTrip, K.kabir],
    );
    await client.query(
      `INSERT INTO docs (id, parent_type, parent_id, uploaded_by, file_name, file_url, s3_key, file_size_bytes, mime_type)
       VALUES ($1,'trip',$2,$3,'Varanasi_BookingConfirmations.pdf',
               'https://drive.google.com/file/d/varanasi-bookings-kabir-2026/view',
               'seed/trips/varanasi/docs/bookings.pdf', 183296, 'application/pdf')
       ON CONFLICT (id) DO NOTHING`,
      [K.docVar, K.varanasiTrip, K.kabir],
    );

    // ── 10. Notes ─────────────────────────────────────────────────────────────
    console.log('  Notes…');
    const notes = [
      [K.noteSpiti1, 'trip', K.spitiTrip, K.kabir,
       'Packing for Spiti',
       'Thermals (2 sets), windproof jacket, balaclava, UV sunglasses (altitude UV is brutal), trekking poles, high-altitude sleeping bag (-10C rated), waterproof boots. Carry Diamox if altitude sickness prone — consult doctor before. Power bank x2 (cold kills battery).',
       'todo'],
      [K.noteSpiti2, 'trip', K.spitiTrip, EXISTING.pooja,
       'Food & Stays',
       'Kaza: Sakya Abode homestay (confirmed, breakfast included). Food: Himalayan Cafe (local thukpa + momos), Sichuan Kitchen (surprisingly good noodles). No alcohol above 3500m until day 3. Chandratal camp has a cook who does dal-rice — bring snacks for the long drives.',
       'general'],
      [K.noteHampi1, 'trip', K.hampiTrip, K.kabir,
       'Hampi Golden Hours',
       'Sunrise shot spots: Hemakuta Hill (SW face), Matanga Hill (best 360 view — 30min climb). Sunset: Virupaksha temple reflection pool or Sule Bazaar ruins. Best light: 6–7:30AM and 5:30–6:30PM. Pack a 16–35mm if you have it.',
       'important'],
      [K.noteHampi2, 'trip', K.hampiTrip, EXISTING.ankan,
       'Getting Around & Eat',
       'Scooters from guesthouse Rs 300/day — best way. Royal Enfield rentals also available Rs 600/day. Food: Mango Tree (must) for lunch by the river, Laughing Buddha (great thali), Chill Out (rooftop views + pasta). Cash only in most places — ATM in Hampi Bazaar.',
       'general'],
      [K.noteVar1, 'trip', K.varanasiTrip, K.kabir,
       'Ghat Guide',
       'Dashashwamedh: main aarti ghat — arrive 5:30PM, aarti starts 6PM. Assi Ghat: sunrise boat starting point, more local. Manikarnika: cremation ghat — photography strictly prohibited, respectful observation only. Don\'t accept "free" tour guides — they will ask for donations.',
       'important'],
      [K.noteVar2, 'trip', K.varanasiTrip, EXISTING.pooja,
       'Varanasi Food Hits',
       'MUST: Kashi Chat Bhandar (tamatar chaat, 70yr old shop), Blue Lassi Shop (Lane 2 — best lassi in India, cash only). Breakfast: Vishwanath Gali chaat. Evening: malaiyo from street carts (only in winter mornings — we are lucky!). Avoid restaurant food near ghats — overpriced.',
       'general'],
      [K.notePhotoMeet, 'event', K.photoMeetEvent, K.kabir,
       'Meet Run of Show',
       '5PM gear showcase (everyone brings one lens to swap). 6PM golden hour shoot at Bandra Fort (walk together). 8PM dinner at Jimmy Boy. Share unedited RAWs in group drive same night. Theme: street portraiture.',
       'todo'],
      [K.noteBday, 'event', K.bdayEvent, EXISTING.ankan,
       'Kabir Bday Plan',
       'Rooftop: Aer Bar, Four Seasons Worli — reservation confirmed for 12 (Ankan\'s card on file). Arrival: 8PM. Cake from Theobroma (dark chocolate mousse — Kabir\'s fav). Gift pool contribution Rs 1000/person — Venmo @ankan_nandi. Dress code: all black.',
       'important'],
    ];
    for (const [id, pType, pId, createdBy, title, content, cat] of notes) {
      await client.query(
        `INSERT INTO notes (id, parent_type, parent_id, created_by, title, content, category)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [id, pType, pId, createdBy, title, content, cat],
      );
    }

    // Note favorites
    const noteFavs = [
      [K.noteSpiti1, K.kabir], [K.noteSpiti1, EXISTING.ankan], [K.noteSpiti1, EXISTING.pooja],
      [K.noteHampi1, K.kabir], [K.noteHampi1, EXISTING.vansh],
      [K.noteVar1, K.kabir], [K.noteVar1, EXISTING.pooja],
      [K.noteBday, EXISTING.ankan], [K.noteBday, EXISTING.pooja],
    ];
    for (const [noteId, userId] of noteFavs) {
      await client.query(
        `INSERT INTO note_favorites (note_id, user_id) VALUES ($1,$2)
         ON CONFLICT (note_id, user_id) DO NOTHING`,
        [noteId, userId],
      );
    }

    // ── 11. Polls ─────────────────────────────────────────────────────────────
    console.log('  Polls…');
    const addPoll = async (pollId, pType, pId, createdBy, question, options, votes) => {
      await client.query(
        `INSERT INTO polls (id, parent_type, parent_id, created_by, question)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [pollId, pType, pId, createdBy, question],
      );
      const placeholders = options.map((_, i) => `($1, $${i + 2}, ${i + 1})`).join(', ');
      const result = await client.query(
        `INSERT INTO poll_options (poll_id, option_text, display_order)
         VALUES ${placeholders} ON CONFLICT DO NOTHING RETURNING id, option_text`,
        [pollId, ...options],
      );
      for (const [optText, voterIds] of votes) {
        const opt = result.rows.find((r) => r.option_text === optText);
        if (opt) {
          for (const uid of voterIds) {
            await client.query(
              `INSERT INTO poll_votes (poll_id, option_id, user_id)
               VALUES ($1,$2,$3) ON CONFLICT (poll_id, user_id) DO NOTHING`,
              [pollId, opt.id, uid],
            );
          }
        }
      }
    };

    await addPoll(K.pollSpiti1, 'trip', K.spitiTrip, K.kabir,
      'Route in — how do we get to Kaza?',
      ['Fly to Kullu, SUV via Rohtang', 'Overnight bus Manali → Kaza', 'Drive from Delhi (2 days)'],
      [['Fly to Kullu, SUV via Rohtang', [K.kabir, EXISTING.pooja]], ['Overnight bus Manali → Kaza', [EXISTING.ankan, EXISTING.vansh]]],
    );

    await addPoll(K.pollSpiti2, 'trip', K.spitiTrip, EXISTING.ankan,
      'Add-on: Pin valley or Chandratal?',
      ['Pin Valley wildlife trek', 'Chandratal Lake overnight', 'Both if time allows'],
      [['Chandratal Lake overnight', [K.kabir, EXISTING.ankan, EXISTING.pooja]], ['Both if time allows', [EXISTING.vansh]]],
    );

    await addPoll(K.pollHampi1, 'trip', K.hampiTrip, K.kabir,
      'Day 3 plan — Anegundi or Pattadakal?',
      ['Anegundi village (across river)', 'Pattadakal & Aihole day trip', 'Chill day — Mango Tree & swim'],
      [['Anegundi village (across river)', [K.kabir, EXISTING.vansh]], ['Chill day — Mango Tree & swim', [EXISTING.ankan]]],
    );

    await addPoll(K.pollVar1, 'trip', K.varanasiTrip, K.kabir,
      'Would you revisit Varanasi?',
      ['Yes — during Kartik Purnima festival', 'Yes — winter morning fog season', 'Next is Rishikesh'],
      [['Yes — winter morning fog season', [K.kabir, EXISTING.pooja, EXISTING.ankan]]],
    );

    await addPoll(K.pollPhotoMeet, 'event', K.photoMeetEvent, K.kabir,
      'Next Photography Meet theme?',
      ['Monsoon streets of Mumbai', 'Architecture & symmetry', 'Portraits — strangers only'],
      [['Monsoon streets of Mumbai', [K.kabir, EXISTING.vansh]], ['Portraits — strangers only', [EXISTING.ankan, EXISTING.pooja]]],
    );

    await addPoll(K.pollBday, 'event', K.bdayEvent, EXISTING.ankan,
      'After Aer — where next?',
      ['Anti Social, Lower Parel', 'Rooftop at Pooja\'s place', 'Call it — it\'s a weeknight'],
      [['Anti Social, Lower Parel', [EXISTING.ankan, EXISTING.vansh]], ["Rooftop at Pooja's place", [EXISTING.pooja]], ["Call it — it's a weeknight", [K.kabir, EXISTING.alice]]],
    );

    // ── 12. Events ────────────────────────────────────────────────────────────
    console.log('  Events…');

    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'Photography Meet','2026-07-26','Networking',
               'Monthly street photography meetup — golden hour shoot at Bandra Fort, gear swap, and dinner. Theme: street portraiture. All skill levels welcome. Bring your best one lens.',
               'Bandra Fort, Mumbai', 19.0479, 72.8188, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [K.photoMeetEvent, K.kabir, IMG.photoCamera],
    );

    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'Holi Brunch 2027','2027-03-18','Festival',
               'Organic colours, water guns, and a proper South Indian brunch after. Garden party vibes — wear white. BYO good energy. No glass bottles near the pool.',
               'Powai, Mumbai', 19.1176, 72.9060, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [K.holiBrunchEvent, K.kabir, IMG.holiColors],
    );

    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'Kabir Bday Bash','2026-07-14','Party',
               'Kabir turns 29 — rooftop at Aer Bar, Four Seasons Worli. All-black dress code. Cake, drinks, and very questionable karaoke. Entry by invite only.',
               'Worli, Mumbai', 18.9983, 72.8182, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [K.bdayEvent, K.kabir, IMG.bdayRooftop],
    );

    // Event locations
    for (const [eventId, name, lat, lng] of [
      [K.photoMeetEvent, 'Bandra Fort, Mumbai', 19.0479, 72.8188],
      [K.holiBrunchEvent,'Powai, Mumbai',        19.1176, 72.9060],
      [K.bdayEvent,      'Worli, Mumbai',        18.9983, 72.8182],
    ]) {
      await client.query(
        `INSERT INTO event_locations (event_id, name, lat, lng, sort_order)
         SELECT $1,$2,$3,$4,0 WHERE NOT EXISTS
           (SELECT 1 FROM event_locations WHERE event_id=$1 AND sort_order=0)`,
        [eventId, name, lat, lng],
      );
    }

    // Event members
    const eventMembers = [
      [K.photoMeetEvent, K.kabir,        'admin'],
      [K.photoMeetEvent, EXISTING.vansh, 'member'],
      [K.photoMeetEvent, EXISTING.ankan, 'member'],
      [K.photoMeetEvent, EXISTING.pooja, 'member'],
      [K.holiBrunchEvent,K.kabir,        'admin'],
      [K.holiBrunchEvent,EXISTING.pooja, 'member'],
      [K.holiBrunchEvent,EXISTING.vansh, 'member'],
      [K.holiBrunchEvent,EXISTING.ankan, 'member'],
      [K.bdayEvent,      K.kabir,        'admin'],
      [K.bdayEvent,      EXISTING.ankan, 'member'],
      [K.bdayEvent,      EXISTING.pooja, 'member'],
      [K.bdayEvent,      EXISTING.vansh, 'member'],
      [K.bdayEvent,      EXISTING.alice, 'member'],
    ];
    for (const [eventId, userId, role] of eventMembers) {
      await client.query(
        `INSERT INTO event_members (event_id, user_id, role) VALUES ($1,$2,$3)
         ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [eventId, userId, role],
      );
    }

    // Event expenses
    await addExp(K.expPhotoMeet, 'event', K.photoMeetEvent, 'Dinner at Jimmy Boy (group)', 6400, 'food', K.kabir, 'equal');
    for (const uid of [K.kabir, EXISTING.vansh, EXISTING.ankan, EXISTING.pooja]) await addSplit(K.expPhotoMeet, uid, 1600);

    await addExp(K.expHoliBrunch, 'event', K.holiBrunchEvent, 'Organic colours + brunch catering', 9600, 'food', K.kabir, 'equal');
    for (const uid of [K.kabir, EXISTING.pooja, EXISTING.vansh, EXISTING.ankan]) await addSplit(K.expHoliBrunch, uid, 2400);

    await addExp(K.expBday, 'event', K.bdayEvent, 'Aer Bar — tab + cake', 18000, 'entertainment', EXISTING.ankan, 'equal');
    for (const uid of [K.kabir, EXISTING.ankan, EXISTING.pooja, EXISTING.vansh, EXISTING.alice]) await addSplit(K.expBday, uid, 3600);

    // Event reminders
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES
       ($1,'event_start','2026-07-26T11:30:00Z'), ($1,'1_day_before','2026-07-25T11:30:00Z')
       ON CONFLICT DO NOTHING`,
      [K.photoMeetEvent],
    );
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES
       ($1,'event_start','2027-03-18T04:30:00Z'), ($1,'1_day_before','2027-03-17T04:30:00Z')
       ON CONFLICT DO NOTHING`,
      [K.holiBrunchEvent],
    );
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES
       ($1,'event_start','2026-07-14T14:30:00Z'), ($1,'1_day_before','2026-07-13T14:30:00Z')
       ON CONFLICT DO NOTHING`,
      [K.bdayEvent],
    );

    // Trip reminders
    await client.query(
      `INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at) VALUES
       ($1,'trip_start','2026-09-10T03:30:00Z'),
       ($1,'1_day_before','2026-09-09T03:30:00Z'),
       ($1,'1_week_before','2026-09-03T03:30:00Z')`,
      [K.spitiTrip],
    );
    await client.query(
      `INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at) VALUES
       ($1,'trip_start','2026-06-17T03:30:00Z')`,
      [K.hampiTrip],
    );

    // ── 13. Gallery likes ─────────────────────────────────────────────────────
    console.log('  Gallery likes…');
    const likes = [
      ['trip', K.spitiTrip,    EXISTING.ankan],
      ['trip', K.spitiTrip,    EXISTING.pooja],
      ['trip', K.spitiTrip,    EXISTING.vansh],
      ['trip', K.hampiTrip,    EXISTING.ankan],
      ['trip', K.hampiTrip,    EXISTING.vansh],
      ['trip', K.varanasiTrip, EXISTING.pooja],
      ['trip', K.varanasiTrip, EXISTING.ankan],
      ['trip', K.varanasiTrip, EXISTING.alice],
      ['event',K.photoMeetEvent, EXISTING.vansh],
      ['event',K.photoMeetEvent, EXISTING.ankan],
      ['event',K.bdayEvent,      EXISTING.ankan],
      ['event',K.bdayEvent,      EXISTING.pooja],
      ['event',K.bdayEvent,      EXISTING.alice],
    ];
    for (const [pType, pId, userId] of likes) {
      await client.query(
        `INSERT INTO gallery_item_likes (parent_type, parent_id, user_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [pType, pId, userId],
      );
    }

    // ── 14. Gallery comments ──────────────────────────────────────────────────
    console.log('  Gallery comments…');
    const comments = [
      ['trip', K.spitiTrip,    EXISTING.ankan, 'Stunning views! 🏔'],
      ['trip', K.spitiTrip,    EXISTING.pooja, 'Can\'t wait!! 🔥'],
      ['trip', K.spitiTrip,    EXISTING.vansh, 'Goals for Sept 🙌'],
      ['trip', K.hampiTrip,    EXISTING.ankan, 'Omg the ruins!! 😍'],
      ['trip', K.hampiTrip,    EXISTING.vansh, 'Tag me next time!'],
      ['trip', K.varanasiTrip, EXISTING.pooja, 'Miss this trip 💙'],
      ['trip', K.varanasiTrip, EXISTING.ankan, 'Best trip ever! 🌟'],
      ['trip', K.varanasiTrip, EXISTING.alice, 'This looks amazing!'],
      ['event',K.bdayEvent,    EXISTING.ankan, 'Happy bday Kabir!! 🎂'],
      ['event',K.bdayEvent,    EXISTING.pooja, 'Best night ever 🥳'],
      ['event',K.bdayEvent,    EXISTING.alice, 'So much fun!! 🎉'],
      ['event',K.photoMeetEvent,EXISTING.vansh,'When is the next one'],
    ];
    for (const [pType, pId, userId, text] of comments) {
      await client.query(
        `INSERT INTO gallery_item_comments (parent_type, parent_id, user_id, text)
         VALUES ($1,$2,$3,$4)`,
        [pType, pId, userId, text],
      );
    }

    await client.query('COMMIT');

    console.log('\n✅  Kabir seed complete!\n');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  LOGIN   kabir@gatherrgo.com   GatherrGo123!   @kabir_gg');
    console.log(`  UUID    ${K.kabir}`);
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  TRIPS');
    console.log(`  UPCOMING  Spiti Valley Trek   ${K.spitiTrip}`);
    console.log(`  ONGOING   Hampi Ruins Wknd    ${K.hampiTrip}`);
    console.log(`  PAST      Varanasi Ganga       ${K.varanasiTrip}`);
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  EVENTS');
    console.log(`  UPCOMING  Photography Meet    ${K.photoMeetEvent}`);
    console.log(`  UPCOMING  Holi Brunch 2027    ${K.holiBrunchEvent}`);
    console.log(`  PAST      Kabir Bday Bash     ${K.bdayEvent}`);
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  Friends: ankan ✓  pooja ✓  vansh ✓  alice ✓');
    console.log('══════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Kabir seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
