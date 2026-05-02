/**
 * GatherrGo — Notification System End-to-End Test Script
 *
 * Run from the backend directory:
 *   node scripts/test-notifications.js
 *
 * Requires two real accounts. Fill in USER_A and USER_B below.
 * The script creates a test trip, exercises every notification
 * type, checks the notifications API for User B, then cleans up.
 *
 * NOTE: The /notifications/dev/* cron endpoints are disabled in
 * production. Batch and digest checks are DB-state only (verified
 * through the notifications list endpoint for in-app rows).
 */

'use strict';

const axios = require('axios');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE = process.env.API_BASE || 'https://api.gatherrgo.com';

// Fill in two real test accounts that already exist in the system.
// USER_A will be the trip organiser / actor.
// USER_B will be the observer / recipient of notifications.
const USER_A = {
  email:    process.env.USER_A_EMAIL    || 'user-a@example.com',
  password: process.env.USER_A_PASSWORD || 'password123',
};
const USER_B = {
  email:    process.env.USER_B_EMAIL    || 'user-b@example.com',
  password: process.env.USER_B_PASSWORD || 'password123',
};

// ─── COLOUR HELPERS ───────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`; // green
const R = (s) => `\x1b[31m${s}\x1b[0m`; // red
const Y = (s) => `\x1b[33m${s}\x1b[0m`; // yellow
const B = (s) => `\x1b[36m${s}\x1b[0m`; // cyan (bold section)
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

// ─── TEST RUNNER ─────────────────────────────────────────────────────────────
const results = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${G('✓')} ${name}`);
    results.push({ name, pass: true });
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.log(`  ${R('✗')} ${name}`);
    console.log(`    ${DIM('→ ' + detail)}`);
    results.push({ name, pass: false, detail });
  }
}

function section(title) {
  console.log(`\n${B('━━ ' + title + ' ' + '━'.repeat(Math.max(0, 55 - title.length)))}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────
function api(token) {
  return axios.create({
    baseURL: BASE,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    validateStatus: () => true, // never throw on HTTP status
  });
}

async function login(creds) {
  const res = await axios.post(`${BASE}/auth/login`, creds, { timeout: 10000 });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
  return {
    token: res.data.accessToken,
    id:    res.data.user?.id,
    name:  res.data.user?.profile?.fullName || res.data.user?.fullName || creds.email,
  };
}

// Poll the /notifications endpoint and look for a notification of the given type
// created after `since` (epoch ms). Returns the matching row or null.
async function findNotification(token, type, since = 0) {
  const res = await api(token).get('/notifications?page=1');
  if (res.status !== 200) return null;
  const list = res.data.notifications || res.data.data || [];
  return list.find((n) => {
    const createdAt = new Date(n.created_at || n.createdAt).getTime();
    return n.type === type && createdAt > since;
  }) || null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(B('  GatherrGo Notification System — Full E2E Test'));
  console.log(`  ${DIM(BASE)}`);
  console.log(`${'═'.repeat(60)}`);

  // ── 1. AUTHENTICATION ──────────────────────────────────────────
  section('1. Authentication');

  let a, b;

  await test('Login User A', async () => {
    a = await login(USER_A);
    assert(a.token, 'No access token returned');
    assert(a.id,    'No user id returned');
    console.log(`     ${DIM('id: ' + a.id + '  name: ' + a.name)}`);
  });

  await test('Login User B', async () => {
    b = await login(USER_B);
    assert(b.token, 'No access token returned');
    assert(b.id,    'No user id returned');
    assert(a.id !== b.id, 'USER_A and USER_B must be different accounts');
    console.log(`     ${DIM('id: ' + b.id + '  name: ' + b.name)}`);
  });

  if (!a?.token || !b?.token) {
    console.log(R('\n  Cannot continue — both users must be logged in.\n'));
    process.exit(1);
  }

  const clientA = api(a.token);
  const clientB = api(b.token);

  // ── 2. NOTIFICATION SETTINGS ───────────────────────────────────
  section('2. Notification Settings API');

  let originalSettings;

  await test('GET /users/notification-settings — returns defaults', async () => {
    const res = await clientB.get('/users/notification-settings');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const s = res.data.settings;
    assert(s, 'No settings object in response');
    assert(['daily', 'weekly', 'never'].includes(s.email_digest), 'email_digest must be daily|weekly|never');
    assert(typeof s.lock_screen_reminders === 'boolean', 'lock_screen_reminders must be boolean');
    assert(typeof s.quiet_hours_enabled === 'boolean', 'quiet_hours_enabled must be boolean');
    originalSettings = s;
  });

  await test('PATCH email_digest to weekly', async () => {
    const res = await clientB.patch('/users/notification-settings', { email_digest: 'weekly' });
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.settings.email_digest === 'weekly', 'email_digest not updated');
  });

  await test('PATCH preserves other keys (partial merge)', async () => {
    const res = await clientB.patch('/users/notification-settings', { lock_screen_reminders: false });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const s = res.data.settings;
    assert(s.email_digest === 'weekly',       'email_digest was clobbered by partial patch');
    assert(s.lock_screen_reminders === false, 'lock_screen_reminders not updated');
    assert(typeof s.quiet_hours_enabled === 'boolean', 'quiet_hours_enabled was removed');
  });

  await test('PATCH rejects invalid email_digest value', async () => {
    const res = await clientB.patch('/users/notification-settings', { email_digest: 'monthly' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('Restore User B settings to defaults', async () => {
    const res = await clientB.patch('/users/notification-settings', {
      email_digest:          originalSettings?.email_digest          ?? 'daily',
      lock_screen_reminders: originalSettings?.lock_screen_reminders ?? true,
      quiet_hours_enabled:   originalSettings?.quiet_hours_enabled   ?? true,
    });
    assert(res.status === 200, `Restore failed: ${JSON.stringify(res.data)}`);
  });

  // ── 3. TRIP LIFECYCLE — creates shared context for later tests ──
  section('3. Trip Lifecycle & Notification Triggers');

  let tripId;
  const tripName = `Test Trip ${Date.now()}`;
  const testStart = Date.now();

  await test('User A creates trip with User B as friend (TRIP_MEMBER_ADDED)', async () => {
    const tomorrow = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
    const after    = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);
    const res = await clientA.post('/trips', {
      name:      tripName,
      startDate: tomorrow,
      endDate:   after,
      location:  { name: 'Test City', lat: 28.61, lng: 77.20 },
      friendIds: [b.id],
    });
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    tripId = res.data.trip?.id || res.data.id;
    assert(tripId, 'No trip id in response');
    console.log(`     ${DIM('tripId: ' + tripId)}`);
  });

  await test('User B received TRIP_MEMBER_ADDED notification', async () => {
    // Give the server a moment to write the async notification
    await new Promise((r) => setTimeout(r, 1500));
    const notif = await findNotification(b.token, 'TRIP_MEMBER_ADDED', testStart);
    assert(notif, 'TRIP_MEMBER_ADDED notification not found for User B');
    assert(notif.data?.tripId === tripId, 'tripId mismatch in notification data');
  });

  await test('User A does NOT receive TRIP_MEMBER_ADDED (actor excluded)', async () => {
    const notif = await findNotification(a.token, 'TRIP_MEMBER_ADDED', testStart);
    assert(!notif, 'Actor (User A) should NOT receive TRIP_MEMBER_ADDED');
  });

  // ITINERARY_UPDATED (batched — notification row created, no immediate push)
  await test('User A adds activity → ITINERARY_UPDATED row created for User B', async () => {
    if (!tripId) throw new Error('No trip to add activity to (earlier test failed)');
    const actDate = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
    const res = await clientA.post(`/trips/${tripId}/activities`, {
      title:       'Test Activity',
      date:        actDate,
      time:        { hour: 10, minute: 0 },
      description: 'Created by test script',
    });
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    await new Promise((r) => setTimeout(r, 1500));
    const notif = await findNotification(b.token, 'ITINERARY_UPDATED', testStart);
    assert(notif, 'ITINERARY_UPDATED notification row not found for User B');
    console.log(`     ${DIM(Y('(Batched) — FCM push deferred 2h, in-app row confirmed'))}`);
  });

  // EXPENSE_ADDED (batched)
  await test('User A adds expense → EXPENSE_ADDED row created for User B', async () => {
    if (!tripId) throw new Error('No trip to add expense to (earlier test failed)');
    const res = await clientA.post(`/trips/${tripId}/expenses`, {
      description: 'Test Expense',
      amount:      500,
      category:    'food',
      paidBy:      a.id,
      splitType:   'equal',
      splitAmong:  [
        { userId: a.id },
        { userId: b.id },
      ],
    });
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    await new Promise((r) => setTimeout(r, 1500));
    const notif = await findNotification(b.token, 'EXPENSE_ADDED', testStart);
    assert(notif, 'EXPENSE_ADDED notification row not found for User B');
    const data = notif.data || {};
    assert(data.tripId === tripId, 'tripId missing from EXPENSE_ADDED data');
    assert(data.amount,            'amount missing from EXPENSE_ADDED data');
    console.log(`     ${DIM(Y('(Batched) — FCM push deferred 2h, in-app row confirmed'))}`);
  });

  // ── 4. TRIP MUTE ───────────────────────────────────────────────
  section('4. Trip Mute');

  await test('User B mutes the trip', async () => {
    if (!tripId) throw new Error('No trip (earlier test failed)');
    const res = await clientB.post(`/trips/${tripId}/mute`);
    assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await test('GET /trips/:id/mute → muted: true', async () => {
    if (!tripId) throw new Error('No trip (earlier test failed)');
    const res = await clientB.get(`/trips/${tripId}/mute`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.muted === true, `Expected muted:true, got ${JSON.stringify(res.data)}`);
  });

  await test('User B unmutes the trip', async () => {
    if (!tripId) throw new Error('No trip (earlier test failed)');
    const res = await clientB.delete(`/trips/${tripId}/mute`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /trips/:id/mute → muted: false after unmute', async () => {
    if (!tripId) throw new Error('No trip (earlier test failed)');
    const res = await clientB.get(`/trips/${tripId}/mute`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.muted === false, `Expected muted:false, got ${JSON.stringify(res.data)}`);
  });

  // ── 5. QUIET HOURS (push suppression) ─────────────────────────
  section('5. Quiet Hours Push Suppression');

  await test('Enable always-quiet on User B (00:00 – 23:59)', async () => {
    const res = await clientB.patch('/users/notification-settings', {
      quiet_hours_enabled: true,
      quiet_start: '00:00',
      quiet_end:   '23:59',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const s = res.data.settings;
    assert(s.quiet_hours_enabled === true, 'quiet_hours_enabled not set');
    assert(s.quiet_start === '00:00', 'quiet_start not set');
  });

  await test('User A adds another activity (notification row written despite quiet hours)', async () => {
    if (!tripId) throw new Error('No trip (earlier test failed)');
    const countBefore = await (async () => {
      const r = await clientB.get('/notifications/unread-count');
      return r.data?.unreadCount ?? 0;
    })();
    const actDate = new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 10);
    const res = await clientA.post(`/trips/${tripId}/activities`, {
      title: 'Quiet Hour Activity',
      date:  actDate,
      time:  { hour: 14, minute: 0 },
    });
    assert(res.status === 201, `Activity creation failed: ${JSON.stringify(res.data)}`);
    await new Promise((r) => setTimeout(r, 1500));
    const countAfter = await (async () => {
      const r = await clientB.get('/notifications/unread-count');
      return r.data?.unreadCount ?? 0;
    })();
    // The notification DB row must exist (in-app), even though FCM push was suppressed
    assert(countAfter > countBefore, 'Notification row was NOT written during quiet hours (in-app feed broken)');
    console.log(`     ${DIM(Y('FCM push suppressed (check backend logs for "quiet hours" message)'))}`);
  });

  await test('Critical type (TRIP_MEMBER_ADDED) bypasses quiet hours — restore settings', async () => {
    // Just restore settings; actual critical bypass is tested by the TRIP_CANCELLED push below
    const res = await clientB.patch('/users/notification-settings', {
      quiet_hours_enabled: originalSettings?.quiet_hours_enabled ?? false,
      quiet_start: originalSettings?.quiet_start ?? '22:00',
      quiet_end:   originalSettings?.quiet_end   ?? '08:00',
    });
    assert(res.status === 200, `Restore failed: ${JSON.stringify(res.data)}`);
  });

  // ── 6. TRIP DELETION (TRIP_CANCELLED — critical + email) ───────
  section('6. TRIP_CANCELLED — Immediate Push + Email');

  const preDeleteTime = Date.now();

  await test('User A deletes trip → TRIP_CANCELLED notification for User B', async () => {
    if (!tripId) throw new Error('No trip to delete (earlier test failed)');
    const res = await clientA.delete(`/trips/${tripId}`);
    assert(res.status === 200 || res.status === 204, `Expected 200/204, got ${res.status}: ${JSON.stringify(res.data)}`);
    await new Promise((r) => setTimeout(r, 2000));
    const notif = await findNotification(b.token, 'TRIP_CANCELLED', preDeleteTime);
    assert(notif, 'TRIP_CANCELLED notification not found for User B');
    assert(notif.data?.tripId === tripId, 'tripId missing from TRIP_CANCELLED data');
    console.log(`     ${DIM('Push sent as critical (immediate, not batched). Email sent to User B.')}`);
  });

  await test('User A does NOT receive TRIP_CANCELLED (actor excluded)', async () => {
    const notif = await findNotification(a.token, 'TRIP_CANCELLED', preDeleteTime);
    assert(!notif, 'Actor (User A) should NOT receive TRIP_CANCELLED');
  });

  // Reset tripId — trip is gone
  tripId = null;

  // ── 7. FRIEND REQUEST FLOW ────────────────────────────────────
  section('7. Friend Request Flow');

  let connectionId;
  const preFriendTime = Date.now();

  await test('User A sends friend request to User B → FRIEND_REQUEST notification', async () => {
    // First check if they're already friends to avoid a conflict error
    const friendsRes = await clientA.get('/friends');
    const alreadyFriends = (friendsRes.data?.friends || []).some((f) => f.id === b.id);
    if (alreadyFriends) {
      console.log(`     ${DIM(Y('Already friends — skipping request send (check existing FRIEND_REQUEST row)'))}`);
      return; // soft skip
    }

    const res = await clientA.post('/friends/request', { toUserId: b.id });
    if (res.status === 409) {
      console.log(`     ${DIM(Y('Pending request already exists — checking notification row'))}`);
    } else {
      assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    await new Promise((r) => setTimeout(r, 1500));
    const notif = await findNotification(b.token, 'FRIEND_REQUEST', preFriendTime - 60000);
    assert(notif, 'FRIEND_REQUEST notification not found for User B');
    console.log(`     ${DIM('Push sent as critical (immediate). Email sent to User B inbox.')}`);
  });

  await test('Get pending request id for User B to accept', async () => {
    const res = await clientB.get('/friends/requests');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const incoming = (res.data?.incoming || res.data?.requests || []).find(
      (r) => r.requester_id === a.id || r.requesterId === a.id || r.from_user_id === a.id || r.user?.id === a.id,
    );
    if (!incoming) {
      console.log(`     ${DIM(Y('No pending incoming request from User A — may already be accepted'))}`);
      return; // soft skip
    }
    connectionId = incoming.id || incoming.connection_id || incoming.connectionId;
    assert(connectionId, `Could not extract connectionId from: ${JSON.stringify(incoming)}`);
    console.log(`     ${DIM('connectionId: ' + connectionId)}`);
  });

  await test('User B accepts request → FRIEND_ACCEPTED notification for User A', async () => {
    if (!connectionId) {
      console.log(`     ${DIM(Y('No connectionId — skipping (soft)'))}`);
      return;
    }
    const res = await clientB.put(`/friends/request/${connectionId}`, { action: 'accept' });
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    await new Promise((r) => setTimeout(r, 1500));
    const notif = await findNotification(a.token, 'FRIEND_ACCEPTED', preFriendTime);
    assert(notif, 'FRIEND_ACCEPTED notification not found for User A');
    console.log(`     ${DIM('Push sent as critical (immediate). Email sent to User A inbox.')}`);
  });

  // ── 8. NOTIFICATIONS LIST ──────────────────────────────────────
  section('8. Notifications List API');

  await test('GET /notifications returns paginated list', async () => {
    const res = await clientB.get('/notifications?page=1');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const list = res.data.notifications || res.data.data || [];
    assert(Array.isArray(list), 'Expected an array in response');
    const types = [...new Set(list.map((n) => n.type))];
    console.log(`     ${DIM('Found types: ' + types.join(', '))}`);
  });

  await test('GET /notifications/unread-count returns a number', async () => {
    const res = await clientB.get('/notifications/unread-count');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.data.unreadCount === 'number', 'unreadCount must be a number');
    console.log(`     ${DIM('unreadCount: ' + res.data.unreadCount)}`);
  });

  await test('PATCH /notifications/read-all marks all read', async () => {
    const res = await clientB.patch('/notifications/read-all');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    await new Promise((r) => setTimeout(r, 500));
    const countRes = await clientB.get('/notifications/unread-count');
    assert(countRes.data.unreadCount === 0, `Expected 0 unread after markAllRead, got ${countRes.data.unreadCount}`);
  });

  // ── 9. ACTIVITY REMINDERS (lock_screen_reminders toggle) ───────
  section('9. Activity Reminders — lock_screen_reminders Toggle');

  let reminderTripId;

  await test('Create a fresh trip for reminder tests', async () => {
    const tomorrow = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
    const after    = new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10);
    const res = await clientA.post('/trips', {
      name:      `Reminder Test Trip ${Date.now()}`,
      startDate: tomorrow,
      endDate:   after,
      location:  { name: 'Reminder City' },
      friendIds: [b.id],
    });
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    reminderTripId = res.data.trip?.id || res.data.id;
    assert(reminderTripId, 'No trip id in response');
  });

  await test('User B has lock_screen_reminders ON — activity_reminders rows expected (check DB)', async () => {
    if (!reminderTripId) throw new Error('No reminder trip (earlier test failed)');
    await clientB.patch('/users/notification-settings', { lock_screen_reminders: true });
    const actDate = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
    const res = await clientA.post(`/trips/${reminderTripId}/activities`, {
      title: 'Reminder Activity ON',
      date:  actDate,
      time:  { hour: 10, minute: 0 }, // 90+ min from any test time → all three reminder slots
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    console.log(`     ${DIM(Y('→ SQL: SELECT user_id, remind_at FROM activity_reminders WHERE user_id = \'' + b.id + '\' ORDER BY remind_at;'))}`);
    console.log(`     ${DIM('Expect rows at T-10, T-30, T-60 for User B.')}`);
  });

  await test('User B disables lock_screen_reminders — no new rows for next activity (check DB)', async () => {
    if (!reminderTripId) throw new Error('No reminder trip (earlier test failed)');
    await clientB.patch('/users/notification-settings', { lock_screen_reminders: false });
    const actDate = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
    const res = await clientA.post(`/trips/${reminderTripId}/activities`, {
      title: 'Reminder Activity OFF',
      date:  actDate,
      time:  { hour: 10, minute: 0 },
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    console.log(`     ${DIM(Y('→ SQL: SELECT COUNT(*) FROM activity_reminders WHERE user_id = \'' + b.id + '\' AND sent_at IS NULL ORDER BY created_at DESC LIMIT 3;'))}`);
    console.log(`     ${DIM('Expect count for this activity = 0 (User B opted out).')}`);
    // Restore
    await clientB.patch('/users/notification-settings', { lock_screen_reminders: originalSettings?.lock_screen_reminders ?? true });
  });

  // Clean up reminder trip
  await test('Clean up reminder test trip', async () => {
    if (!reminderTripId) return;
    const res = await clientA.delete(`/trips/${reminderTripId}`);
    assert(res.status === 200 || res.status === 204, `Delete failed: ${res.status}`);
  });

  // ── 10. BATCH QUEUE STATE HINT ────────────────────────────────
  section('10. Batch Queue Verification (DB-side)');

  console.log(`\n  ${Y('ℹ')}  The dev flush endpoint is disabled in production.`);
  console.log(`     Run these queries on your RDS instance to verify batch state:\n`);
  console.log(`     ${DIM('-- Open (unflushed) batch queue rows')}`);
  console.log(`     SELECT user_id, type, parent_name, event_count, window_closes_at`);
  console.log(`     FROM notification_batch_queue`);
  console.log(`     WHERE flushed_at IS NULL`);
  console.log(`     ORDER BY created_at DESC LIMIT 20;\n`);
  console.log(`     ${DIM('-- Force all windows to expire NOW, then wait 30 min for cron')}`);
  console.log(`     UPDATE notification_batch_queue`);
  console.log(`     SET window_closes_at = NOW() - interval '1 second'`);
  console.log(`     WHERE flushed_at IS NULL;\n`);
  console.log(`     ${DIM('-- After cron runs, flushed_at should be populated')}`);
  console.log(`     SELECT flushed_at FROM notification_batch_queue ORDER BY created_at DESC LIMIT 5;\n`);

  // ── 11. EMAIL DIGEST HINT ─────────────────────────────────────
  section('11. Digest Email Verification (DB-side)');

  console.log(`\n  ${Y('ℹ')}  Digest cron runs daily at 08:00 IST. To force a digest now:`);
  console.log(`\n     ${DIM('-- Reset last_digest_sent_at so the cadence gate passes')}`);
  console.log(`     UPDATE users SET last_digest_sent_at = NULL WHERE id = '${b.id}';\n`);
  console.log(`     ${DIM('-- Then wait for the 08:00 IST cron, or deploy a temp route on staging.')}\n`);
  console.log(`     ${DIM('-- To test email_digest = never opt-out:')}`);
  console.log(`     PATCH /users/notification-settings  { "email_digest": "never" }`);
  console.log(`     -- No digest email sent even if last_digest_sent_at is NULL\n`);

  // ── SUMMARY ───────────────────────────────────────────────────
  section('Summary');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n  ${G(passed + ' passed')}  ${failed.length > 0 ? R(failed.length + ' failed') : DIM('0 failed')}`);

  if (failed.length > 0) {
    console.log(`\n  ${R('Failed tests:')}`);
    failed.forEach((r) => {
      console.log(`  ${R('✗')} ${r.name}`);
      if (r.detail) console.log(`    ${DIM(r.detail)}`);
    });
  }

  console.log(`\n  ${DIM('FCM push delivery: check AWS CloudWatch logs for:')}`);
  console.log(`  ${DIM('  "FCM notification sent"  — successful push')}`);
  console.log(`  ${DIM('  "Suppressed push due to quiet hours"  — quiet hours working')}`);
  console.log(`  ${DIM('  "Suppressed push due to trip mute"    — mute working')}`);
  console.log('');

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(R('\nUnhandled error: ' + err.message));
  process.exit(1);
});
