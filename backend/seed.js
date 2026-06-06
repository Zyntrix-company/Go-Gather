/**
 * GatherGo — Comprehensive Seed Script v2
 *
 * TWO PRIMARY USERS you can log in with simultaneously:
 *   alice  test@gathergo.com   +919876543210  @alice_gg  (Primary 1)
 *   bob    bob@gathergo.com    +919876543211  @bob_gg    (Primary 2)
 *
 * Alpha testers (password GatherrGo123!): vansh, ankan, pooja — mutual friends + linked to alice
 *
 * Supporting cast: charlie, diana, eve, frank, grace, henry
 *
 * TRIPS (10 total) — trip names kept ≤18 chars for mobile list cards (no … on most screens):
 *   alice admin:
 *     UPCOMING  — "Goa Trip 2027"           alice + bob + charlie + eve
 *     ONGOING   — "Manali Winter 2026"      alice + charlie + frank
 *     PAST      — "Kerala Backwaters"       alice + bob + diana
 *     ARCHIVED  — "Kasol Trek 2025"         alice + bob
 *   bob admin:
 *     UPCOMING  — "Udaipur Royal Wknd"      bob + alice + grace + henry
 *     PAST      — "Jaipur Heritage"         bob + charlie + frank
 *
 * EVENTS (6 total) — same ≤18 char guideline for event names:
 *   UPCOMING  — "Diwali Night 2026"   alice admin, bob + charlie + eve
 *   PAST      — "Holi 2024"           alice admin, charlie + diana
 *   UPCOMING  — "NYE Party 2026"      bob admin, alice + grace + henry
 *   UPCOMING  — "Pune Tech Meet May"  bob admin, alice + frank + henry
 *
 * Each trip/event: 4–5 photos, 3–5 activities, 2–3 expenses, 2 polls, 2–3 notes
 * Alice/bob/supporting passwords: TestPass123!
 * Alpha trio passwords: GatherrGo123!
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const { normalizeAuthEmail } = require('./src/utils/email.util');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
  host:     process.env.AWS_RDS_HOST,
  port:     parseInt(process.env.AWS_RDS_PORT, 10) || 5432,
  database: process.env.AWS_RDS_DB,
  user:     process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl:      { rejectUnauthorized: false },
});

// ── Fixed UUIDs ───────────────────────────────────────────────────────────────
const IDS = {
  // Users
  alice:   'a0000000-0000-4000-8000-000000000001',  // PRIMARY 1
  bob:     'a0000000-0000-4000-8000-000000000002',  // PRIMARY 2
  charlie: 'a0000000-0000-4000-8000-000000000003',
  diana:   'a0000000-0000-4000-8000-000000000004',
  eve:     'a0000000-0000-4000-8000-000000000005',
  frank:   'a0000000-0000-4000-8000-000000000006',
  grace:   'a0000000-0000-4000-8000-000000000007',
  henry:   'a0000000-0000-4000-8000-000000000008',
  vansh:   'a0000000-0000-4000-8000-000000000009',
  ankan:   'a0000000-0000-4000-8000-00000000000a',
  pooja:   'a0000000-0000-4000-8000-00000000000b',
  riya:    'a0000000-0000-4000-8000-00000000000c',
  arjun:   'a0000000-0000-4000-8000-00000000000d',
  neha:    'a0000000-0000-4000-8000-00000000000e',

  // Trips
  goaTrip:     'b0000000-0000-4000-8000-000000000001',  // alice admin, UPCOMING
  manaliTrip:  'b0000000-0000-4000-8000-000000000002',  // alice admin, ONGOING
  keralaTrip:  'b0000000-0000-4000-8000-000000000003',  // alice admin, PAST
  kasolTrip:   'b0000000-0000-4000-8000-000000000004',  // alice admin, ARCHIVED
  udaipurTrip: 'b0000000-0000-4000-8000-000000000005',  // bob admin, UPCOMING
  jaipurTrip:  'b0000000-0000-4000-8000-000000000006',  // bob admin, PAST
  ladakhTrip:    'b0000000-0000-4000-8000-000000000007',  // vansh admin, UPCOMING (alpha)
  rishikeshTrip: 'b0000000-0000-4000-8000-000000000008',  // ankan admin, PAST (alpha)
  mumbaiTrip:    'b0000000-0000-4000-8000-000000000009',  // pooja admin, ONGOING (alpha)
  coorgTrip:     'b0000000-0000-4000-8000-00000000000a',  // vansh admin, UPCOMING (alpha)

  // Activities — Goa
  actGoa1: 'e0000000-0000-4000-8000-000000000001',
  actGoa2: 'e0000000-0000-4000-8000-000000000002',
  actGoa3: 'e0000000-0000-4000-8000-000000000003',
  actGoa4: 'e0000000-0000-4000-8000-000000000004',
  actGoa5: 'e0000000-0000-4000-8000-000000000005',
  // Activities — Manali
  actManali1: 'e0000000-0000-4000-8000-000000000011',
  actManali2: 'e0000000-0000-4000-8000-000000000012',
  actManali3: 'e0000000-0000-4000-8000-000000000013',
  actManali4: 'e0000000-0000-4000-8000-000000000014',
  // Activities — Kerala
  actKerala1: 'e0000000-0000-4000-8000-000000000021',
  actKerala2: 'e0000000-0000-4000-8000-000000000022',
  actKerala3: 'e0000000-0000-4000-8000-000000000023',
  // Activities — Kasol
  actKasol1: 'e0000000-0000-4000-8000-000000000031',
  actKasol2: 'e0000000-0000-4000-8000-000000000032',
  // Activities — Udaipur
  actUdaipur1: 'e0000000-0000-4000-8000-000000000041',
  actUdaipur2: 'e0000000-0000-4000-8000-000000000042',
  actUdaipur3: 'e0000000-0000-4000-8000-000000000043',
  actUdaipur4: 'e0000000-0000-4000-8000-000000000044',
  // Activities — Jaipur
  actJaipur1: 'e0000000-0000-4000-8000-000000000051',
  actJaipur2: 'e0000000-0000-4000-8000-000000000052',
  actJaipur3: 'e0000000-0000-4000-8000-000000000053',
  // Activities — Ladakh (alpha)
  actLadakh1: 'e0000000-0000-4000-8000-000000000061',
  actLadakh2: 'e0000000-0000-4000-8000-000000000062',
  actLadakh3: 'e0000000-0000-4000-8000-000000000063',
  actLadakh4: 'e0000000-0000-4000-8000-000000000064',
  // Activities — Rishikesh (alpha)
  actRishi1: 'e0000000-0000-4000-8000-000000000065',
  actRishi2: 'e0000000-0000-4000-8000-000000000066',
  actRishi3: 'e0000000-0000-4000-8000-000000000067',
  // Activities — Mumbai (alpha)
  actMumbai1: 'e0000000-0000-4000-8000-000000000068',
  actMumbai2: 'e0000000-0000-4000-8000-000000000069',
  actMumbai3: 'e0000000-0000-4000-8000-00000000006a',
  actMumbai4: 'e0000000-0000-4000-8000-00000000006b',
  // Activities — Coorg (alpha)
  actCoorg1: 'e0000000-0000-4000-8000-00000000006c',
  actCoorg2: 'e0000000-0000-4000-8000-00000000006d',
  actCoorg3: 'e0000000-0000-4000-8000-00000000006e',

  // Expenses — Goa
  expGoa1: 'c0000000-0000-4000-8000-000000000001',
  expGoa2: 'c0000000-0000-4000-8000-000000000002',
  expGoa3: 'c0000000-0000-4000-8000-000000000003',
  // Expenses — Manali
  expManali1: 'c0000000-0000-4000-8000-000000000011',
  expManali2: 'c0000000-0000-4000-8000-000000000012',
  // Expenses — Kerala
  expKerala1: 'c0000000-0000-4000-8000-000000000021',
  expKerala2: 'c0000000-0000-4000-8000-000000000022',
  // Expenses — Kasol
  expKasol1: 'c0000000-0000-4000-8000-000000000031',
  // Expenses — Udaipur
  expUdaipur1: 'c0000000-0000-4000-8000-000000000041',
  expUdaipur2: 'c0000000-0000-4000-8000-000000000042',
  expUdaipur3: 'c0000000-0000-4000-8000-000000000043',
  // Expenses — Jaipur
  expJaipur1: 'c0000000-0000-4000-8000-000000000051',
  expJaipur2: 'c0000000-0000-4000-8000-000000000052',
  // Expenses — Events
  expDiwali1: 'c0000000-0000-4000-8000-000000000061',
  expDiwali2: 'c0000000-0000-4000-8000-000000000062',
  expNYE1:    'c0000000-0000-4000-8000-000000000071',
  // Expenses — Alpha trips / events
  expLadakh1: 'c0000000-0000-4000-8000-000000000081',
  expLadakh2: 'c0000000-0000-4000-8000-000000000082',
  expRishi1:  'c0000000-0000-4000-8000-000000000083',
  expRishi2:  'c0000000-0000-4000-8000-000000000084',
  expMumbai1: 'c0000000-0000-4000-8000-000000000085',
  expMumbai2: 'c0000000-0000-4000-8000-000000000086',
  expCoorg1:  'c0000000-0000-4000-8000-000000000087',
  expCoorg2:  'c0000000-0000-4000-8000-000000000088',
  expAlpha1:  'c0000000-0000-4000-8000-000000000089',
  expBoard1:  'c0000000-0000-4000-8000-00000000008a',

  // Photos — Goa (5)
  photoGoa1: 'a5000000-0000-4000-8000-000000000001',
  photoGoa2: 'a5000000-0000-4000-8000-000000000002',
  photoGoa3: 'a5000000-0000-4000-8000-000000000003',
  photoGoa4: 'a5000000-0000-4000-8000-000000000004',
  photoGoa5: 'a5000000-0000-4000-8000-000000000005',
  // Photos — Manali (5)
  photoManali1: 'a5000000-0000-4000-8000-000000000011',
  photoManali2: 'a5000000-0000-4000-8000-000000000012',
  photoManali3: 'a5000000-0000-4000-8000-000000000013',
  photoManali4: 'a5000000-0000-4000-8000-000000000014',
  photoManali5: 'a5000000-0000-4000-8000-000000000015',
  // Photos — Kerala (5)
  photoKerala1: 'a5000000-0000-4000-8000-000000000021',
  photoKerala2: 'a5000000-0000-4000-8000-000000000022',
  photoKerala3: 'a5000000-0000-4000-8000-000000000023',
  photoKerala4: 'a5000000-0000-4000-8000-000000000024',
  photoKerala5: 'a5000000-0000-4000-8000-000000000025',
  // Photos — Kasol (4)
  photoKasol1: 'a5000000-0000-4000-8000-000000000031',
  photoKasol2: 'a5000000-0000-4000-8000-000000000032',
  photoKasol3: 'a5000000-0000-4000-8000-000000000033',
  photoKasol4: 'a5000000-0000-4000-8000-000000000034',
  // Photos — Udaipur (5)
  photoUdaipur1: 'a5000000-0000-4000-8000-000000000041',
  photoUdaipur2: 'a5000000-0000-4000-8000-000000000042',
  photoUdaipur3: 'a5000000-0000-4000-8000-000000000043',
  photoUdaipur4: 'a5000000-0000-4000-8000-000000000044',
  photoUdaipur5: 'a5000000-0000-4000-8000-000000000045',
  // Photos — Jaipur (5)
  photoJaipur1: 'a5000000-0000-4000-8000-000000000051',
  photoJaipur2: 'a5000000-0000-4000-8000-000000000052',
  photoJaipur3: 'a5000000-0000-4000-8000-000000000053',
  photoJaipur4: 'a5000000-0000-4000-8000-000000000054',
  photoJaipur5: 'a5000000-0000-4000-8000-000000000055',
  // Photos — Events
  photoDiwali1: 'a5000000-0000-4000-8000-000000000061',
  photoDiwali2: 'a5000000-0000-4000-8000-000000000062',
  photoDiwali3: 'a5000000-0000-4000-8000-000000000063',
  photoHoli1:   'a5000000-0000-4000-8000-000000000064',
  photoHoli2:   'a5000000-0000-4000-8000-000000000065',
  photoNYE1:    'a5000000-0000-4000-8000-000000000066',
  photoNYE2:    'a5000000-0000-4000-8000-000000000067',
  photoNYE3:    'a5000000-0000-4000-8000-000000000068',
  photoMeetup1: 'a5000000-0000-4000-8000-000000000069',
  photoMeetup2: 'a5000000-0000-4000-8000-00000000006a',
  // Photos — Ladakh (5)
  photoLadakh1: 'a5000000-0000-4000-8000-00000000006b',
  photoLadakh2: 'a5000000-0000-4000-8000-00000000006c',
  photoLadakh3: 'a5000000-0000-4000-8000-00000000006d',
  photoLadakh4: 'a5000000-0000-4000-8000-00000000006e',
  photoLadakh5: 'a5000000-0000-4000-8000-00000000006f',
  // Photos — Rishikesh (4)
  photoRishi1: 'a5000000-0000-4000-8000-000000000070',
  photoRishi2: 'a5000000-0000-4000-8000-000000000071',
  photoRishi3: 'a5000000-0000-4000-8000-000000000072',
  photoRishi4: 'a5000000-0000-4000-8000-000000000073',
  // Photos — Mumbai (5)
  photoMumbai1: 'a5000000-0000-4000-8000-000000000074',
  photoMumbai2: 'a5000000-0000-4000-8000-000000000075',
  photoMumbai3: 'a5000000-0000-4000-8000-000000000076',
  photoMumbai4: 'a5000000-0000-4000-8000-000000000077',
  photoMumbai5: 'a5000000-0000-4000-8000-000000000078',
  // Photos — Coorg (5)
  photoCoorg1: 'a5000000-0000-4000-8000-000000000079',
  photoCoorg2: 'a5000000-0000-4000-8000-00000000007a',
  photoCoorg3: 'a5000000-0000-4000-8000-00000000007b',
  photoCoorg4: 'a5000000-0000-4000-8000-00000000007c',
  photoCoorg5: 'a5000000-0000-4000-8000-00000000007d',
  // Photos — Alpha events
  photoAlpha1: 'a5000000-0000-4000-8000-00000000007e',
  photoAlpha2: 'a5000000-0000-4000-8000-00000000007f',
  photoAlpha3: 'a5000000-0000-4000-8000-000000000080',
  photoAlpha4: 'a5000000-0000-4000-8000-000000000081',
  photoBoard1: 'a5000000-0000-4000-8000-000000000082',
  photoBoard2: 'a5000000-0000-4000-8000-000000000083',
  photoBoard3: 'a5000000-0000-4000-8000-000000000084',

  // Polls
  pollGoa1:     'd0000000-0000-4000-8000-000000000001',
  pollGoa2:     'd0000000-0000-4000-8000-000000000002',
  pollManali1:  'd0000000-0000-4000-8000-000000000003',
  pollKerala1:  'd0000000-0000-4000-8000-000000000004',
  pollUdaipur1: 'd0000000-0000-4000-8000-000000000005',
  pollUdaipur2: 'd0000000-0000-4000-8000-000000000006',
  pollJaipur1:  'd0000000-0000-4000-8000-000000000007',
  pollDiwali1:  'd0000000-0000-4000-8000-000000000008',
  pollNYE1:     'd0000000-0000-4000-8000-000000000009',
  pollLadakh1:  'd0000000-0000-4000-8000-00000000000a',
  pollRishi1:   'd0000000-0000-4000-8000-00000000000b',
  pollMumbai1:  'd0000000-0000-4000-8000-00000000000c',
  pollCoorg1:   'd0000000-0000-4000-8000-00000000000d',
  pollAlpha1:   'd0000000-0000-4000-8000-00000000000e',

  // Notes
  noteGoa1:     'ac000000-0000-4000-8000-000000000001',
  noteGoa2:     'ac000000-0000-4000-8000-000000000002',
  noteGoa3:     'ac000000-0000-4000-8000-000000000003',
  noteManali1:  'ac000000-0000-4000-8000-000000000004',
  noteManali2:  'ac000000-0000-4000-8000-000000000005',
  noteKerala1:  'ac000000-0000-4000-8000-000000000006',
  noteKerala2:  'ac000000-0000-4000-8000-000000000007',
  noteKasol1:   'ac000000-0000-4000-8000-000000000008',
  noteUdaipur1: 'ac000000-0000-4000-8000-000000000009',
  noteUdaipur2: 'ac000000-0000-4000-8000-00000000000a',
  noteUdaipur3: 'ac000000-0000-4000-8000-00000000000b',
  noteJaipur1:  'ac000000-0000-4000-8000-00000000000c',
  noteJaipur2:  'ac000000-0000-4000-8000-00000000000d',
  noteDiwali1:  'ac000000-0000-4000-8000-00000000000e',
  noteNYE1:     'ac000000-0000-4000-8000-00000000000f',
  noteLadakh1:  'ac000000-0000-4000-8000-000000000010',
  noteLadakh2:  'ac000000-0000-4000-8000-000000000011',
  noteRishi1:   'ac000000-0000-4000-8000-000000000012',
  noteMumbai1:  'ac000000-0000-4000-8000-000000000013',
  noteMumbai2:  'ac000000-0000-4000-8000-000000000014',
  noteCoorg1:   'ac000000-0000-4000-8000-000000000015',
  noteAlpha1:   'ac000000-0000-4000-8000-000000000016',

  // Events
  diwaliEvent:  'e1000000-0000-4000-8000-000000000001',
  holiEvent:    'e1000000-0000-4000-8000-000000000002',
  nyeEvent:     'e1000000-0000-4000-8000-000000000003',
  meetupEvent:  'e1000000-0000-4000-8000-000000000004',
  alphaEvent:   'e1000000-0000-4000-8000-000000000005',
  boardEvent:   'e1000000-0000-4000-8000-000000000006',

  // Friend connections
  connAliceBob:     'f0000000-0000-4000-8000-000000000001',
  connAliceCharlie: 'f0000000-0000-4000-8000-000000000002',
  connAliceDiana:   'f0000000-0000-4000-8000-000000000003',
  connAliceEve:     'f0000000-0000-4000-8000-000000000004',
  connAliceFrank:   'f0000000-0000-4000-8000-000000000005',
  connGraceAlice:   'f0000000-0000-4000-8000-000000000006',
  connHenryAlice:   'f0000000-0000-4000-8000-000000000007',
  connBobCharlie:   'f0000000-0000-4000-8000-000000000008',
  connBobGrace:     'f0000000-0000-4000-8000-000000000009',
  connBobHenry:     'f0000000-0000-4000-8000-000000000010',
  connBobDiana:     'f0000000-0000-4000-8000-000000000011',
  connBobFrank:     'f0000000-0000-4000-8000-000000000012',
  connCharlieDiana: 'f0000000-0000-4000-8000-000000000013',
  // Alpha trio + alice
  connVanshAnkan:   'f0000000-0000-4000-8000-000000000014',
  connVanshPooja:   'f0000000-0000-4000-8000-000000000015',
  connAnkanPooja:   'f0000000-0000-4000-8000-000000000016',
  connAliceVansh:   'f0000000-0000-4000-8000-000000000017',
  connAliceAnkan:   'f0000000-0000-4000-8000-000000000018',
  connAlicePooja:   'f0000000-0000-4000-8000-000000000019',
  connBobVansh:     'f0000000-0000-4000-8000-00000000001a',
  connBobPooja:     'f0000000-0000-4000-8000-00000000001b',
  // Ankan's new friends
  connAnkanRiya:    'f0000000-0000-4000-8000-00000000001c',
  connAnkanArjun:   'f0000000-0000-4000-8000-00000000001d',
  connAnkanNeha:    'f0000000-0000-4000-8000-00000000001e',
};

const PASSWORD = 'TestPass123!';
const ALPHA_PASSWORD = 'GatherrGo123!';

const ALPHA_USER_IDS = new Set([IDS.vansh, IDS.ankan, IDS.pooja]);

/** Alpha tester avatars — age/gender-matched South Asian headshots (Unsplash License). */
const ALPHA_AVATAR = {
  /** ~24, Indian male — casual smile, outdoor. */
  vansh:
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&h=800&q=80',
  /** ~32, Indian male — professional headshot. */
  ankan:
    'https://images.unsplash.com/photo-1560250093-0fd85637ac61?auto=format&fit=crop&w=800&h=800&q=80',
  /** ~21, Indian female — warm portrait. */
  pooja:
    'https://images.unsplash.com/photo-1655249493799-9fae13cbf526?auto=format&fit=crop&w=800&h=800&q=80',
};

/** Trip/event titles on UnifiedCard (~360dp + 2 avatars + menu): keep ≤ this length to avoid … on most phones. */
const CARD_LIST_NAME_MAX_LEN = 18;

function assertListCardTitleLen(label, name) {
  if (name.length > CARD_LIST_NAME_MAX_LEN) {
    throw new Error(
      `[seed] ${label} exceeds CARD_LIST_NAME_MAX_LEN (${CARD_LIST_NAME_MAX_LEN}): "${name}" (${name.length} chars)`,
    );
  }
}

// ── Photo URL constants ───────────────────────────────────────────────────────
const PH = {
  goaBaga:      'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1600&q=80',
  goaPool:      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80',
  goaBoat:      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1600&q=80',
  goaSunset:    'https://images.unsplash.com/photo-1559732277-7453b141e3a1?auto=format&fit=crop&w=1600&q=80',
  goaChurch:    'https://images.unsplash.com/photo-1526711657229-e7e080ed7aa1?auto=format&fit=crop&w=1600&q=80',
  manaliSnow:   'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?auto=format&fit=crop&w=1600&q=80',
  manaliSolang: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1600&q=80',
  manaliPeaks:  'https://images.unsplash.com/photo-1547378291-be04e77e0e0b?auto=format&fit=crop&w=1600&q=80',
  manaliRiver:  'https://images.unsplash.com/photo-1609766934741-d77f51e4da70?auto=format&fit=crop&w=1600&q=80',
  manaliRohtang:'https://images.unsplash.com/photo-1586183189334-c30d9e4b0d6e?auto=format&fit=crop&w=1600&q=80',
  keralaHouse:  'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1600&q=80',
  keralaCanal:  'https://images.unsplash.com/photo-1593693411515-c20261bcad6e?auto=format&fit=crop&w=1600&q=80',
  keralaPalm:   'https://images.unsplash.com/photo-1516543630947-5d423a57e9b6?auto=format&fit=crop&w=1600&q=80',
  keralaKatha:  'https://images.unsplash.com/photo-1545506579-3a72a4e15fde?auto=format&fit=crop&w=1600&q=80',
  keralaBack:   'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1600&q=80',
  kasolTrail:   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
  kasolRiver:   'https://images.unsplash.com/photo-1455156218388-5e61b526818b?auto=format&fit=crop&w=1600&q=80',
  kasolCamp:    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80',
  kasolStars:   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80',
  udaipurPalace:'https://images.pexels.com/photos/3581364/pexels-photo-3581364.jpeg?auto=compress&cs=tinysrgb&w=1600',
  udaipurLake:  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1600&q=80',
  udaipurHaveli:'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&w=1600&q=80',
  udaipurDinner:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80',
  udaipurSunset:'https://images.unsplash.com/photo-1565703819926-5a73ef1a6b1a?auto=format&fit=crop&w=1600&q=80',
  jaipurHawa:   'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1600&q=80',
  jaipurAmber:  'https://images.unsplash.com/photo-1548013146-8673ef918943?auto=format&fit=crop&w=1600&q=80',
  jaipurBalloon:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1600&q=80',
  jaipurBazaar: 'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1600&q=80',
  jaipurCity:   'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1600&q=80',
  diwaliLights: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=1600&q=80',
  diwaliDecor:  'https://images.unsplash.com/photo-1605296867424-35fc25c9212a?auto=format&fit=crop&w=1600&q=80',
  diwaliCrowd:  'https://images.unsplash.com/photo-1574870111867-089730e5a72b?auto=format&fit=crop&w=1600&q=80',
  holiColors:   'https://images.unsplash.com/photo-1580136608263-f526cf971b99?auto=format&fit=crop&w=1600&q=80',
  holiCrowd:    'https://images.unsplash.com/photo-1576153192396-180ecef2a715?auto=format&fit=crop&w=1600&q=80',
  nyeRooftop:   'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=1600',
  nyeMumbai:    'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1600&q=80',
  nyeCrowd:     'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=1600&q=80',
  meetupStage:  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
  meetupCoffee: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1600&q=80',
  ladakhRoad:   'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1600&q=80',
  ladakhBike:   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1600&q=80',
  ladakhPass:   'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1600&q=80',
  ladakhLake:   'https://images.unsplash.com/photo-1590076215667-875017a51731?auto=format&fit=crop&w=1600&q=80',
  rishikeshGhat:'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1600&q=80',
  rishikeshRaft:'https://images.unsplash.com/photo-1530866495567-afb7a318686e?auto=format&fit=crop&w=1600&q=80',
  mumbaiSky:    'https://images.unsplash.com/photo-1566552881560-0be862a7c445?auto=format&fit=crop&w=1600&q=80',
  mumbaiFood:   'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1600&q=80',
  coorgTea:     'https://images.unsplash.com/photo-1597318181409-cf1d2d40f5c4?auto=format&fit=crop&w=1600&q=80',
  coorgHills:   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80',
  alphaRooftop: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
  boardGames:   'https://images.unsplash.com/photo-1611371805429-8efd1ca84a3f?auto=format&fit=crop&w=1600&q=80',
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('\n🌱 GatherGo seed v2 starting…\n');

    // ── 1. Hash passwords ─────────────────────────────────────────────────────
    console.log('  Hashing passwords…');
    const hash = await bcrypt.hash(PASSWORD, 12);
    const alphaHash = await bcrypt.hash(ALPHA_PASSWORD, 12);

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
      [IDS.vansh,   'vanshahuja318@gmail.com',  '+919876543218', 'vansh_gg'],
      [IDS.ankan,   'hello@gatherrgo.com',       '+919876543219', 'ankan_gg'],
      [IDS.pooja,   'poojadevrari07@gmail.com',  '+919876543220', 'pooja_gg'],
      [IDS.riya,    'riya@gathergo.com',         '+919876543221', 'riya_gg'],
      [IDS.arjun,   'arjun@gathergo.com',        '+919876543222', 'arjun_gg'],
      [IDS.neha,    'neha@gathergo.com',         '+919876543223', 'neha_gg'],
    ];
    for (const [id, email, phone, username] of users) {
      const passwordHash = ALPHA_USER_IDS.has(id) ? alphaHash : hash;
      const emailNormalized = normalizeAuthEmail(email);
      await client.query(
        `INSERT INTO users (id, email, email_normalized, phone, password_hash, is_verified, is_profile_complete, username)
         VALUES ($1, $2, $3, $4, $5, true, true, $6)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           email_normalized = EXCLUDED.email_normalized,
           phone = EXCLUDED.phone,
           password_hash = EXCLUDED.password_hash,
           username = EXCLUDED.username`,
        [id, email, emailNormalized, phone, passwordHash, username],
      );
    }

    // ── 3. Profiles ───────────────────────────────────────────────────────────
    console.log('  Seeding profiles…');
    const profiles = [
      [IDS.alice,   'Alice Sharma',   '1998-06-15', 'female', 'India', 'Explorer & foodie | Always chasing sunsets and good chai', null],
      [IDS.bob,     'Bob Mehta',      '1997-03-22', 'male',   'India', 'Mountain lover | Photographer | Building things on weekends', null],
      [IDS.charlie, 'Charlie Verma',  '1999-11-05', 'male',   'India', 'Beach bum | Scuba certified | Road trip enthusiast', null],
      [IDS.diana,   'Diana Kapoor',   '2000-07-18', 'female', 'India', 'Backpacker at heart | 12 states, counting', null],
      [IDS.eve,     'Eve Nair',       '1996-02-14', 'female', 'India', 'Wanderlust forever | Kerala born, world traveller', null],
      [IDS.frank,   'Frank Joshi',    '1995-09-30', 'male',   'India', 'History walks and chai | Heritage lover | Jaipur local', null],
      [IDS.grace,   'Grace Thomas',   '2001-01-08', 'female', 'India', 'Photography and road trips | Golden hour chaser', null],
      [IDS.henry,   'Henry Banerjee', '1997-12-01', 'male',   'India', 'Cyclist and techie | Pune meetup organiser | Coffee snob', null],
      [IDS.vansh,   'Vansh Ahuja',    '2002-04-20', 'male',   'India', 'Alpha tester | Bikes, rooftops, and messy group chats', ALPHA_AVATAR.vansh],
      [IDS.ankan,   'Ankan Nandi',    '1994-02-10', 'male',   'India', 'Alpha tester | River sports, bikes & weekend hikes', ALPHA_AVATAR.ankan],
      [IDS.pooja,   'Pooja Devrari',  '2005-01-18', 'female', 'India', 'Alpha tester | Food trails, board games, city nights', ALPHA_AVATAR.pooja],
      [IDS.riya,    'Riya Mehta',     '1999-07-12', 'female', 'India', 'Solo traveller | Mountains over beaches | Chai enthusiast', 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&h=800&q=80'],
      [IDS.arjun,   'Arjun Singh',    '1996-03-25', 'male',   'India', 'Weekend biker | Wildlife photographer | Himachal is home', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&h=800&q=80'],
      [IDS.neha,    'Neha Joshi',     '2001-11-03', 'female', 'India', 'Bookworm + wanderer | Café hopper | Sunsets and street food', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&h=800&q=80'],
    ];
    for (const [uid, name, dob, gender, country, bio, avatarUrl] of profiles) {
      await client.query(
        `INSERT INTO profiles (user_id, full_name, dob, gender, country, bio, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           dob = EXCLUDED.dob,
           gender = EXCLUDED.gender,
           bio = EXCLUDED.bio,
           avatar_url = EXCLUDED.avatar_url`,
        [uid, name, dob, gender, country, bio, avatarUrl],
      );
    }

    // ── 4. Friend connections ─────────────────────────────────────────────────
    console.log('  Seeding friend connections…');
    const connections = [
      // alice's network
      [IDS.connAliceBob,     IDS.alice,   IDS.bob,     'accepted'],
      [IDS.connAliceCharlie, IDS.alice,   IDS.charlie, 'accepted'],
      [IDS.connAliceDiana,   IDS.alice,   IDS.diana,   'accepted'],
      [IDS.connAliceEve,     IDS.alice,   IDS.eve,     'accepted'],
      [IDS.connAliceFrank,   IDS.alice,   IDS.frank,   'accepted'],
      [IDS.connGraceAlice,   IDS.grace,   IDS.alice,   'accepted'],
      [IDS.connHenryAlice,   IDS.henry,   IDS.alice,   'pending'],  // pending — alice can accept
      // bob's extra network
      [IDS.connBobCharlie,   IDS.bob,     IDS.charlie, 'accepted'],
      [IDS.connBobGrace,     IDS.bob,     IDS.grace,   'accepted'],
      [IDS.connBobHenry,     IDS.bob,     IDS.henry,   'accepted'],
      [IDS.connBobDiana,     IDS.bob,     IDS.diana,   'accepted'],
      [IDS.connBobFrank,     IDS.bob,     IDS.frank,   'accepted'],
      // other
      [IDS.connCharlieDiana, IDS.charlie, IDS.diana,   'accepted'],
      // Alpha trio — all mutual friends
      [IDS.connVanshAnkan,   IDS.vansh,   IDS.ankan,   'accepted'],
      [IDS.connVanshPooja,   IDS.vansh,   IDS.pooja,   'accepted'],
      [IDS.connAnkanPooja,   IDS.ankan,   IDS.pooja,   'accepted'],
      [IDS.connAliceVansh,   IDS.alice,   IDS.vansh,   'accepted'],
      [IDS.connAliceAnkan,   IDS.alice,   IDS.ankan,   'accepted'],
      [IDS.connAlicePooja,   IDS.alice,   IDS.pooja,   'accepted'],
      [IDS.connBobVansh,     IDS.bob,     IDS.vansh,   'accepted'],
      [IDS.connBobPooja,     IDS.bob,     IDS.pooja,   'accepted'],
      // Ankan's new friends
      [IDS.connAnkanRiya,    IDS.ankan,   IDS.riya,    'accepted'],
      [IDS.connAnkanArjun,   IDS.ankan,   IDS.arjun,   'accepted'],
      [IDS.connAnkanNeha,    IDS.ankan,   IDS.neha,    'accepted'],
    ];
    for (const [id, req, addr, status] of connections) {
      await client.query(
        `INSERT INTO friend_connections (id, requester_id, addressee_id, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [id, req, addr, status],
      );
    }

    // ── 5. Friend invite tokens ───────────────────────────────────────────────
    console.log('  Seeding friend invite tokens…');
    await client.query(
      `INSERT INTO friend_invites (id, invited_by, token, expires_at)
       VALUES ('fd000000-0000-4000-8000-000000000001', $1, 'alice-friend-invite-token-001', NOW() + INTERVAL '7 days'),
              ('fd000000-0000-4000-8000-000000000002', $2, 'bob-friend-invite-token-001',   NOW() + INTERVAL '7 days')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.alice, IDS.bob],
    );

    // ── 6. Trips ──────────────────────────────────────────────────────────────
    console.log('  Seeding trips…');

    assertListCardTitleLen('Goa trip', 'Goa Trip 2027');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Goa Trip 2027', '2027-04-10', '2027-04-17',
               'Goa, India', 15.2993249, 74.1239960, $2,
               'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1600&q=80')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.goaTrip, IDS.alice],
    );

    assertListCardTitleLen('Manali trip', 'Manali Winter 2026');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Manali Winter 2026', '2026-01-01', '2026-12-31',
               'Manali, Himachal Pradesh', 32.2396153, 77.1887145, $2,
               'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1600&q=80')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.manaliTrip, IDS.alice],
    );

    assertListCardTitleLen('Kerala trip', 'Kerala Backwaters');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Kerala Backwaters', '2024-03-15', '2024-03-20',
               'Alleppey, Kerala', 9.4980762, 76.3388484, $2,
               'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1600&q=80')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.keralaTrip, IDS.alice],
    );

    assertListCardTitleLen('Kasol trip', 'Kasol Trek 2025');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url, archived_at)
       VALUES ($1, 'Kasol Trek 2025', '2025-09-01', '2025-09-07',
               'Kasol, Himachal Pradesh', 32.0100000, 77.3148000, $2,
               'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
               '2025-10-01T10:00:00Z')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url, archived_at = EXCLUDED.archived_at`,
      [IDS.kasolTrip, IDS.alice],
    );

    assertListCardTitleLen('Udaipur trip', 'Udaipur Royal Wknd');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Udaipur Royal Wknd', '2026-12-05', '2026-12-08',
               'Udaipur, Rajasthan', 24.5854452, 73.7124790, $2,
               'https://images.pexels.com/photos/3581364/pexels-photo-3581364.jpeg?auto=compress&cs=tinysrgb&w=1600')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.udaipurTrip, IDS.bob],
    );

    assertListCardTitleLen('Jaipur trip', 'Jaipur Heritage');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Jaipur Heritage', '2025-01-10', '2025-01-14',
               'Jaipur, Rajasthan', 26.9124336, 75.7872709, $2,
               'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1600&q=80')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.jaipurTrip, IDS.bob],
    );

    assertListCardTitleLen('Ladakh trip', 'Ladakh Bike June');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Ladakh Bike June', '2026-06-05', '2026-06-18',
               'Leh, Ladakh', 34.1525884, 77.5770535, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.ladakhTrip, IDS.vansh, PH.ladakhPass],
    );

    assertListCardTitleLen('Rishikesh trip', 'Rishikesh Rafting');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Rishikesh Rafting', '2025-08-12', '2025-08-16',
               'Rishikesh, Uttarakhand', 30.0869281, 78.2676116, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.rishikeshTrip, IDS.ankan, PH.rishikeshRaft],
    );

    assertListCardTitleLen('Mumbai trip', 'Mumbai Food Crawl');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Mumbai Food Crawl', '2026-01-15', '2026-12-20',
               'Mumbai, Maharashtra', 19.0760, 72.8777, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.mumbaiTrip, IDS.pooja, PH.mumbaiFood],
    );

    assertListCardTitleLen('Coorg trip', 'Coorg Coffee Wknd');
    await client.query(
      `INSERT INTO trips (id, name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, 'Coorg Coffee Wknd', '2026-07-04', '2026-07-07',
               'Madikeri, Coorg', 12.4244, 75.7382, $2, $3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.coorgTrip, IDS.vansh, PH.coorgTea],
    );

    // ── 7. Trip members ───────────────────────────────────────────────────────
    console.log('  Seeding trip members…');
    const tripMembers = [
      [IDS.goaTrip,     IDS.alice,   'admin'],
      [IDS.goaTrip,     IDS.bob,     'member'],
      [IDS.goaTrip,     IDS.charlie, 'member'],
      [IDS.goaTrip,     IDS.eve,     'member'],
      [IDS.manaliTrip,  IDS.alice,   'admin'],
      [IDS.manaliTrip,  IDS.charlie, 'member'],
      [IDS.manaliTrip,  IDS.frank,   'member'],
      [IDS.keralaTrip,  IDS.alice,   'admin'],
      [IDS.keralaTrip,  IDS.bob,     'member'],
      [IDS.keralaTrip,  IDS.diana,   'member'],
      [IDS.kasolTrip,   IDS.alice,   'admin'],
      [IDS.kasolTrip,   IDS.bob,     'member'],
      [IDS.udaipurTrip, IDS.bob,     'admin'],
      [IDS.udaipurTrip, IDS.alice,   'member'],
      [IDS.udaipurTrip, IDS.grace,   'member'],
      [IDS.udaipurTrip, IDS.henry,   'member'],
      [IDS.jaipurTrip,  IDS.bob,     'admin'],
      [IDS.jaipurTrip,  IDS.charlie, 'member'],
      [IDS.jaipurTrip,  IDS.frank,   'member'],
      [IDS.ladakhTrip,    IDS.vansh,   'admin'],
      [IDS.ladakhTrip,    IDS.ankan,   'member'],
      [IDS.ladakhTrip,    IDS.pooja,   'member'],
      [IDS.ladakhTrip,    IDS.alice,   'member'],
      [IDS.rishikeshTrip, IDS.ankan,   'admin'],
      [IDS.rishikeshTrip, IDS.vansh,   'member'],
      [IDS.rishikeshTrip, IDS.pooja,   'member'],
      [IDS.mumbaiTrip,    IDS.pooja,   'admin'],
      [IDS.mumbaiTrip,    IDS.vansh,   'member'],
      [IDS.mumbaiTrip,    IDS.ankan,   'member'],
      [IDS.mumbaiTrip,    IDS.bob,     'member'],
      [IDS.coorgTrip,     IDS.vansh,   'admin'],
      [IDS.coorgTrip,     IDS.ankan,   'member'],
      [IDS.coorgTrip,     IDS.pooja,   'member'],
      [IDS.coorgTrip,     IDS.grace,   'member'],
    ];
    for (const [tripId, userId, role] of tripMembers) {
      await client.query(
        `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (trip_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [tripId, userId, role],
      );
    }

    // ── 8. Trip invite tokens ─────────────────────────────────────────────────
    console.log('  Seeding trip invite tokens…');
    await client.query(
      `INSERT INTO trip_invites (id, trip_id, invited_by, email, token, expires_at)
       VALUES ('dc000000-0000-4000-8000-000000000001', $1, $2, 'friend@example.com',
               'goa-trip-invite-seed-token-001', NOW() + INTERVAL '7 days'),
              ('dc000000-0000-4000-8000-000000000002', $3, $4, 'guest@example.com',
               'udaipur-trip-invite-seed-token-001', NOW() + INTERVAL '7 days')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.goaTrip, IDS.alice, IDS.udaipurTrip, IDS.bob],
    );

    // ── 9. Activities ─────────────────────────────────────────────────────────
    console.log('  Seeding activities…');

    const allActivities = [
      // GOA (5, all upcoming)
      [IDS.actGoa1, IDS.goaTrip, IDS.alice,   'Beach Day at Baga',           '2027-04-11', '09:00:00', 'Baga Beach, North Goa',          'Sunbeds pre-booked at Britto\'s. Reef-safe sunscreen mandatory. Meet at villa gate 8:45 AM sharp.',                                false, null],
      [IDS.actGoa2, IDS.goaTrip, IDS.bob,     'Sunset Yacht Cruise',         '2027-04-12', '16:30:00', 'Mandovi River, Panaji',           '2hr cocktail cruise — drinks included. Dress smart-casual. Meet at the jetty by 4:15 PM.',                                      false, null],
      [IDS.actGoa3, IDS.goaTrip, IDS.charlie, 'Scuba Diving — Grande Island','2027-04-13', '08:30:00', 'Grande Island, South Goa',        'Intro dive for beginners + open water for certified. Booking ref: GIA2027-04. Bring underwater camera.',                        false, null],
      [IDS.actGoa4, IDS.goaTrip, IDS.eve,     'Old Goa Heritage Walk',       '2027-04-14', '10:00:00', 'Basilica of Bom Jesus, Goa',      '3hr guided walk through 16th-century Portuguese churches and spice markets. Modest dress required.',                            false, null],
      [IDS.actGoa5, IDS.goaTrip, IDS.alice,   'Spice Plantation Tour',       '2027-04-15', '09:30:00', 'Sahakari Spice Farm, Ponda',       'Traditional Goan lunch included. Elephant interaction optional. Shared taxi from villa.',                                       false, null],
      // MANALI (4, mix)
      [IDS.actManali1, IDS.manaliTrip, IDS.alice,   'Snow Trek — Solang Valley', '2026-06-15', '07:00:00', 'Solang Valley, Manali',       'Carry warm layers, trek poles, trail mix. Altitude 2480m — rest on day 1, no alcohol first night.',                            false, null],
      [IDS.actManali2, IDS.manaliTrip, IDS.charlie, 'Rohtang Pass Drive',        '2026-03-10', '06:30:00', 'Rohtang Pass (3978m)',         'Permit booked online — print a copy. Road opens 8AM. Stop at Beas Kund viewpoint for photos.',                                true,  null],
      [IDS.actManali3, IDS.manaliTrip, IDS.frank,   'Hadimba Temple & Old Manali','2026-04-20','11:00:00', 'Hadimba Devi Temple',          'Morning prayers then explore Old Manali cafes. Try apple cider at Bob Dylan cafe — legendary.',                                 true,  null],
      [IDS.actManali4, IDS.manaliTrip, IDS.alice,   'River Rafting — Beas',      '2026-08-10', '10:00:00', 'Beas River, Pirdi',            'Grade III-IV rapids. Helmets and life vests provided. Pack a dry change of clothes in a waterproof bag.',                      false, null],
      // KERALA (3, all completed)
      [IDS.actKerala1, IDS.keralaTrip, IDS.alice, 'Houseboat Overnight Stay',  '2024-03-16', '13:00:00', 'Alleppey Backwaters',            'Check-in at Finishing Point jetty. AC room, all meals. Sunrise from the bow at 6AM — set an alarm.',                           true,  null],
      [IDS.actKerala2, IDS.keralaTrip, IDS.bob,   'Kathakali Performance',     '2024-03-18', '17:30:00', 'Kerala Kathakali Centre, Kochi', '1hr show + 30min makeup session. Book front-row seats. Photography allowed without flash.',                                   true,  null],
      [IDS.actKerala3, IDS.keralaTrip, IDS.diana, 'Ayurvedic Spa Day',         '2024-03-19', '10:00:00', 'Kairali Ayurvedic Spa, Kochi',   'Abhyangam + Shirodhara. Avoid heavy meals 2hrs prior. Book 2 weeks out — very popular.',                                      true,  null],
      // KASOL (2, archived/completed)
      [IDS.actKasol1, IDS.kasolTrip, IDS.alice, 'Kheerganga Trek',            '2025-09-03', '06:00:00', 'Kheerganga, Parvati Valley',      '13km one way, ~5hr ascent. Hot springs at top worth every step. Sleeping bags available to rent in Kasol village.',           true,  null],
      [IDS.actKasol2, IDS.kasolTrip, IDS.bob,   'Parvati River Camp Night',   '2025-09-05', '18:00:00', 'Chalal, Kasol',                   'Bonfire, guitars, and a sky full of stars. Bring sleeping bag rated to 5C. Night porter available.',                          true,  null],
      // UDAIPUR (4, all upcoming)
      [IDS.actUdaipur1, IDS.udaipurTrip, IDS.bob,   'City Palace & Museum',        '2026-12-06', '10:00:00', 'City Palace, Udaipur',         'Skip-the-line passes pre-booked. Guided tour 2hr. Sunset from Manek Chowk terrace.',                                      false, null],
      [IDS.actUdaipur2, IDS.udaipurTrip, IDS.alice,  'Sunset Boat — Lake Pichola', '2026-12-06', '17:30:00', 'Lake Pichola, Udaipur',         'Motor launch to Jag Mandir island. 1hr round trip. Prime golden-hour photography spot.',                                  false, null],
      [IDS.actUdaipur3, IDS.udaipurTrip, IDS.grace,  'Royal Dinner at Ambrai Ghat','2026-12-07', '20:00:00', 'Amet Haveli, Udaipur',          'Candlelit dinner, palace view across the lake. Reservation for 4. Smart dress required — no sneakers.',                   false, null],
      [IDS.actUdaipur4, IDS.udaipurTrip, IDS.henry,  'Vintage Car Museum',         '2026-12-07', '11:00:00', 'Vintage Car Museum, Udaipur',   'Classic Maharaja cars collection. Less crowded in the morning — hidden gem.',                                            false, null],
      // JAIPUR (3, all completed)
      [IDS.actJaipur1, IDS.jaipurTrip, IDS.bob,     'Amber Fort at Sunrise',     '2025-01-11', '06:30:00', 'Amber Fort, Jaipur',            'Sunrise light on fort walls is stunning. Elephant ride up is Rs 900/elephant. Arrive before 7AM to skip lines.',            true,  null],
      [IDS.actJaipur2, IDS.jaipurTrip, IDS.frank,   'Hawa Mahal & Bazaar Walk',  '2025-01-12', '09:00:00', 'Hawa Mahal, Pink City',          'Franks guided heritage walk — 3hr on foot through Johari Bazaar. Budget Rs 2000 for shopping. Bargain hard.',             true,  null],
      [IDS.actJaipur3, IDS.jaipurTrip, IDS.charlie, 'Hot Air Balloon at Dawn',   '2025-01-13', '05:30:00', 'Sky Waltz Launch, Jaipur',       'Meet 5:30AM sharp. 1hr flight, views of fort and old city. Champagne on landing. Worth every rupee.',                    true,  null],
      // Ladakh (alpha)
      [IDS.actLadakh1, IDS.ladakhTrip, IDS.vansh,   'Leh Acclimatisation Day',   '2026-06-06', '10:00:00', 'Leh Main Bazaar',                'Easy walks only — hydrate, no alcohol. Oxygen on standby at hotel. Group dinner at Tibetan Kitchen.',                      false, null],
      [IDS.actLadakh2, IDS.ladakhTrip, IDS.ankan,   'Khardung La Pass Ride',       '2026-06-09', '06:00:00', 'Khardung La (5359m)',             'World’s highest motorable pass — layers, gloves, full tank. Photo stop 20min max to avoid altitude headache.',           false, null],
      [IDS.actLadakh3, IDS.ladakhTrip, IDS.pooja,   'Pangong Lake Day Trip',       '2026-06-12', '05:30:00', 'Pangong Tso',                     'Long day — pack snacks, motion sickness tabs. Permits arranged. Return by sunset.',                                       false, null],
      [IDS.actLadakh4, IDS.ladakhTrip, IDS.alice,   'Nubra Valley Camp Night',     '2026-06-14', '15:00:00', 'Hunder Sand Dunes',               'Double-hump camels optional. Bonfire and stargazing — dress warm below 10C at night.',                                    false, null],
      // Rishikesh (alpha, past)
      [IDS.actRishi1, IDS.rishikeshTrip, IDS.ankan,  'Ganga Aarti — Parmarth',     '2025-08-12', '18:00:00', 'Parmarth Niketan, Rishikesh',    'Arrive 45min early for seats. Phones silent — soak in the lamps and chants.',                                             true,  null],
      [IDS.actRishi2, IDS.rishikeshTrip, IDS.vansh,  'Grade III Rafting — Marine Drive','2025-08-13','09:00:00','Shivpuri to Rishikesh',      'Safety briefing 8:30AM. Waterproof bag for phone. Flip-flops not allowed — wear secure sandals.',                          true,  null],
      [IDS.actRishi3, IDS.rishikeshTrip, IDS.pooja,  'Café Hopping — Tapovan',     '2025-08-14', '11:00:00', 'Tapovan, Rishikesh',             'Little Buddha Cafe for lunch, Beatles Ashram walk optional. Chill day after rafting.',                                     true,  null],
      // Mumbai (alpha, ongoing)
      [IDS.actMumbai1, IDS.mumbaiTrip, IDS.pooja,   'South Bombay Heritage Walk', '2026-03-01', '08:00:00', 'Gateway of India',               '3hr walk: Kala Ghoda, Colaba Causeway, chai at Irani cafe. Comfortable shoes.',                                           false, null],
      [IDS.actMumbai2, IDS.mumbaiTrip, IDS.vansh,   'Street Food — Mohammad Ali Rd','2026-04-10','19:00:00', 'Mohammad Ali Road',              'Ramadan season = best kebabs. Carry cash, share plates. Meet outside Noorani.',                                            false, null],
      [IDS.actMumbai3, IDS.mumbaiTrip, IDS.ankan,   'Bandra Sunset & Sealink',    '2026-05-20', '17:30:00', 'Bandra Fort',                    'Golden hour photos, then dinner at Pali Village — reservations under Pooja.',                                             false, null],
      [IDS.actMumbai4, IDS.mumbaiTrip, IDS.bob,     'Art District — Worli',       '2026-06-05', '16:00:00', 'Worli, Mumbai',                  'Gallery hop + coffee. Low-key culture fix between food crawls.',                                                          false, null],
      // Coorg (alpha)
      [IDS.actCoorg1, IDS.coorgTrip, IDS.vansh,     'Plantation Walk & Tasting',  '2026-07-05', '09:00:00', 'Mercara Coffee Estate',          'Guided walk through arabica rows — cupping session after. Buy beans at estate price.',                                     false, null],
      [IDS.actCoorg2, IDS.coorgTrip, IDS.ankan,     'Abbey Falls & Trek',         '2026-07-06', '07:00:00', 'Abbey Falls, Coorg',             'Slippery steps — wear grip shoes. Swim not allowed; viewpoint only.',                                                       false, null],
      [IDS.actCoorg3, IDS.coorgTrip, IDS.pooja,     'Coorgi Home-Cooked Dinner',    '2026-07-06', '19:00:00', 'Homestay, Madikeri',             'Pandi curry + akki roti — inform host of spice tolerance. BYO dessert if you want to impress.',                             false, null],
    ];

    for (const [id, tripId, createdBy, title, date, time, loc, desc, done, expId] of allActivities) {
      await client.query(
        `INSERT INTO trip_activities
           (id, trip_id, created_by, title, activity_date, activity_time,
            location_name, description, is_completed, expense_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [id, tripId, createdBy, title, date, time, loc, desc, done, expId],
      );
    }

    // ── 10. Expenses ──────────────────────────────────────────────────────────
    console.log('  Seeding expenses…');

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

    // GOA
    await addExp(IDS.expGoa1, 'trip', IDS.goaTrip, 'Beach Villa — 7 nights', 28000, 'accommodation', IDS.alice, 'equal');
    for (const uid of [IDS.alice, IDS.bob, IDS.charlie, IDS.eve]) await addSplit(IDS.expGoa1, uid, 7000);

    await addExp(IDS.expGoa2, 'trip', IDS.goaTrip, 'Scuba Package — Grande Island', 6400, 'entertainment', IDS.charlie, 'percentage');
    for (const [uid, amt, pct] of [[IDS.charlie, 2560, 40], [IDS.alice, 1920, 30], [IDS.bob, 1920, 30]]) await addSplit(IDS.expGoa2, uid, amt, pct);

    await addExp(IDS.expGoa3, 'trip', IDS.goaTrip, 'Sunset Yacht Cruise', 5600, 'entertainment', IDS.bob, 'equal');
    for (const uid of [IDS.alice, IDS.bob, IDS.charlie, IDS.eve]) await addSplit(IDS.expGoa3, uid, 1400);

    // Link scuba expense to the scuba activity
    await client.query(`UPDATE trip_activities SET expense_id = $1 WHERE id = $2`, [IDS.expGoa2, IDS.actGoa3]);

    // MANALI
    await addExp(IDS.expManali1, 'trip', IDS.manaliTrip, 'The Himalayan Hotel — 3 nights', 7500, 'accommodation', IDS.alice, 'equal');
    for (const uid of [IDS.alice, IDS.charlie, IDS.frank]) await addSplit(IDS.expManali1, uid, 2500);

    await addExp(IDS.expManali2, 'trip', IDS.manaliTrip, 'Rohtang Permit + Taxi', 2700, 'transportation', IDS.charlie, 'equal');
    for (const uid of [IDS.alice, IDS.charlie, IDS.frank]) await addSplit(IDS.expManali2, uid, 900);

    // KERALA
    await addExp(IDS.expKerala1, 'trip', IDS.keralaTrip, 'Houseboat Overnight (all-inclusive)', 9000, 'accommodation', IDS.alice, 'equal');
    for (const uid of [IDS.alice, IDS.bob, IDS.diana]) await addSplit(IDS.expKerala1, uid, 3000);

    await addExp(IDS.expKerala2, 'trip', IDS.keralaTrip, 'Kathakali + Spa (group booking)', 4500, 'entertainment', IDS.bob, 'equal');
    for (const uid of [IDS.alice, IDS.bob, IDS.diana]) await addSplit(IDS.expKerala2, uid, 1500);

    // Bob and Diana already settled with alice
    await client.query(
      `INSERT INTO settlements (parent_type, parent_id, paid_by, paid_to, amount)
       VALUES ('trip',$1,$2,$3,4500.00), ('trip',$1,$4,$3,4500.00)`,
      [IDS.keralaTrip, IDS.bob, IDS.alice, IDS.diana],
    );

    // KASOL
    await addExp(IDS.expKasol1, 'trip', IDS.kasolTrip, 'Camping + Trek Guide', 3200, 'accommodation', IDS.alice, 'equal');
    for (const uid of [IDS.alice, IDS.bob]) await addSplit(IDS.expKasol1, uid, 1600);

    // UDAIPUR
    await addExp(IDS.expUdaipur1, 'trip', IDS.udaipurTrip, 'Heritage Haveli — 3 nights', 18000, 'accommodation', IDS.bob, 'equal');
    for (const uid of [IDS.bob, IDS.alice, IDS.grace, IDS.henry]) await addSplit(IDS.expUdaipur1, uid, 4500);

    await addExp(IDS.expUdaipur2, 'trip', IDS.udaipurTrip, 'Sunset Boat + City Palace Tickets', 3200, 'entertainment', IDS.alice, 'equal');
    for (const uid of [IDS.bob, IDS.alice, IDS.grace, IDS.henry]) await addSplit(IDS.expUdaipur2, uid, 800);

    await addExp(IDS.expUdaipur3, 'trip', IDS.udaipurTrip, 'Royal Dinner at Ambrai Ghat', 6800, 'food', IDS.grace, 'percentage');
    for (const [uid, amt, pct] of [[IDS.bob, 2380, 35], [IDS.alice, 2380, 35], [IDS.grace, 1360, 20], [IDS.henry, 680, 10]]) await addSplit(IDS.expUdaipur3, uid, amt, pct);

    // JAIPUR
    await addExp(IDS.expJaipur1, 'trip', IDS.jaipurTrip, 'Hotel Arya Niwas — 4 nights', 8400, 'accommodation', IDS.bob, 'equal');
    for (const uid of [IDS.bob, IDS.charlie, IDS.frank]) await addSplit(IDS.expJaipur1, uid, 2800);

    await addExp(IDS.expJaipur2, 'trip', IDS.jaipurTrip, 'Hot Air Balloon — Sky Waltz', 9000, 'entertainment', IDS.charlie, 'equal');
    for (const uid of [IDS.bob, IDS.charlie, IDS.frank]) await addSplit(IDS.expJaipur2, uid, 3000);

    // Alpha trips
    await addExp(IDS.expLadakh1, 'trip', IDS.ladakhTrip, 'Leh Guesthouse — 12 nights', 36000, 'accommodation', IDS.vansh, 'equal');
    for (const uid of [IDS.vansh, IDS.ankan, IDS.pooja, IDS.alice]) await addSplit(IDS.expLadakh1, uid, 9000);

    await addExp(IDS.expLadakh2, 'trip', IDS.ladakhTrip, 'Bike fuel + permits bundle', 12000, 'transportation', IDS.ankan, 'equal');
    for (const uid of [IDS.vansh, IDS.ankan, IDS.pooja, IDS.alice]) await addSplit(IDS.expLadakh2, uid, 3000);
    await client.query(`UPDATE trip_activities SET expense_id = $1 WHERE id = $2`, [IDS.expLadakh2, IDS.actLadakh2]);

    await addExp(IDS.expRishi1, 'trip', IDS.rishikeshTrip, 'Rafting + camp package', 9000, 'entertainment', IDS.ankan, 'equal');
    for (const uid of [IDS.vansh, IDS.ankan, IDS.pooja]) await addSplit(IDS.expRishi1, uid, 3000);

    await addExp(IDS.expRishi2, 'trip', IDS.rishikeshTrip, 'Riverside cottages — 4 nights', 16000, 'accommodation', IDS.pooja, 'equal');
    for (const [uid, amt] of [[IDS.vansh, 5334], [IDS.ankan, 5333], [IDS.pooja, 5333]]) await addSplit(IDS.expRishi2, uid, amt);
    await client.query(`UPDATE trip_activities SET expense_id = $1 WHERE id = $2`, [IDS.expRishi1, IDS.actRishi2]);

    await addExp(IDS.expMumbai1, 'trip', IDS.mumbaiTrip, 'Food crawl float (shared)', 8000, 'food', IDS.pooja, 'equal');
    for (const uid of [IDS.pooja, IDS.vansh, IDS.ankan, IDS.bob]) await addSplit(IDS.expMumbai1, uid, 2000);

    await addExp(IDS.expMumbai2, 'trip', IDS.mumbaiTrip, 'Cab pool — month 1', 6000, 'transportation', IDS.bob, 'equal');
    for (const uid of [IDS.pooja, IDS.vansh, IDS.ankan, IDS.bob]) await addSplit(IDS.expMumbai2, uid, 1500);

    await addExp(IDS.expCoorg1, 'trip', IDS.coorgTrip, 'Homestay — 3 nights', 18000, 'accommodation', IDS.vansh, 'equal');
    for (const uid of [IDS.vansh, IDS.ankan, IDS.pooja, IDS.grace]) await addSplit(IDS.expCoorg1, uid, 4500);

    await addExp(IDS.expCoorg2, 'trip', IDS.coorgTrip, 'Jeep + guide — estates tour', 6400, 'entertainment', IDS.grace, 'equal');
    for (const uid of [IDS.vansh, IDS.ankan, IDS.pooja, IDS.grace]) await addSplit(IDS.expCoorg2, uid, 1600);

    // ── 11. Gallery photos ────────────────────────────────────────────────────
    console.log('  Seeding gallery photos…');
    const photos = [
      // Goa (5)
      [IDS.photoGoa1, 'trip', IDS.goaTrip, IDS.alice,   PH.goaBaga,      'seed/trips/goa/01.jpg',        'Shoreline at Baga Beach',         null],
      [IDS.photoGoa2, 'trip', IDS.goaTrip, IDS.bob,     PH.goaPool,      'seed/trips/goa/02.jpg',        'Villa pool on day 1',             null],
      [IDS.photoGoa3, 'trip', IDS.goaTrip, IDS.charlie, PH.goaBoat,      'seed/trips/goa/03.jpg',        'Fishing boats at the harbour',    null],
      [IDS.photoGoa4, 'trip', IDS.goaTrip, IDS.eve,     PH.goaSunset,    'seed/trips/goa/04.jpg',        'Calangute sunset',                IDS.actGoa1],
      [IDS.photoGoa5, 'trip', IDS.goaTrip, IDS.alice,   PH.goaChurch,    'seed/trips/goa/05.jpg',        'Basilica of Bom Jesus',           null],
      // Manali (5)
      [IDS.photoManali1, 'trip', IDS.manaliTrip, IDS.alice,   PH.manaliSnow,    'seed/trips/manali/01.jpg', 'Snow peaks above Manali',        null],
      [IDS.photoManali2, 'trip', IDS.manaliTrip, IDS.charlie, PH.manaliSolang,  'seed/trips/manali/02.jpg', 'Solang Valley snow play',        IDS.actManali1],
      [IDS.photoManali3, 'trip', IDS.manaliTrip, IDS.frank,   PH.manaliPeaks,   'seed/trips/manali/03.jpg', 'Himalayan peaks at golden hour', null],
      [IDS.photoManali4, 'trip', IDS.manaliTrip, IDS.alice,   PH.manaliRiver,   'seed/trips/manali/04.jpg', 'Beas river rapids',              IDS.actManali4],
      [IDS.photoManali5, 'trip', IDS.manaliTrip, IDS.charlie, PH.manaliRohtang, 'seed/trips/manali/05.jpg', 'Rohtang Pass summit view',       IDS.actManali2],
      // Kerala (5)
      [IDS.photoKerala1, 'trip', IDS.keralaTrip, IDS.alice, PH.keralaHouse,  'seed/trips/kerala/01.jpg', 'Houseboat in morning mist',       null],
      [IDS.photoKerala2, 'trip', IDS.keralaTrip, IDS.bob,   PH.keralaCanal,  'seed/trips/kerala/02.jpg', 'Canal through coconut palms',     IDS.actKerala1],
      [IDS.photoKerala3, 'trip', IDS.keralaTrip, IDS.diana, PH.keralaPalm,   'seed/trips/kerala/03.jpg', 'Palm-lined Kerala lagoon',        null],
      [IDS.photoKerala4, 'trip', IDS.keralaTrip, IDS.alice, PH.keralaKatha,  'seed/trips/kerala/04.jpg', 'Kathakali performance',           IDS.actKerala2],
      [IDS.photoKerala5, 'trip', IDS.keralaTrip, IDS.bob,   PH.keralaBack,   'seed/trips/kerala/05.jpg', 'Sunset on the backwaters',        null],
      // Kasol (4)
      [IDS.photoKasol1, 'trip', IDS.kasolTrip, IDS.alice, PH.kasolTrail,  'seed/trips/kasol/01.jpg', 'Parvati Valley forest trail',     null],
      [IDS.photoKasol2, 'trip', IDS.kasolTrip, IDS.bob,   PH.kasolRiver,  'seed/trips/kasol/02.jpg', 'River crossing at Chalal',        IDS.actKasol2],
      [IDS.photoKasol3, 'trip', IDS.kasolTrip, IDS.alice, PH.kasolCamp,   'seed/trips/kasol/03.jpg', 'Campsite at Kheerganga',          IDS.actKasol1],
      [IDS.photoKasol4, 'trip', IDS.kasolTrip, IDS.bob,   PH.kasolStars,  'seed/trips/kasol/04.jpg', 'Milky Way from the valley',       null],
      // Udaipur (5)
      [IDS.photoUdaipur1, 'trip', IDS.udaipurTrip, IDS.bob,   PH.udaipurPalace, 'seed/trips/udaipur/01.jpg', 'City Palace panorama',         null],
      [IDS.photoUdaipur2, 'trip', IDS.udaipurTrip, IDS.alice,  PH.udaipurLake,   'seed/trips/udaipur/02.jpg', 'Lake Pichola at dusk',         IDS.actUdaipur2],
      [IDS.photoUdaipur3, 'trip', IDS.udaipurTrip, IDS.grace,  PH.udaipurHaveli, 'seed/trips/udaipur/03.jpg', 'Heritage haveli courtyard',    null],
      [IDS.photoUdaipur4, 'trip', IDS.udaipurTrip, IDS.henry,  PH.udaipurDinner, 'seed/trips/udaipur/04.jpg', 'Royal dinner spread',          IDS.actUdaipur3],
      [IDS.photoUdaipur5, 'trip', IDS.udaipurTrip, IDS.bob,   PH.udaipurSunset, 'seed/trips/udaipur/05.jpg', 'Sunset from Dudh Talai',       null],
      // Jaipur (5)
      [IDS.photoJaipur1, 'trip', IDS.jaipurTrip, IDS.bob,     PH.jaipurHawa,    'seed/trips/jaipur/01.jpg', 'Hawa Mahal at golden hour',     null],
      [IDS.photoJaipur2, 'trip', IDS.jaipurTrip, IDS.frank,   PH.jaipurAmber,   'seed/trips/jaipur/02.jpg', 'Amber Fort at sunrise',         IDS.actJaipur1],
      [IDS.photoJaipur3, 'trip', IDS.jaipurTrip, IDS.charlie, PH.jaipurBalloon, 'seed/trips/jaipur/03.jpg', 'Balloon over the Pink City',    IDS.actJaipur3],
      [IDS.photoJaipur4, 'trip', IDS.jaipurTrip, IDS.bob,     PH.jaipurBazaar,  'seed/trips/jaipur/04.jpg', 'Johari Bazaar colours',         null],
      [IDS.photoJaipur5, 'trip', IDS.jaipurTrip, IDS.frank,   PH.jaipurCity,    'seed/trips/jaipur/05.jpg', 'City Palace corridors',         null],
      // Events
      [IDS.photoDiwali1, 'event', IDS.diwaliEvent, IDS.alice,   PH.diwaliLights,  'seed/events/diwali/01.jpg', 'Diwali light strings',          null],
      [IDS.photoDiwali2, 'event', IDS.diwaliEvent, IDS.bob,     PH.diwaliDecor,   'seed/events/diwali/02.jpg', 'Rangoli and decor',             null],
      [IDS.photoDiwali3, 'event', IDS.diwaliEvent, IDS.charlie, PH.diwaliCrowd,   'seed/events/diwali/03.jpg', 'Fireworks over the terrace',    null],
      [IDS.photoHoli1,   'event', IDS.holiEvent,   IDS.alice,   PH.holiColors,    'seed/events/holi/01.jpg',   'Colours flying high',           null],
      [IDS.photoHoli2,   'event', IDS.holiEvent,   IDS.diana,   PH.holiCrowd,     'seed/events/holi/02.jpg',   'Group holi chaos',              null],
      [IDS.photoNYE1,    'event', IDS.nyeEvent,    IDS.bob,     PH.nyeRooftop,    'seed/events/nye/01.jpg',    'Rooftop countdown setup',       null],
      [IDS.photoNYE2,    'event', IDS.nyeEvent,    IDS.alice,   PH.nyeMumbai,     'seed/events/nye/02.jpg',    'Mumbai skyline at midnight',    null],
      [IDS.photoNYE3,    'event', IDS.nyeEvent,    IDS.grace,   PH.nyeCrowd,      'seed/events/nye/03.jpg',    'Midnight group photo',          null],
      [IDS.photoMeetup1, 'event', IDS.meetupEvent, IDS.bob,     PH.meetupStage,   'seed/events/meetup/01.jpg', 'Pune Tech Meetup stage',        null],
      [IDS.photoMeetup2, 'event', IDS.meetupEvent, IDS.henry,   PH.meetupCoffee,  'seed/events/meetup/02.jpg', 'Networking coffee session',     null],
      // Ladakh
      [IDS.photoLadakh1, 'trip', IDS.ladakhTrip, IDS.vansh,   PH.ladakhRoad,  'seed/trips/ladakh/01.jpg', 'Convoy on the high road',        null],
      [IDS.photoLadakh2, 'trip', IDS.ladakhTrip, IDS.ankan,   PH.ladakhBike,  'seed/trips/ladakh/02.jpg', 'Bike lineup at the pass',        IDS.actLadakh2],
      [IDS.photoLadakh3, 'trip', IDS.ladakhTrip, IDS.pooja,   PH.ladakhPass,  'seed/trips/ladakh/03.jpg', 'Snow caps and prayer flags',     null],
      [IDS.photoLadakh4, 'trip', IDS.ladakhTrip, IDS.alice,   PH.ladakhLake,  'seed/trips/ladakh/04.jpg', 'Turquoise Pangong stretch',       IDS.actLadakh3],
      [IDS.photoLadakh5, 'trip', IDS.ladakhTrip, IDS.vansh,   PH.coorgHills,  'seed/trips/ladakh/05.jpg', 'Campfire at Nubra',              IDS.actLadakh4],
      // Rishikesh
      [IDS.photoRishi1, 'trip', IDS.rishikeshTrip, IDS.ankan,  PH.rishikeshGhat,'seed/trips/rishikesh/01.jpg', 'Ganga ghats at dusk',       IDS.actRishi1],
      [IDS.photoRishi2, 'trip', IDS.rishikeshTrip, IDS.vansh,  PH.rishikeshRaft,'seed/trips/rishikesh/02.jpg', 'Raft splash moment',        IDS.actRishi2],
      [IDS.photoRishi3, 'trip', IDS.rishikeshTrip, IDS.pooja,  PH.manaliRiver,  'seed/trips/rishikesh/03.jpg', 'Riverside chai break',        null],
      [IDS.photoRishi4, 'trip', IDS.rishikeshTrip, IDS.pooja,  PH.rishikeshGhat,'seed/trips/rishikesh/04.jpg', 'Tapovan cafe sunset',       IDS.actRishi3],
      // Mumbai
      [IDS.photoMumbai1, 'trip', IDS.mumbaiTrip, IDS.pooja,  PH.mumbaiSky,   'seed/trips/mumbai/01.jpg', 'Marine Drive blue hour',         null],
      [IDS.photoMumbai2, 'trip', IDS.mumbaiTrip, IDS.vansh,  PH.mumbaiFood,  'seed/trips/mumbai/02.jpg', 'Kebab trail highlights',         IDS.actMumbai2],
      [IDS.photoMumbai3, 'trip', IDS.mumbaiTrip, IDS.ankan,  PH.mumbaiSky,   'seed/trips/mumbai/03.jpg', 'Bandra-Worli sparkle',           IDS.actMumbai3],
      [IDS.photoMumbai4, 'trip', IDS.mumbaiTrip, IDS.bob,    PH.meetupCoffee,'seed/trips/mumbai/04.jpg', 'Gallery coffee stop',          IDS.actMumbai4],
      [IDS.photoMumbai5, 'trip', IDS.mumbaiTrip, IDS.pooja,  PH.mumbaiFood,  'seed/trips/mumbai/05.jpg', 'Vada pav mission',               IDS.actMumbai1],
      // Coorg
      [IDS.photoCoorg1, 'trip', IDS.coorgTrip, IDS.vansh,  PH.coorgTea,   'seed/trips/coorg/01.jpg', 'Morning mist over estate',        IDS.actCoorg1],
      [IDS.photoCoorg2, 'trip', IDS.coorgTrip, IDS.grace,  PH.coorgHills, 'seed/trips/coorg/02.jpg', 'Rolling Western Ghats',           null],
      [IDS.photoCoorg3, 'trip', IDS.coorgTrip, IDS.ankan,  PH.keralaPalm, 'seed/trips/coorg/03.jpg', 'Abbey Falls spray',               IDS.actCoorg2],
      [IDS.photoCoorg4, 'trip', IDS.coorgTrip, IDS.pooja,  PH.udaipurDinner,'seed/trips/coorg/04.jpg', 'Homestay feast spread',         IDS.actCoorg3],
      [IDS.photoCoorg5, 'trip', IDS.coorgTrip, IDS.vansh,  PH.coorgTea,   'seed/trips/coorg/05.jpg', 'Fresh roast sample',              null],
      // Alpha events
      [IDS.photoAlpha1, 'event', IDS.alphaEvent, IDS.vansh,  PH.alphaRooftop, 'seed/events/alpha/01.jpg', 'Reunion rooftop setup',        null],
      [IDS.photoAlpha2, 'event', IDS.alphaEvent, IDS.ankan,  PH.diwaliLights, 'seed/events/alpha/02.jpg', 'String lights and skyline',    null],
      [IDS.photoAlpha3, 'event', IDS.alphaEvent, IDS.pooja,  PH.meetupCoffee, 'seed/events/alpha/03.jpg', 'Welcome drinks table',         null],
      [IDS.photoAlpha4, 'event', IDS.alphaEvent, IDS.alice,  PH.nyeCrowd,     'seed/events/alpha/04.jpg', 'Group shot — alpha crew',      null],
      [IDS.photoBoard1, 'event', IDS.boardEvent, IDS.pooja,  PH.boardGames,   'seed/events/board/01.jpg', 'Tabletop night spread',        null],
      [IDS.photoBoard2, 'event', IDS.boardEvent, IDS.vansh,  PH.boardGames,   'seed/events/board/02.jpg', 'Catan in full swing',          null],
      [IDS.photoBoard3, 'event', IDS.boardEvent, IDS.ankan,  PH.meetupCoffee, 'seed/events/board/03.jpg', 'Late-night snacks',            null],
    ];
    for (const [id, pType, pId, uploadedBy, fileUrl, s3Key, caption, actId] of photos) {
      await client.query(
        `INSERT INTO photos (id, parent_type, parent_id, uploaded_by, file_url, s3_key, caption, mime_type, activity_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'image/jpeg',$8)
         ON CONFLICT (id) DO NOTHING`,
        [id, pType, pId, uploadedBy, fileUrl, s3Key, caption, actId],
      );
    }

    // ── 12. Notes ─────────────────────────────────────────────────────────────
    console.log('  Seeding notes…');
    const notes = [
      [IDS.noteGoa1, 'trip', IDS.goaTrip, IDS.alice, 'Packing List',
       'Reef-safe sunscreen, rash guard, snorkel kit, waterproof phone pouch, cash Rs 5000 min (beach shacks are cash-only), power bank, GoPro with underwater case, light sandals, one smart outfit for sunset cruise.',
       'todo'],
      [IDS.noteGoa2, 'trip', IDS.goaTrip, IDS.bob, 'Villa Details & Rules',
       'Villa: Seashell Retreat, Candolim. Check-in 2PM, checkout 11AM. Pool 6AM-10PM. Caretaker Rajan: +91-9823456789. Nearest pharmacy: Apollo (5min walk). Generator keeps AC on during power cuts — happens nightly.',
       'important'],
      [IDS.noteGoa3, 'trip', IDS.goaTrip, IDS.charlie, 'Food & Nightlife Hits',
       'MUST-EAT: Infantaria (breakfast), A Reverie (fine dining), Fishermans Wharf (seafood platter), Gunpowder (Goan-Kerala fusion). Sunday brunch at Thalassa — book 2 weeks ahead. Brew pubs: Desmondji, Panjim Farmers Market on Saturdays.',
       'general'],
      [IDS.noteManali1, 'trip', IDS.manaliTrip, IDS.alice, 'Health & Safety',
       'Altitude sickness is real — rest on arrival day, no alcohol for 24hrs. Carry Diamox if prescribed. Emergency: District Hospital Manali +91-1902-252379. Weather flips fast — check forecast daily. Save offline maps (Maps.me) — signal drops past Rohtang.',
       'important'],
      [IDS.noteManali2, 'trip', IDS.manaliTrip, IDS.charlie, 'Best Cafes & Food',
       'Breakfast: Johnsons Cafe (iconic, arrive early). Dinner: Drifters Inn (Israeli-Indian fusion), Lazy Dog Lounge (best trout in Manali). Hot chocolate at The Lazy Daze. Old Manali has the vibe — walk across the bridge at sunset.',
       'general'],
      [IDS.noteKerala1, 'trip', IDS.keralaTrip, IDS.alice, 'Houseboat Checklist',
       'Bring: motion sickness tabs (river can sway at night), light cotton clothes (very humid), mosquito repellent. Do not bring: glass bottles (boat rules). Sunrise from the bow at 6AM — chef Shaji rings a bell. All meals are incredible.',
       'todo'],
      [IDS.noteKerala2, 'trip', IDS.keralaTrip, IDS.bob, 'Getting Around',
       'Alleppey to Kochi: ferry is best (3hr, Rs 15, insane backwater views). Rickshaws for short hops — fix price before boarding. Ola works in Kochi city. Ernakulam to airport 45min by taxi — book in advance during peak season.',
       'general'],
      [IDS.noteKasol1, 'trip', IDS.kasolTrip, IDS.alice, 'Trek Essentials',
       'Kheerganga: start by 6AM to beat afternoon cloud cover. 13km one way, ~5hr ascent. Rent sleeping bags in Kasol village Rs 200/night. Local guide Deepak is great — ask at the Kasol hostel. Hot springs temp 45C — bring flip-flops. No permits required currently.',
       'important'],
      [IDS.noteUdaipur1, 'trip', IDS.udaipurTrip, IDS.bob, 'Haveli Details',
       'Booking: Jagat Niwas Palace Haveli. Lake-facing deluxe rooms. Breakfast included. Rooftop bar open till midnight — the view is insane. Contact: Sanjay +91-9414XXXXXX. 2min walk to City Palace main gate.',
       'important'],
      [IDS.noteUdaipur2, 'trip', IDS.udaipurTrip, IDS.alice, 'Day-by-Day Itinerary',
       'Day 1: Arrive, check-in, evening boat ride on the lake. Day 2: City Palace morning, Vintage Car Museum noon, Ambrai dinner. Day 3: Saheliyon ki Bari, Bagore ki Haveli folk show at 7PM, bazaar. Day 4: Eklingji temple en route to airport.',
       'general'],
      [IDS.noteUdaipur3, 'trip', IDS.udaipurTrip, IDS.grace, 'Shopping Guide',
       'Best buys: miniature paintings (Manak Chowk), block-printed fabric (Hathi Pol), silver jewellery (Bada Bazaar). Avoid tourist shops near City Palace — overpriced. Ask haveli staff for trusted local vendors. Budget Rs 3000-8000 per person.',
       'todo'],
      [IDS.noteJaipur1, 'trip', IDS.jaipurTrip, IDS.bob, 'Local Tips',
       'Guide: Amar Singh (Franks contact) — Rs 800 per half-day, brilliant storyteller. Auto: Rs 100-200 most city hops, fix price first. Best chai: Lassiwala on MI Road (the original — ignore the copies next door). Visit Bapu Bazaar at dusk.',
       'general'],
      [IDS.noteJaipur2, 'trip', IDS.jaipurTrip, IDS.frank, 'Heritage Sites Priority',
       'Must-see: Amber Fort at sunrise, Hawa Mahal (best shot from across the street at 8AM), City Palace (allow 2hr+). Worth it: Jantar Mantar, Nahargarh Fort at sunset. Combo ticket saves Rs 200. Skip Albert Hall if short on time.',
       'important'],
      [IDS.noteDiwali1, 'event', IDS.diwaliEvent, IDS.alice, 'Setup Assignments',
       'Lights and lanterns: Bob. Rangoli: Charlie. Sweets and puja thali: Alice. Fireworks (legal sparklers only): Eve. DJ setup: Raj Audio arriving 5PM. Dinner catered by Punjabi Tadka — paid in full. Head count: 22 confirmed, 5 pending.',
       'todo'],
      [IDS.noteNYE1, 'event', IDS.nyeEvent, IDS.bob, 'NYE Logistics',
       'Venue: Skye Rooftop, Bandra West. Max 40 guests (35 confirmed). Entry Rs 500 covers welcome drink. DJ Arjun 10PM-2AM. Dress code: Glam or Formal — enforce at door. Designated drivers: Henry and Frank volunteered. 3 bottles Chandon on ice for midnight.',
       'important'],
      [IDS.noteLadakh1, 'trip', IDS.ladakhTrip, IDS.vansh, 'Bike prep checklist',
       'Carry spare tubes, portable pump, bungee cords, rain liner, thermal base layers, lip balm SPF, power bank. IMS permit printouts in waterproof pouch. Download offline maps for Leh–Nubra–Pangong.',
       'important'],
      [IDS.noteLadakh2, 'trip', IDS.ladakhTrip, IDS.pooja, 'Altitude meds',
       'Consult doc for Diamox. Avoid heavy meals day 1–2. Ginger tea helps nausea. Hotel has oxygen — front desk 24/7.',
       'general'],
      [IDS.noteRishi1, 'trip', IDS.rishikeshTrip, IDS.ankan, 'Rafting what to wear',
       'Quick-dry tee, secure shorts, strap sandals (not flip-flops). Leave jewellery at cottage. Waterproof case only if strapped — river will test it.',
       'todo'],
      [IDS.noteMumbai1, 'trip', IDS.mumbaiTrip, IDS.pooja, 'Crawl etiquette',
       'One veg + one meat stop per night max. Split bills on app same night. Hydrate between spicy stops — trust the nimbu pani.',
       'general'],
      [IDS.noteMumbai2, 'trip', IDS.mumbaiTrip, IDS.bob, 'Parking & trains',
       'Weekend local trains: first class pass worth it. Uber works; avoid peak 6–9PM unless you like traffic ASMR.',
       'general'],
      [IDS.noteCoorg1, 'trip', IDS.coorgTrip, IDS.grace, 'Photo spots',
       'Golden hour at Raja Seat, mist shots at Mandalpatti (jeep only). Respect plantation no-drone signs unless host approves.',
       'general'],
      [IDS.noteAlpha1, 'event', IDS.alphaEvent, IDS.vansh, 'Alpha reunion run of show',
       '7PM doors, 7:30 icebreaker, 8PM catered dinner, 9:30 open mic / roasts. Plus-ones welcome — RSVP headcount locked Friday.',
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
    console.log('  Seeding note favorites…');
    const noteFavs = [
      [IDS.noteGoa1, IDS.alice], [IDS.noteGoa1, IDS.bob], [IDS.noteGoa1, IDS.charlie],
      [IDS.noteGoa2, IDS.alice], [IDS.noteGoa2, IDS.eve],
      [IDS.noteManali1, IDS.alice], [IDS.noteManali1, IDS.charlie],
      [IDS.noteUdaipur1, IDS.bob], [IDS.noteUdaipur2, IDS.alice], [IDS.noteUdaipur2, IDS.grace],
      [IDS.noteJaipur2, IDS.bob],       [IDS.noteJaipur2, IDS.frank],
      [IDS.noteLadakh1, IDS.ankan], [IDS.noteLadakh1, IDS.alice],
      [IDS.noteMumbai1, IDS.vansh], [IDS.noteMumbai1, IDS.ankan],
      [IDS.noteAlpha1, IDS.pooja], [IDS.noteAlpha1, IDS.ankan],
    ];
    for (const [noteId, userId] of noteFavs) {
      await client.query(
        `INSERT INTO note_favorites (note_id, user_id) VALUES ($1,$2)
         ON CONFLICT (note_id, user_id) DO NOTHING`,
        [noteId, userId],
      );
    }

    // ── 13. Polls ─────────────────────────────────────────────────────────────
    console.log('  Seeding polls…');

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

    await addPoll(IDS.pollGoa1, 'trip', IDS.goaTrip, IDS.alice,
      'Which beach should we base at?',
      ['Baga (North Goa — lively)', 'Palolem (South Goa — chill)', 'Anjuna (flea market + vibes)'],
      [['Baga (North Goa — lively)', [IDS.alice, IDS.charlie]], ['Palolem (South Goa — chill)', [IDS.eve]], ['Anjuna (flea market + vibes)', [IDS.bob]]],
    );

    await addPoll(IDS.pollGoa2, 'trip', IDS.goaTrip, IDS.bob,
      'Night out plan on Day 3?',
      ['Club Cubana (hillside, dress code)', "Tito's Lane bar hop", 'Bonfire at the villa'],
      [["Tito's Lane bar hop", [IDS.bob, IDS.charlie]], ['Bonfire at the villa', [IDS.alice, IDS.eve]]],
    );

    await addPoll(IDS.pollManali1, 'trip', IDS.manaliTrip, IDS.alice,
      'Which adventure activity for Day 4?',
      ['River Rafting — Beas Grade III', 'Paragliding — Solang Valley', 'Mountain biking — Old Manali trails'],
      [['River Rafting — Beas Grade III', [IDS.alice, IDS.frank]], ['Paragliding — Solang Valley', [IDS.charlie]]],
    );

    await addPoll(IDS.pollKerala1, 'trip', IDS.keralaTrip, IDS.bob,
      'What time to wake up for the houseboat sunrise?',
      ['5:30 AM (hardcore)', '6:00 AM (balanced)', '6:30 AM (civilised)'],
      [['5:30 AM (hardcore)', [IDS.alice]], ['6:00 AM (balanced)', [IDS.bob]], ['6:30 AM (civilised)', [IDS.diana]]],
    );

    await addPoll(IDS.pollUdaipur1, 'trip', IDS.udaipurTrip, IDS.bob,
      'Dinner venue for the last night?',
      ['Ambrai Ghat (lakeside, upscale)', 'Upre by 1559 AD (rooftop)', 'Natraj Dining Hall (local thali)'],
      [['Ambrai Ghat (lakeside, upscale)', [IDS.bob, IDS.alice, IDS.grace]], ['Upre by 1559 AD (rooftop)', [IDS.henry]]],
    );

    await addPoll(IDS.pollUdaipur2, 'trip', IDS.udaipurTrip, IDS.alice,
      'Optional day trip from Udaipur?',
      ['Chittorgarh Fort (90min drive)', 'Kumbhalgarh + Wolf Sanctuary', 'Ranakpur Jain Temples'],
      [['Chittorgarh Fort (90min drive)', [IDS.alice, IDS.henry]], ['Kumbhalgarh + Wolf Sanctuary', [IDS.bob, IDS.grace]]],
    );

    await addPoll(IDS.pollJaipur1, 'trip', IDS.jaipurTrip, IDS.bob,
      'Hot air balloon — yay or nay?',
      ['100% yes — bucket list!', 'Maybe, depends on weather', "Too early, I'll skip"],
      [['100% yes — bucket list!', [IDS.bob, IDS.charlie, IDS.frank]]],
    );

    await addPoll(IDS.pollDiwali1, 'event', IDS.diwaliEvent, IDS.alice,
      'Decoration theme for Diwali Night?',
      ['Traditional diyas and marigolds', 'Bollywood glam — gold and red', 'Minimalist — white and gold'],
      [['Traditional diyas and marigolds', [IDS.alice, IDS.charlie]], ['Bollywood glam — gold and red', [IDS.bob, IDS.eve]]],
    );

    await addPoll(IDS.pollNYE1, 'event', IDS.nyeEvent, IDS.bob,
      'Midnight toast — what are we drinking?',
      ['Chandon Brut (classic)', 'Sula Brut (local pride)', 'NA mocktail (inclusive)'],
      [['Chandon Brut (classic)', [IDS.bob, IDS.alice, IDS.grace]], ['Sula Brut (local pride)', [IDS.henry]]],
    );

    await addPoll(IDS.pollLadakh1, 'trip', IDS.ladakhTrip, IDS.vansh,
      'Rest day activity if weather blocks Khardung?',
      ['Leh palace + museum', 'Thiksey monastery half-day', 'Spa + momos at hotel'],
      [['Thiksey monastery half-day', [IDS.vansh, IDS.pooja]], ['Leh palace + museum', [IDS.ankan, IDS.alice]]],
    );

    await addPoll(IDS.pollRishi1, 'trip', IDS.rishikeshTrip, IDS.ankan,
      'Would we repeat this trip?',
      ['Yes — monsoon slot next', 'Yes — winter yoga week', 'New river next year'],
      [['Yes — monsoon slot next', [IDS.vansh, IDS.ankan, IDS.pooja]]],
    );

    await addPoll(IDS.pollMumbai1, 'trip', IDS.mumbaiTrip, IDS.pooja,
      'Next food zone to conquer?',
      ['Matunga Udupi breakfast crawl', 'Fort Irani + bun maska tour', 'Kala Ghoda dessert hop'],
      [['Fort Irani + bun maska tour', [IDS.pooja, IDS.bob]], ['Matunga Udupi breakfast crawl', [IDS.vansh, IDS.ankan]]],
    );

    await addPoll(IDS.pollCoorg1, 'trip', IDS.coorgTrip, IDS.vansh,
      'Optional add-on Sunday?',
      ['Nagarhole safari (early start)', 'Sleep in + estate brunch', 'Iruppu Falls trek'],
      [['Sleep in + estate brunch', [IDS.vansh, IDS.pooja, IDS.grace]], ['Nagarhole safari (early start)', [IDS.ankan]]],
    );

    await addPoll(IDS.pollAlpha1, 'event', IDS.alphaEvent, IDS.vansh,
      'After-party vibe?',
      ['Board games at Pooja\'s place', 'Karaoke rooftop', 'Call it — we are old'],
      [['Board games at Pooja\'s place', [IDS.vansh, IDS.ankan, IDS.pooja]], ['Karaoke rooftop', [IDS.alice]]],
    );

    // ── 14. Events ────────────────────────────────────────────────────────────
    console.log('  Seeding events…');

    assertListCardTitleLen('Diwali event', 'Diwali Night 2026');
    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'Diwali Night 2026','2026-10-20','Festival',
               'Annual GatherGo Diwali — fireworks, rangoli, DJ, and catered dinner on a Bandra rooftop. Ethnic dress. Arrive by 7PM for the diya-lighting ceremony.',
               'Bandra West, Mumbai',19.0596,72.8295,$2,
               'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=1600&q=80')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.diwaliEvent, IDS.alice],
    );

    assertListCardTitleLen('Holi event', 'Holi 2024');
    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'Holi 2024','2024-03-25','Festival',
               'The messiest, most colourful day of the year. Garden party, water guns, organic colours only. Brunch after. Wear clothes you do not mind ruining.',
               'Hauz Khas, New Delhi',28.5494,77.2001,$2,
               'https://images.unsplash.com/photo-1580136608263-f526cf971b99?auto=format&fit=crop&w=1600&q=80')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.holiEvent, IDS.alice],
    );

    assertListCardTitleLen('NYE event', 'NYE Party 2026');
    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'NYE Party 2026','2026-12-31','Party',
               'Rooftop countdown in Bandra — DJ Arjun, open bar till midnight, champagne pop at 12. Dress code: Glam or Formal. Limited to 40 guests. Entry Rs 500 includes welcome drink.',
               'Bandra West, Mumbai',19.0544,72.8406,$2,
               'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=1600')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.nyeEvent, IDS.bob],
    );

    assertListCardTitleLen('Pune meetup event', 'Pune Tech Meet May');
    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'Pune Tech Meet May','2026-05-15','Networking',
               'Founders, builders, and curious minds. Coffee, 15min talks, open networking. 4 speakers confirmed. No slides-only talks. Koregaon Park — walkable from most hotels.',
               'Koregaon Park, Pune',18.5362,73.8939,$2,
               'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80')
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.meetupEvent, IDS.bob],
    );

    assertListCardTitleLen('Alpha reunion event', 'Alpha Reunion Aug');
    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'Alpha Reunion Aug','2026-08-22','Party',
               'GatherGo alpha crew catch-up — rooftop dinner, inside jokes, and a real product feedback circle. Partners welcome.',
               'Lower Parel, Mumbai',18.9983,72.8277,$2,$3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.alphaEvent, IDS.vansh, PH.alphaRooftop],
    );

    assertListCardTitleLen('Board game night', 'Board Game Night');
    await client.query(
      `INSERT INTO events (id, name, event_date, event_type, description, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1,'Board Game Night','2026-09-12','Social',
               'Euro games, chai, and chaos at Pooja’s. BYO snacks. Catan + Azul + secret third game TBD.',
               'Bandra West, Mumbai',19.0544,72.8406,$2,$3)
       ON CONFLICT (id) DO UPDATE SET banner_image_url = EXCLUDED.banner_image_url`,
      [IDS.boardEvent, IDS.pooja, PH.boardGames],
    );

    // ── 14a. Event members ────────────────────────────────────────────────────
    console.log('  Seeding event members…');
    const eventMembers = [
      [IDS.diwaliEvent, IDS.alice,   'admin'],
      [IDS.diwaliEvent, IDS.bob,     'member'],
      [IDS.diwaliEvent, IDS.charlie, 'member'],
      [IDS.diwaliEvent, IDS.eve,     'member'],
      [IDS.holiEvent,   IDS.alice,   'admin'],
      [IDS.holiEvent,   IDS.charlie, 'member'],
      [IDS.holiEvent,   IDS.diana,   'member'],
      [IDS.nyeEvent,    IDS.bob,     'admin'],
      [IDS.nyeEvent,    IDS.alice,   'member'],
      [IDS.nyeEvent,    IDS.grace,   'member'],
      [IDS.nyeEvent,    IDS.henry,   'member'],
      [IDS.meetupEvent, IDS.bob,     'admin'],
      [IDS.meetupEvent, IDS.alice,   'member'],
      [IDS.meetupEvent, IDS.frank,   'member'],
      [IDS.meetupEvent, IDS.henry,   'member'],
      [IDS.alphaEvent,  IDS.vansh,   'admin'],
      [IDS.alphaEvent,  IDS.ankan,   'member'],
      [IDS.alphaEvent,  IDS.pooja,   'member'],
      [IDS.alphaEvent,  IDS.alice,   'member'],
      [IDS.boardEvent,  IDS.pooja,   'admin'],
      [IDS.boardEvent,  IDS.vansh,   'member'],
      [IDS.boardEvent,  IDS.ankan,   'member'],
    ];
    for (const [eventId, userId, role] of eventMembers) {
      await client.query(
        `INSERT INTO event_members (event_id, user_id, role) VALUES ($1,$2,$3)
         ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [eventId, userId, role],
      );
    }

    // ── 14b. Event invite tokens ──────────────────────────────────────────────
    console.log('  Seeding event invite tokens…');
    await client.query(
      `INSERT INTO event_invites (id, event_id, invited_by, email, token, expires_at)
       VALUES ('ea000000-0000-4000-8000-000000000001',$1,$2,'guest1@example.com','diwali-event-invite-seed-token-001',NOW() + INTERVAL '7 days'),
              ('ea000000-0000-4000-8000-000000000002',$3,$4,'guest2@example.com','nye-event-invite-seed-token-001',   NOW() + INTERVAL '7 days')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.diwaliEvent, IDS.alice, IDS.nyeEvent, IDS.bob],
    );

    // ── 14c. Event reminders ──────────────────────────────────────────────────
    console.log('  Seeding event reminders…');
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES
       ($1,'event_start','2026-10-20T01:30:00Z'), ($1,'1_day_before','2026-10-19T01:30:00Z')`,
      [IDS.diwaliEvent],
    );
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES
       ($1,'event_start','2026-12-31T18:30:00Z'), ($1,'1_day_before','2026-12-30T18:30:00Z')`,
      [IDS.nyeEvent],
    );
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES
       ($1,'event_start','2026-05-15T04:30:00Z'), ($1,'1_day_before','2026-05-14T04:30:00Z')`,
      [IDS.meetupEvent],
    );
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES
       ($1,'event_start','2026-08-22T13:30:00Z'), ($1,'1_day_before','2026-08-21T13:30:00Z')`,
      [IDS.alphaEvent],
    );
    await client.query(
      `INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES
       ($1,'event_start','2026-09-12T13:30:00Z'), ($1,'1_day_before','2026-09-11T13:30:00Z')`,
      [IDS.boardEvent],
    );

    // ── 14d. Event expenses ───────────────────────────────────────────────────
    console.log('  Seeding event expenses…');

    await addExp(IDS.expDiwali1, 'event', IDS.diwaliEvent, 'Venue + Catering', 16000, 'general', IDS.alice, 'equal');
    for (const uid of [IDS.alice, IDS.bob, IDS.charlie, IDS.eve]) await addSplit(IDS.expDiwali1, uid, 4000);

    await addExp(IDS.expDiwali2, 'event', IDS.diwaliEvent, 'DJ + Sound System', 8000, 'entertainment', IDS.bob, 'equal');
    for (const uid of [IDS.alice, IDS.bob, IDS.charlie, IDS.eve]) await addSplit(IDS.expDiwali2, uid, 2000);

    await addExp(IDS.expNYE1, 'event', IDS.nyeEvent, 'Rooftop Venue Booking', 20000, 'general', IDS.bob, 'equal');
    for (const uid of [IDS.bob, IDS.alice, IDS.grace, IDS.henry]) await addSplit(IDS.expNYE1, uid, 5000);

    await addExp(IDS.expAlpha1, 'event', IDS.alphaEvent, 'Catering + decor', 12000, 'food', IDS.vansh, 'equal');
    for (const uid of [IDS.vansh, IDS.ankan, IDS.pooja, IDS.alice]) await addSplit(IDS.expAlpha1, uid, 3000);

    await addExp(IDS.expBoard1, 'event', IDS.boardEvent, 'Snacks + soft drinks', 4000, 'food', IDS.pooja, 'equal');
    for (const [uid, amt] of [[IDS.pooja, 1334], [IDS.vansh, 1333], [IDS.ankan, 1333]]) await addSplit(IDS.expBoard1, uid, amt);

    // ── 15. Trip reminders ────────────────────────────────────────────────────
    console.log('  Seeding trip reminders…');
    const reminders = [
      [IDS.goaTrip,     'trip_start',    '2027-04-10T03:30:00Z'],
      [IDS.goaTrip,     '1_day_before',  '2027-04-09T03:30:00Z'],
      [IDS.goaTrip,     '1_week_before', '2027-04-03T03:30:00Z'],
      [IDS.udaipurTrip, 'trip_start',    '2026-12-05T03:30:00Z'],
      [IDS.udaipurTrip, '1_day_before',  '2026-12-04T03:30:00Z'],
      [IDS.udaipurTrip, '1_week_before', '2026-11-28T03:30:00Z'],
      [IDS.ladakhTrip, 'trip_start', '2026-06-05T03:30:00Z'],
      [IDS.ladakhTrip, '1_day_before', '2026-06-04T03:30:00Z'],
      [IDS.ladakhTrip, '1_week_before', '2026-05-29T03:30:00Z'],
      [IDS.mumbaiTrip, 'trip_start', '2026-01-15T03:30:00Z'],
      [IDS.coorgTrip, 'trip_start', '2026-07-04T03:30:00Z'],
      [IDS.coorgTrip, '1_day_before', '2026-07-03T03:30:00Z'],
    ];
    for (const [tripId, type, scheduledAt] of reminders) {
      await client.query(
        `INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at) VALUES ($1,$2,$3)`,
        [tripId, type, scheduledAt],
      );
    }

    await client.query('COMMIT');

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n✅  Seed complete!\n');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  TWO PRIMARY LOGINS  —  Password: TestPass123!');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log(`  PRIMARY 1  alice   test@gathergo.com   @alice_gg   ${IDS.alice}`);
    console.log(`  PRIMARY 2  bob     bob@gathergo.com    @bob_gg     ${IDS.bob}`);
    console.log('');
    console.log('  Supporting (same password):');
    console.log(`  charlie  charlie@gathergo.com  ${IDS.charlie}`);
    console.log(`  diana    diana@gathergo.com    ${IDS.diana}`);
    console.log(`  eve      eve@gathergo.com      ${IDS.eve}`);
    console.log(`  frank    frank@gathergo.com    ${IDS.frank}`);
    console.log(`  grace    grace@gathergo.com    ${IDS.grace}`);
    console.log(`  henry    henry@gathergo.com    ${IDS.henry}`);
    console.log('  Alpha (password GatherrGo123!):');
    console.log(`  vansh    vanshahuja318@gmail.com   age 24   ${IDS.vansh}`);
    console.log(`  ankan    Hello@GatherrGo.com        age 32   ${IDS.ankan}`);
    console.log(`  pooja    poojadevrari07@gmail.com   age 21   ${IDS.pooja}`);
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  TRIPS');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log(`  UPCOMING  alice admin  Goa Trip 2027             ${IDS.goaTrip}`);
    console.log(`  UPCOMING  bob admin    Udaipur Royal Wknd        ${IDS.udaipurTrip}`);
    console.log(`  ONGOING   alice admin  Manali Winter 2026        ${IDS.manaliTrip}`);
    console.log(`  PAST      alice admin  Kerala Backwaters         ${IDS.keralaTrip}`);
    console.log(`  PAST      bob admin    Jaipur Heritage           ${IDS.jaipurTrip}`);
    console.log(`  ARCHIVED  alice admin  Kasol Trek 2025           ${IDS.kasolTrip}`);
    console.log(`  UPCOMING  vansh admin  Ladakh Bike June          ${IDS.ladakhTrip}`);
    console.log(`  UPCOMING  vansh admin  Coorg Coffee Wknd         ${IDS.coorgTrip}`);
    console.log(`  ONGOING   pooja admin  Mumbai Food Crawl         ${IDS.mumbaiTrip}`);
    console.log(`  PAST      ankan admin  Rishikesh Rafting         ${IDS.rishikeshTrip}`);
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  EVENTS');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log(`  UPCOMING  alice admin  Diwali Night 2026         ${IDS.diwaliEvent}`);
    console.log(`  UPCOMING  bob admin    NYE Party 2026            ${IDS.nyeEvent}`);
    console.log(`  UPCOMING  bob admin    Pune Tech Meet May        ${IDS.meetupEvent}`);
    console.log(`  PAST      alice admin  Holi 2024                 ${IDS.holiEvent}`);
    console.log(`  UPCOMING  vansh admin  Alpha Reunion Aug         ${IDS.alphaEvent}`);
    console.log(`  UPCOMING  pooja admin  Board Game Night          ${IDS.boardEvent}`);
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  INVITE TOKENS');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  alice-friend-invite-token-001          (friend invite from alice)');
    console.log('  bob-friend-invite-token-001            (friend invite from bob)');
    console.log('  goa-trip-invite-seed-token-001         (Goa trip invite)');
    console.log('  udaipur-trip-invite-seed-token-001     (Udaipur trip invite)');
    console.log('  diwali-event-invite-seed-token-001     (Diwali event invite)');
    console.log('  nye-event-invite-seed-token-001        (NYE event invite)');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  FRIEND STATES (as alice)');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  bob, charlie, diana, eve, frank, grace  →  accepted');
    console.log('  henry  →  pending (henry sent to alice — alice can accept)');
    console.log('══════════════════════════════════════════════════════════════════\n');

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
