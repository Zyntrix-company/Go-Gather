# GatherrGo Notification Implementation — Prompt-by-Prompt Build Guide

**Version:** 1.0  
**Strategy doc:** `docs/notification-context.md` (architecture) + GatherrGo Notification Strategy v1.0  
**Total phases:** 8 prompts → manual test → acceptance gate → next prompt

---

## How to use this file

1. Copy the **Prompt** block into Claude exactly as written.
2. Review the diff Claude produces — do not approve blindly.
3. Run every step in **Manual Testing**.
4. Verify every item in **Acceptance Criteria** before moving on.
5. If anything fails → fix in the same phase, do not proceed.

---

## Quick reference — notification type master list

| Type key | Tab | Lock Screen | Email |
|---|---|---|---|
| `FRIEND_REQUEST` | Requests | Immediate | Immediate |
| `FRIEND_ACCEPTED` | Requests | Immediate | Immediate |
| `TRIP_MEMBER_ADDED` | Requests | Immediate | Immediate |
| `EVENT_MEMBER_ADDED` | Requests | Immediate | Immediate |
| `TRIP_INVITE_ACCEPTED` | Notifications | — | Daily digest |
| `EVENT_INVITE_ACCEPTED` | Notifications | — | Daily digest |
| `TRIP_CANCELLED` | Notifications | Immediate | Immediate |
| `ITINERARY_UPDATED` | Notifications | Batched (2h) | Daily digest |
| `DOCUMENT_UPLOADED` | Notifications | Batched (2h) | Daily digest |
| `EXPENSE_ADDED` | Notifications | Batched (2h) | Daily digest |
| `NEW_MEMBER_JOINED` | Notifications | — | Daily digest |
| `TRIP_MILESTONE` | Notifications | — | Daily digest |
| `TRIP_REMINDER` | Notifications | Scheduled | Daily digest |
| `EVENT_REMINDER` | Notifications | Scheduled | Daily digest |
| `ACTIVITY_REMINDER` | **Not shown** | Scheduled | — |

---

---

# PROMPT 1 — New Backend Notification Types

## Context to give Claude

> We are building the GatherrGo notification system. The backend already has `createAndSendNotification(userId, {title, body}, type, data)` and `createAndSendNotifications(users, {title, body}, type, data)` in `backend/src/utils/fcm.util.js`. Notifications are persisted to the `notifications` table (migration 021). The existing types are: WELCOME, FRIEND_REQUEST, FRIEND_ACCEPTED, TRIP_MEMBER_ADDED, TRIP_INVITE_ACCEPTED, TRIP_REMINDER, EVENT_MEMBER_ADDED, EVENT_INVITE_ACCEPTED, EVENT_REMINDER.

## Prompt

```
Add the following new notification triggers to the GatherrGo backend. Do not create new files — add to existing service files only. Do not change the fcm.util.js helpers.

New types to add:

1. TRIP_CANCELLED
   File: backend/src/modules/trips/trips.service.js
   Trigger: When a trip is deleted or cancelled (find the delete/cancel function).
   Recipients: All trip members EXCEPT the actor (the person cancelling).
   Title: "Trip Cancelled"
   Body: `"[Trip Name]" has been cancelled by the organiser.`
   Data: { tripId, tripName }

2. ITINERARY_UPDATED
   File: backend/src/modules/trips/submodules/activities/activities.service.js
   Trigger: When an activity is created OR updated in a trip.
   Recipients: All trip members EXCEPT the actor.
   Title: "Itinerary Updated"
   Body: `[Actor Name] added/updated an activity in "[Trip Name]".`
   Data: { tripId, tripName, activityId }

3. DOCUMENT_UPLOADED
   File: backend/src/modules/trips/submodules/docs/docs.service.js  
         backend/src/modules/events/events.service.js (for event docs)
   Trigger: When a document is uploaded to a trip or event.
   Recipients: All trip/event members EXCEPT the uploader.
   Title: "Document Added"
   Body: `[Actor Name] added a document to "[Trip/Event Name]".`
   Data: { tripId OR eventId, parentName }

4. EXPENSE_ADDED
   File: backend/src/modules/trips/submodules/expenses/expenses.service.js
   Trigger: When a new expense is created.
   Recipients: All trip members EXCEPT the expense creator.
   Title: "New Expense Added"
   Body: `[Actor Name] added an expense of [amount] [currency] to "[Trip Name]".`
   Data: { tripId, tripName, amount, currency }

5. NEW_MEMBER_JOINED
   File: backend/src/modules/trips/trips.service.js (invite link claim path)
         backend/src/modules/events/events.service.js (invite link claim path)
   Trigger: When a user joins via invite link (TRIP_INVITE_ACCEPTED / EVENT_INVITE_ACCEPTED paths — the admin already gets those; this is for the trip members collectively).
   Recipients: Trip/event admin only (already has TRIP_INVITE_ACCEPTED — skip, do NOT duplicate. Instead send NEW_MEMBER_JOINED to all OTHER members except the admin and the new joiner).
   Title: "New Member Joined"
   Body: `[New Member Name] joined "[Trip/Event Name]".`
   Data: { tripId OR eventId }

6. TRIP_MILESTONE
   File: backend/src/modules/trips/trips.service.js
   Trigger: When trip status changes to 'confirmed' or 'finalized' (look for status update logic).
   Recipients: All trip members.
   Title: "Trip Confirmed 🎉"
   Body: `"[Trip Name]" has been confirmed. You're going!`
   Data: { tripId, tripName }

For every new send, use createAndSendNotification (single) or createAndSendNotifications (batch). Fetch member lists the same way existing code in trips.service.js does (JOIN trip_members + users). Do not send to the actor — filter out req.user.id or the acting userId from recipient lists.
```

---

## Manual Testing — Prompt 1

### Setup
- Have at least 2 test user accounts (User A = organiser, User B = member).
- Both accounts registered with FCM tokens (logged in on device or emulator).
- Use a REST client (Postman / Bruno) or curl with JWT tokens for both users.

### Test cases

**T1.1 — TRIP_CANCELLED**
1. User A creates a trip with User B as member.
2. User A calls `DELETE /trips/:id` (or the cancel endpoint).
3. Check DB: `SELECT * FROM notifications WHERE type = 'TRIP_CANCELLED' AND user_id = '<User B id>';`
4. Expected: 1 row, title = "Trip Cancelled", body contains the trip name.
5. Expected: User B's device receives a push notification.
6. Expected: NO row with user_id = User A (actor excluded).

**T1.2 — ITINERARY_UPDATED**
1. User A and User B are in a trip.
2. User A calls `POST /trips/:id/activities` to add an activity.
3. DB check: `SELECT * FROM notifications WHERE type = 'ITINERARY_UPDATED' AND user_id = '<User B id>';`
4. Expected: 1 row, body mentions User A's name and the trip name.
5. Expected: User A has NO row (actor excluded).

**T1.3 — DOCUMENT_UPLOADED**
1. User A uploads a doc to a trip that also has User B.
2. DB check: `SELECT * FROM notifications WHERE type = 'DOCUMENT_UPLOADED' AND user_id = '<User B id>';`
3. Expected: 1 row.

**T1.4 — EXPENSE_ADDED**
1. User A adds an expense to the trip.
2. DB check: `SELECT * FROM notifications WHERE type = 'EXPENSE_ADDED' AND user_id = '<User B id>';`
3. Expected: 1 row, body includes amount + currency.

**T1.5 — NEW_MEMBER_JOINED**
1. User A creates a trip with invite link.
2. User C (new user) claims the invite link.
3. DB check: `SELECT * FROM notifications WHERE type = 'NEW_MEMBER_JOINED';`
4. Expected: rows for all original members EXCEPT admin (who gets TRIP_INVITE_ACCEPTED) and EXCEPT User C.

**T1.6 — TRIP_MILESTONE**
1. User A updates trip status to 'confirmed' (via PATCH /trips/:id or however status is updated).
2. DB check: `SELECT * FROM notifications WHERE type = 'TRIP_MILESTONE';`
3. Expected: rows for ALL members including User A (milestone is broadcast).

---

## Acceptance Criteria — Prompt 1

- [ ] All 6 new type strings appear in DB `notifications.type` when triggered
- [ ] Actor is excluded from all batch notifications (no self-notification)
- [ ] `data` JSONB column contains the correct IDs (tripId/eventId) for deep-link navigation
- [ ] No existing notification flows broken (FRIEND_REQUEST, TRIP_MEMBER_ADDED, reminders still work)
- [ ] No unhandled promise rejections in server logs when triggers fire
- [ ] FCM push received on device for at least TRIP_CANCELLED and EXPENSE_ADDED

---

---

# PROMPT 2 — Frontend: Notifications / Requests Tab Split

## Context to give Claude

> The current NotificationsScreen.tsx has All/Unread filter tabs. We need to replace this with Notifications and Requests tabs. Requests tab shows: FRIEND_REQUEST, TRIP_MEMBER_ADDED, EVENT_MEMBER_ADDED. Notifications tab shows everything else. The notificationStore.ts Zustand store is the source of data — do not change the store's fetch logic, only add a derived requestsUnreadCount selector. The existing card UI, unread dot, mark-read, and pagination must all be preserved in both tabs.

## Prompt

```
Refactor app/src/screens/main/NotificationsScreen.tsx to split into two tabs: "Notifications" and "Requests". Do not touch notificationStore.ts fetch logic or the API layer.

Requirements:

1. Tab bar
   Replace the current All/Unread filter row with two full-width tabs: "Notifications" and "Requests".
   Active tab has a bottom border indicator in #0d9488, inactive tab text is #64748b.
   Each tab title shows a small red badge count if there are unread items in that tab.

2. Routing types
   const REQUEST_TYPES = ['FRIEND_REQUEST', 'TRIP_MEMBER_ADDED', 'EVENT_MEMBER_ADDED'];
   Requests tab: notifications where type is in REQUEST_TYPES.
   Notifications tab: everything else.

3. Unread counts per tab
   Compute from the loaded notifications array:
   - notificationsUnread = notifications.filter(n => !n.read && !REQUEST_TYPES.includes(n.type)).length
   - requestsUnread = notifications.filter(n => !n.read && REQUEST_TYPES.includes(n.type)).length
   Show these in the tab badge (only show badge if count > 0).

4. "Mark all read" button
   Show in the active tab header only when that tab's unread count > 0.
   Calling markAllRead() clears the full list (existing behaviour — do not change).

5. Requests tab item UI
   For FRIEND_REQUEST: show a teal "Accept" button and a grey "Decline" button below the notification body. 
   These buttons should call navigation.navigate('FriendProfile', { userId: item.data?.userId, friendName: item.title }) on Accept for now (actual accept logic comes in a later phase). On press, also call markRead(item.id).
   For TRIP_MEMBER_ADDED / EVENT_MEMBER_ADDED: tapping the card navigates to TripDetail or EventDetail using item.data.tripId / item.data.eventId (same as existing behaviour).

6. Notifications tab
   Identical card UI to the existing implementation — no changes to the card layout.
   Pagination (onEndReached) works on this tab only.

7. Preserve existing navigation on tap
   TRIP_REMINDER / TRIP_MEMBER_ADDED → TripDetail
   EVENT_REMINDER / EVENT_MEMBER_ADDED → EventDetail
   FRIEND_REQUEST / FRIEND_ACCEPTED → no auto-navigate on card tap (only on Accept button)

Keep the BlobBackground, SafeAreaView, pull-to-refresh, and footer loader exactly as they are. Do not add any new dependencies.
```

---

## Manual Testing — Prompt 2

### Setup
- Have notifications of mixed types in the DB (seed manually via INSERT if needed):
  ```sql
  INSERT INTO notifications (user_id, type, title, body, data, read) VALUES
  ('<your-user-id>', 'FRIEND_REQUEST', 'John wants to connect', 'Tap to view', '{"userId":"abc"}', false),
  ('<your-user-id>', 'TRIP_MEMBER_ADDED', 'Added to Bali Trip', 'You were added', '{"tripId":"xyz"}', false),
  ('<your-user-id>', 'TRIP_CANCELLED', 'Trip Cancelled', 'Bali was cancelled', '{"tripId":"xyz"}', false),
  ('<your-user-id>', 'EXPENSE_ADDED', 'New Expense', 'John added ₹500', '{"tripId":"xyz"}', false);
  ```

### Test cases

**T2.1 — Tab switching**
1. Open the Notifications screen.
2. Verify two tabs: "Notifications" and "Requests".
3. Tap Requests — should show only FRIEND_REQUEST and TRIP_MEMBER_ADDED cards.
4. Tap Notifications — should show TRIP_CANCELLED and EXPENSE_ADDED cards (not the request types).

**T2.2 — Tab unread badges**
1. With unread items in both tabs, both tab titles show a red badge dot/count.
2. Mark one Requests item read → Requests badge decrements.
3. Mark all read → both badges disappear.

**T2.3 — Requests tab accept/decline buttons**
1. In Requests tab, FRIEND_REQUEST card shows "Accept" and "Decline" buttons.
2. Tapping "Accept" navigates to FriendProfile and marks the notification read.
3. TRIP_MEMBER_ADDED card does NOT show Accept/Decline — tapping it navigates to TripDetail.

**T2.4 — Pagination preserved**
1. Have more than 20 notifications of Notifications tab types in DB.
2. Scroll to bottom of Notifications tab → next page loads.
3. Requests tab does not trigger pagination fetch.

**T2.5 — Pull to refresh**
1. Pull down on either tab → fetches fresh data from server.
2. New notifications appear at top of correct tab.

**T2.6 — Empty state**
1. With no Requests in DB, Requests tab shows "No notifications / Nothing here yet" empty state.

---

## Acceptance Criteria — Prompt 2

- [ ] Two tabs visible: Notifications and Requests
- [ ] REQUEST_TYPES appear only in Requests tab; all others in Notifications tab
- [ ] Unread badge per tab is accurate (live-updates when items are marked read)
- [ ] Accept/Decline buttons present on FRIEND_REQUEST cards only
- [ ] Existing card tap navigation works on both tabs
- [ ] Mark all read clears both tabs
- [ ] Pull-to-refresh works on both tabs
- [ ] Pagination works on Notifications tab
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] No visual regression on the existing card design

---

---

# PROMPT 3 — FCM Priority Channels (Critical vs Default)

## Context to give Claude

> The FCM util currently sends all notifications with the same Android channel_id 'default' and apns-priority '10'. We need to differentiate critical notifications (immediate lock screen interrupt) from regular ones. Critical types: TRIP_CANCELLED, FRIEND_REQUEST, FRIEND_ACCEPTED, TRIP_MEMBER_ADDED, EVENT_MEMBER_ADDED. All others are default priority.

## Prompt

```
Update backend/src/utils/fcm.util.js to support two FCM delivery priority tiers.

1. Add a CRITICAL_TYPES set at the top of the file:
   const CRITICAL_TYPES = new Set([
     'TRIP_CANCELLED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED',
     'TRIP_MEMBER_ADDED', 'EVENT_MEMBER_ADDED'
   ]);

2. Add an optional `priority` parameter to sendFCMNotification: 
   sendFCMNotification(token, notification, data = {}, priority = 'default')
   
   When priority === 'critical':
   - android.priority = 'high'
   - android.notification.channel_id = 'critical'
   - android.notification.notification_priority = 'PRIORITY_HIGH'
   - apns.headers['apns-priority'] = '10'
   - apns.payload.aps['interruption-level'] = 'time-sensitive'  (iOS 15+)
   
   When priority === 'default':
   - android.priority = 'high'  (keep high so FCM delivers; visual priority is controlled by channel)
   - android.notification.channel_id = 'default'
   - android.notification.notification_priority = 'PRIORITY_DEFAULT'
   - apns.headers['apns-priority'] = '5'
   - apns.payload.aps['interruption-level'] = 'active'

3. In createAndSendNotification and createAndSendNotifications, auto-detect priority:
   const priority = CRITICAL_TYPES.has(type) ? 'critical' : 'default';
   Pass it through to sendFCMNotification.

4. Do not change any function signatures that callers use — createAndSendNotification and createAndSendNotifications keep the same external API.
```

---

## Manual Testing — Prompt 3

**T3.1 — Critical push**
1. Send a FRIEND_REQUEST between two test users.
2. On the receiving device: notification should appear as a heads-up / banner notification immediately.
3. In the FCM log: confirm `channel_id: 'critical'` in the outgoing payload (add a temporary `logger.info` of the message object if needed).

**T3.2 — Default push**
1. Upload a document to a shared trip.
2. Push arrives on device but as a standard notification (no forced heads-up).
3. FCM log shows `channel_id: 'default'`.

**T3.3 — No regression**
1. Existing TRIP_REMINDER pushes still arrive.
2. No FCM auth errors in server logs.

---

## Acceptance Criteria — Prompt 3

- [ ] CRITICAL_TYPES set defined in fcm.util.js
- [ ] `sendFCMNotification` accepts `priority` param
- [ ] Critical notifications use `channel_id: 'critical'`, `apns-priority: 10`, `interruption-level: time-sensitive`
- [ ] Default notifications use `channel_id: 'default'`, `apns-priority: 5`
- [ ] No change to external function signatures
- [ ] All existing notification sends still work (no 400/401 from FCM)

---

---

# PROMPT 4 — Reminder Cron Enhancements (3-day + Activity Reminders)

## Context to give Claude

> The existing reminders cron (backend/src/utils/reminders.cron.js) runs hourly and processes trip_reminders and event_reminders tables. Currently only trip_start, 1_day_before, and 1_week_before are supported. We need to add 3_days_before. We also need a new per-activity reminder system (lock-screen push only — these are NOT stored in the notifications table).

## Prompt

```
Extend the GatherrGo reminder system in two parts.

PART A — Add 3_days_before to existing trip/event reminders

1. In backend/src/utils/reminders.cron.js:
   - Add '3_days_before' to TRIP_NOTIF_MAP:
     title: '📅 3 days to go!'
     body: (name) => `"${name}" is just 3 days away. Start packing!`
   - Add '3_days_before' to EVENT_NOTIF_MAP:
     title: '📅 3 days to go!'
     body: (name) => `Your event "${name}" is in 3 days. Get ready!`

2. In backend/src/modules/trips/trips.service.js (the createTrip function), find where trip_reminders rows are inserted (1_day_before, 1_week_before, trip_start). Add a 3_days_before insert:
   scheduled_at = start_date - 3 days
   Only insert if start_date - 3 days is in the future.

3. Do the same in backend/src/modules/events/events.service.js for event_reminders.

PART B — Per-activity reminder system

1. Create a new migration file backend/migrations/022_activity_reminders.sql:
   CREATE TABLE IF NOT EXISTS activity_reminders (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     activity_id UUID NOT NULL,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     trip_id UUID NOT NULL,
     remind_at TIMESTAMPTZ NOT NULL,
     reminder_minutes INTEGER NOT NULL,  -- 10, 30, or 60
     sent_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE INDEX idx_act_rem_due ON activity_reminders (remind_at) WHERE sent_at IS NULL;

2. Add a new helper function scheduleActivityReminders(activityId, tripId, activityStartTime, memberUserIds, reminderMinutes) to backend/src/utils/reminders.cron.js that:
   - Deletes any existing unsent activity_reminders rows for this activityId (for updates)
   - Inserts one row per user per reminderMinutes value (10, 30, 60) where remind_at = activityStartTime - reminderMinutes
   - Only inserts if remind_at is in the future
   Default reminderMinutes = [10, 30, 60] (all three until user settings exist in Phase 5).

3. Call scheduleActivityReminders from activities.service.js when an activity is created or updated with a start_time set.

4. Add processActivityReminders() to reminders.cron.js:
   - Query: SELECT ar.*, a.name AS activity_name, t.name AS trip_name, u.fcm_token 
            FROM activity_reminders ar
            JOIN activities a ON a.id = ar.activity_id
            JOIN trips t ON t.id = ar.trip_id
            JOIN users u ON u.id = ar.user_id
            WHERE ar.remind_at <= NOW() AND ar.sent_at IS NULL
            LIMIT 100
   - For each row: call sendFCMNotification directly (NOT createAndSendNotification — these do NOT go to the notifications table)
     title: '⏰ Activity Reminder'
     body: `"[Activity Name]" starts in [reminder_minutes] minutes — [Trip Name]`
     data: { tripId, activityId, type: 'ACTIVITY_REMINDER' }
   - Set sent_at = NOW()
   
5. Change the cron schedule in startRemindersCron to run every 5 minutes (instead of hourly) to support 10-min activity reminders:
   cron.schedule('*/5 * * * *', processReminders, ...)
   
   The existing processTripReminders and processEventReminders are fine running every 5 minutes (they check scheduled_at, so they won't re-send).

Export scheduleActivityReminders from reminders.cron.js so activities.service.js can import it.
```

---

## Manual Testing — Prompt 4

**T4.1 — 3_days_before row created**
1. Create a new trip with start_date = today + 4 days.
2. DB check: `SELECT * FROM trip_reminders WHERE trip_id = '<id>' AND reminder_type = '3_days_before';`
3. Expected: 1 row with scheduled_at = start_date - 3 days.

**T4.2 — 3_days_before fires**
1. Manually update scheduled_at to 1 minute in the past for the test row.
2. Wait for cron to run (or call `processReminders()` via a temporary test endpoint).
3. DB check: `SELECT * FROM notifications WHERE type = 'TRIP_REMINDER' AND data->>'reminderType' = '3_days_before';`
4. Expected: rows for all trip members.

**T4.3 — Activity reminders created**
1. Create an activity with start_time = 45 minutes from now.
2. DB check: `SELECT * FROM activity_reminders WHERE activity_id = '<id>';`
3. Expected: rows for each member with remind_at at -10, -30, -60 min (only future ones inserted).
4. For 45 min from now: -10 and -30 rows should exist, -60 should NOT (it's in the past).

**T4.4 — Activity reminder push fires (no DB row)**
1. Manually set remind_at to 1 min in the past on a test activity_reminders row.
2. Wait for cron (5 min) or trigger manually.
3. Device receives push notification.
4. DB check: `SELECT * FROM notifications WHERE type = 'ACTIVITY_REMINDER';` → Expected: 0 rows (these are not persisted).
5. activity_reminders row has sent_at set.

**T4.5 — Activity update reschedules reminders**
1. Create activity at T+60 min → two reminder rows created.
2. Update activity start_time to T+20 min.
3. DB check: old unsent rows are deleted and new row at T+10 min is inserted.

---

## Acceptance Criteria — Prompt 4

- [ ] `3_days_before` key in both TRIP_NOTIF_MAP and EVENT_NOTIF_MAP
- [ ] New trips/events insert a `3_days_before` row in reminders tables (only if date is future)
- [ ] Migration `022_activity_reminders.sql` exists and creates table + index
- [ ] `scheduleActivityReminders` exported from reminders.cron.js
- [ ] Activity creation/update calls `scheduleActivityReminders`
- [ ] Activity reminder push sent via `sendFCMNotification` directly (NOT via createAndSendNotification)
- [ ] Activity reminder rows NOT appearing in `notifications` table
- [ ] Cron runs every 5 minutes
- [ ] Existing trip/event reminder flow unchanged

---

---

# PROMPT 5 — Batching Infrastructure

## Context to give Claude

> Currently ITINERARY_UPDATED, DOCUMENT_UPLOADED, and EXPENSE_ADDED are sent immediately as individual push notifications. Per the strategy, these should be batched — multiple events within a 2-hour window become a single "X updates in [Trip Name]" push. The DB rows in the notifications table are still created immediately per event. Only the FCM push is batched. The in-app list is not affected.

## Prompt

```
Implement a push-notification batching system for ITINERARY_UPDATED, DOCUMENT_UPLOADED, and EXPENSE_ADDED.

The key principle: notification DB rows are written immediately (so the in-app list is always up to date). Only the FCM push is delayed and batched.

STEP 1 — Migration
Create backend/migrations/023_notification_batch_queue.sql:

CREATE TABLE IF NOT EXISTS notification_batch_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(60) NOT NULL,
  parent_id UUID NOT NULL,
  parent_name TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 1,
  window_closes_at TIMESTAMPTZ NOT NULL,
  flushed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_batch_flush ON notification_batch_queue (window_closes_at) WHERE flushed_at IS NULL;
CREATE UNIQUE INDEX idx_batch_open_window ON notification_batch_queue (user_id, type, parent_id) WHERE flushed_at IS NULL;

STEP 2 — Modify createAndSendNotification in fcm.util.js
Add an optional options object as the 5th parameter: createAndSendNotification(userId, notification, type, data = {}, options = {})

options.batched (boolean, default false) — when true:
  - Still insert the notification row to the DB as normal.
  - Instead of pushing immediately, call queueBatchedPush(userId, type, data.tripId || data.eventId, data.tripName || data.parentName) (new helper, see below).
  - Do NOT call sendFCMNotification.

options.batched = false (default): existing behaviour — push immediately.

STEP 3 — New helper queueBatchedPush(userId, type, parentId, parentName) in fcm.util.js
- Try INSERT INTO notification_batch_queue (user_id, type, parent_id, parent_name, window_closes_at) VALUES ($1,$2,$3,$4, NOW() + interval '2 hours') ON CONFLICT (user_id, type, parent_id) WHERE flushed_at IS NULL DO UPDATE SET event_count = notification_batch_queue.event_count + 1
- Log errors but do not throw.

STEP 4 — New batching cron backend/src/utils/batching.cron.js
Runs every 30 minutes.
processBatchedPushes():
  1. Query: SELECT bq.*, u.fcm_token FROM notification_batch_queue bq JOIN users u ON u.id = bq.user_id WHERE bq.window_closes_at <= NOW() AND bq.flushed_at IS NULL LIMIT 200
  2. For each row:
     Build the push title/body:
     - ITINERARY_UPDATED: title='Itinerary Updated', body=`${count} update(s) to "${parentName}"`
     - DOCUMENT_UPLOADED: title='Documents Added', body=`${count} document(s) added to "${parentName}"`
     - EXPENSE_ADDED: title='Expenses Added', body=`${count} expense(s) added to "${parentName}"`
     Call sendFCMNotification(u.fcm_token, {title, body}, { type, parentId: bq.parent_id }, 'default')
     Set flushed_at = NOW() for that row.
  3. Log how many batches were flushed.

Export startBatchingCron() that schedules '*/30 * * * *'.

STEP 5 — Wire up in the callers
In activities.service.js, docs.service.js, expenses.service.js: when calling createAndSendNotification for ITINERARY_UPDATED, DOCUMENT_UPLOADED, EXPENSE_ADDED, pass options = { batched: true }.

STEP 6 — Start the cron
In backend/src/app.js or wherever startRemindersCron is started, import and call startBatchingCron().
```

---

## Manual Testing — Prompt 5

**T5.1 — Notification row created immediately, no push**
1. User A adds an activity to a trip with User B.
2. DB check immediately: `SELECT * FROM notifications WHERE type = 'ITINERARY_UPDATED' AND user_id = '<B>';` → 1 row exists.
3. DB check: `SELECT * FROM notification_batch_queue WHERE user_id = '<B>' AND type = 'ITINERARY_UPDATED';` → 1 row with window_closes_at = ~2h from now.
4. User B's device should NOT have received a push yet.

**T5.2 — Multiple events accumulate in same window**
1. User A adds 3 more activities within the same 2-hour window.
2. DB check batch_queue: `event_count` for User B's ITINERARY_UPDATED row = 4 (1 + 3).
3. 4 individual rows in notifications table.

**T5.3 — Batch flush fires**
1. Manually update `window_closes_at = NOW() - interval '1 minute'` on the batch queue row.
2. Wait for batching cron (30 min) OR call processBatchedPushes via a temporary test route.
3. User B's device receives ONE push: "4 update(s) to '[Trip Name]'".
4. DB check: `flushed_at IS NOT NULL` on the batch_queue row.

**T5.4 — New window opens after flush**
1. User A adds another activity after the batch was flushed.
2. DB check: NEW batch_queue row created (old one has flushed_at set, so the unique index allows a new open row).

**T5.5 — In-app list unaffected**
1. User B opens Notifications screen → sees all 5 individual notifications (not batched).

---

## Acceptance Criteria — Prompt 5

- [ ] Migration 023 exists and creates `notification_batch_queue` with correct unique index
- [ ] `createAndSendNotification` accepts `options.batched` param
- [ ] When `batched: true`: DB row created, no immediate FCM push, batch queue row inserted/incremented
- [ ] When `batched: false` (default): existing immediate push behaviour unchanged
- [ ] `batching.cron.js` created and exported
- [ ] Cron runs every 30 min
- [ ] Batched push sends one summarised message per (user, type, parentId) group
- [ ] `flushed_at` set after flush; unique index allows new open window
- [ ] `startBatchingCron` wired up in app.js
- [ ] ITINERARY_UPDATED, DOCUMENT_UPLOADED, EXPENSE_ADDED all pass `batched: true`

---

---

# PROMPT 6 — User Notification Settings

## Context to give Claude

> We need per-user notification preferences: email digest frequency, lock screen reminders toggle, and quiet hours. These live on the user record as a JSONB column. Quiet hours suppress non-critical FCM pushes between 10pm and 8am in the user's timezone. Lock screen reminders toggle controls whether activity_reminders rows are created. We have no timezone column on users yet — add it.

## Prompt

```
Add user notification settings to GatherrGo.

STEP 1 — Migration backend/migrations/024_user_notification_settings.sql:
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{
  "email_digest": "daily",
  "lock_screen_reminders": true,
  "quiet_hours_enabled": true,
  "quiet_start": "22:00",
  "quiet_end": "08:00"
}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'Asia/Kolkata';

STEP 2 — New API endpoint
In backend/src/modules/users/routes.js add:
  PATCH /users/notification-settings

In backend/src/modules/users/controller.js add handler updateNotificationSettings:
  Accepts body: { email_digest?, lock_screen_reminders?, quiet_hours_enabled?, quiet_start?, quiet_end?, timezone? }
  Validates: email_digest must be 'daily' | 'weekly' | 'never'
  Merges with existing JSONB (do not overwrite keys not in the request body):
  UPDATE users SET 
    notification_settings = notification_settings || $1::jsonb,
    timezone = COALESCE($2, timezone)
  WHERE id = $3
  Returns updated settings.

In backend/src/modules/users/service.js add getNotificationSettings(userId):
  SELECT notification_settings, timezone FROM users WHERE id = $1

Add GET /users/notification-settings endpoint that returns current settings.

STEP 3 — Quiet hours enforcement in fcm.util.js
Add helper isInQuietHours(notificationSettings, timezone):
  - Parse quiet_start and quiet_end from settings.
  - Get current time in the user's timezone using Intl.DateTimeFormat.
  - Return true if current time is between quiet_start and quiet_end.

In createAndSendNotification, after fetching the user's fcm_token, also fetch notification_settings and timezone:
  SELECT fcm_token, notification_settings, timezone FROM users WHERE id = $1

Before calling sendFCMNotification, check:
  const isCritical = CRITICAL_TYPES.has(type);
  if (!isCritical && isInQuietHours(notification_settings, timezone)) {
    logger.info('Suppressed push due to quiet hours', { userId, type });
    return; // Do not push — DB row already written, in-app will show it
  }

Do the same quiet hours check in the batching cron (fetch user's settings alongside fcm_token).

STEP 4 — Lock screen reminders toggle in activity reminders
In scheduleActivityReminders (reminders.cron.js), fetch each user's lock_screen_reminders setting:
  SELECT u.id, u.fcm_token, u.notification_settings FROM users u WHERE u.id = ANY($1)
Only insert activity_reminders rows for users where notification_settings->>'lock_screen_reminders' = 'true'.

STEP 5 — Per-trip mute
Create backend/migrations/025_trip_notification_mutes.sql:
  CREATE TABLE IF NOT EXISTS trip_notification_mutes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    muted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, trip_id)
  );

Add API endpoints:
  POST /trips/:id/mute    → INSERT INTO trip_notification_mutes
  DELETE /trips/:id/mute  → DELETE FROM trip_notification_mutes
  GET /trips/:id/mute     → returns { muted: boolean }

In createAndSendNotification and createAndSendNotifications, for non-critical types when data.tripId is present:
  Check: SELECT 1 FROM trip_notification_mutes WHERE user_id = $1 AND trip_id = $2
  If muted: skip the FCM push (still write DB row).
  For batch sends: filter out muted users from the recipients list.
```

---

## Manual Testing — Prompt 6

**T6.1 — Settings defaults**
1. Call `GET /users/notification-settings` → returns `{ email_digest: 'daily', lock_screen_reminders: true, quiet_hours_enabled: true, quiet_start: '22:00', quiet_end: '08:00' }`.

**T6.2 — Update settings**
1. PATCH `{ email_digest: 'weekly', lock_screen_reminders: false }`.
2. GET → returns updated values, other keys unchanged.

**T6.3 — Quiet hours suppress push**
1. Set `quiet_start: '00:00', quiet_end: '23:59'` (always quiet).
2. Trigger an EXPENSE_ADDED notification.
3. DB check: notification row exists.
4. Device: no push received.
5. Server log: "Suppressed push due to quiet hours".
6. Critical type (FRIEND_REQUEST): push still arrives despite quiet hours.

**T6.4 — Lock screen reminders toggle**
1. Set `lock_screen_reminders: false` for User B.
2. Create an activity with a future start time.
3. DB check: `SELECT * FROM activity_reminders WHERE user_id = '<B>';` → 0 rows for User B.
4. User A (lock_screen_reminders: true) → rows exist for User A.

**T6.5 — Per-trip mute**
1. POST `/trips/:id/mute`.
2. Trigger EXPENSE_ADDED for that trip.
3. DB check: notification row still created.
4. Device: no push received.
5. DELETE `/trips/:id/mute`.
6. Trigger another EXPENSE_ADDED → push arrives.

---

## Acceptance Criteria — Prompt 6

- [ ] Migration 024 adds `notification_settings` JSONB and `timezone` columns with correct defaults
- [ ] Migration 025 creates `trip_notification_mutes` table
- [ ] `GET /users/notification-settings` returns current settings
- [ ] `PATCH /users/notification-settings` merges (not replaces) settings; validates email_digest enum
- [ ] Quiet hours suppress non-critical FCM push; critical types bypass quiet hours
- [ ] `isInQuietHours` uses user's own timezone, not server timezone
- [ ] `lock_screen_reminders: false` prevents activity_reminders rows from being created for that user
- [ ] Trip mute: push suppressed, DB row still written
- [ ] Mute POST/DELETE/GET endpoints work

---

---

# PROMPT 7 — Email Notifications

## Context to give Claude

> The backend already has sendEmail and wrapEmail in backend/src/utils/mailer.js. We need two email flows: (1) immediate emails for critical events, (2) a daily/weekly digest cron. The digest reads unread notifications from the DB grouped by trip/event and sends a single consolidated HTML email. User email_digest preference is now stored in notification_settings JSONB (from Phase 6).

## Prompt

```
Implement email notifications for GatherrGo.

PART A — Immediate email templates

In backend/src/utils/mailer.js, add the following three email-sending functions (use the existing wrapEmail and sendEmail helpers):

1. sendTripCancelledEmail(recipientEmail, recipientName, tripName)
   Subject: `"${tripName}" has been cancelled`
   Body: Inform the user the trip was cancelled by the organiser. Include a button "Open GatherrGo".

2. sendConnectionRequestEmail(recipientEmail, recipientName, requesterName)
   Subject: `${requesterName} wants to connect on GatherrGo`
   Body: Someone wants to connect. Button "View Request".

3. sendRequestAcceptedEmail(recipientEmail, recipientName, accepterName)
   Subject: `${accepterName} accepted your connection request`
   Body: Your connection request was accepted. Button "Open GatherrGo".

Wire them up:
- sendTripCancelledEmail: call in trips.service.js in the TRIP_CANCELLED code path. Fetch member emails from DB (SELECT u.email, p.full_name FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ANY(<memberIds>)).
- sendConnectionRequestEmail: call in friends.service.js in the sendFriendRequest code path.
- sendRequestAcceptedEmail: call in friends.service.js in the acceptFriendRequest code path.

All three email sends are fire-and-forget (do not await, catch errors silently).

PART B — Daily/weekly digest cron

Create backend/src/utils/digest.cron.js:

1. processDigests():
   a. Fetch users who have email_digest != 'never' and have unread notifications since their last digest:
      SELECT u.id, u.email, p.full_name, u.notification_settings,
             u.last_digest_sent_at
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      WHERE u.notification_settings->>'email_digest' != 'never'
        AND u.email IS NOT NULL
   
   b. Filter by cadence:
      - 'daily': include users where last_digest_sent_at IS NULL OR last_digest_sent_at < NOW() - interval '23 hours'
      - 'weekly': include users where last_digest_sent_at IS NULL OR last_digest_sent_at < NOW() - interval '6 days 23 hours'

   c. For each eligible user, fetch their unread notifications since last_digest_sent_at:
      SELECT type, title, body, data, created_at 
      FROM notifications 
      WHERE user_id = $1 
        AND read = false
        AND created_at > COALESCE($2, NOW() - interval '7 days')
        AND type NOT IN ('WELCOME', 'TRIP_REMINDER', 'EVENT_REMINDER', 'ACTIVITY_REMINDER')
      ORDER BY created_at DESC
      LIMIT 50

   d. If no unread notifications → skip this user (don't send empty digest).

   e. Group notifications by data->>'tripId' or data->>'eventId' with a fallback 'General' group.

   f. Build HTML digest email using wrapEmail:
      Subject: "Your GatherrGo update — [date]"
      Sections per trip/event: header with trip/event name, then bullet list of notification bodies.
      Footer: "Open GatherrGo to view all updates."

   g. Call sendEmail. On success: UPDATE users SET last_digest_sent_at = NOW() WHERE id = $1.

2. Add last_digest_sent_at column to users in a new migration 026:
   ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

3. Schedule the cron: runs daily at 08:00 IST:
   cron.schedule('0 8 * * *', processDigests, { timezone: 'Asia/Kolkata' })

4. Export startDigestCron() and wire it up in app.js alongside the other crons.
```

---

## Manual Testing — Prompt 7

**T7.1 — Trip cancelled immediate email**
1. User A cancels a trip that User B is in.
2. Check User B's inbox within 30 seconds.
3. Expected: email with subject `"[Trip Name]" has been cancelled`.

**T7.2 — Friend request immediate email**
1. User A sends a friend request to User B.
2. User B's inbox: `User A wants to connect on GatherrGo`.

**T7.3 — Friend accepted immediate email**
1. User B accepts User A's friend request.
2. User A's inbox: `User B accepted your connection request`.

**T7.4 — Digest skips users with no unread**
1. User with no unread notifications since last digest.
2. Trigger processDigests manually.
3. No email sent to that user.
4. `last_digest_sent_at` not updated.

**T7.5 — Digest groups by trip**
1. User has 3 EXPENSE_ADDED + 2 ITINERARY_UPDATED notifications for the same trip.
2. Trigger processDigests.
3. Email received with one "Trip Name" section containing all 5 entries.

**T7.6 — Weekly cadence respected**
1. Set email_digest = 'weekly', last_digest_sent_at = 3 days ago.
2. Trigger processDigests.
3. No email (< 7 days since last digest).
4. Set last_digest_sent_at = 8 days ago → email sent.

**T7.7 — email_digest = 'never' opt-out**
1. Set user's notification_settings email_digest = 'never'.
2. Trigger digest cron.
3. No email sent.

---

## Acceptance Criteria — Prompt 7

- [ ] Migration 026 adds `last_digest_sent_at` column
- [ ] `sendTripCancelledEmail`, `sendConnectionRequestEmail`, `sendRequestAcceptedEmail` added to mailer.js
- [ ] Immediate emails fire on TRIP_CANCELLED, FRIEND_REQUEST, FRIEND_ACCEPTED
- [ ] Digest skips users with email_digest = 'never'
- [ ] Digest respects daily/weekly cadence using `last_digest_sent_at`
- [ ] Digest skips users with no unread notifications
- [ ] Digest email groups notifications by trip/event
- [ ] `last_digest_sent_at` updated after successful send
- [ ] Digest cron starts at app startup via `startDigestCron()`
- [ ] No unhandled promise rejections (all email sends are fire-and-forget)

---

---

# PROMPT 8 — Frontend: Activity Reminder Settings

## Context to give Claude

> Phases 4 and 6 added the backend for per-user activity reminders (lock_screen_reminders toggle in notification_settings). We now need a simple UI so users can toggle reminders and pick their preferred reminder time (10, 30, or 60 minutes before). This is a new section inside the existing EditProfileScreen or a standalone Settings screen — choose whichever is less invasive. The app/src/api/ folder has the pattern for API calls.

## Prompt

```
Add a Notification Preferences section to the GatherrGo mobile app.

STEP 1 — API module
Create app/src/api/notificationSettings.api.ts:
  getNotificationSettings(): GET /users/notification-settings
  updateNotificationSettings(settings: Partial<NotificationSettings>): PATCH /users/notification-settings

  Type:
  export type NotificationSettings = {
    email_digest: 'daily' | 'weekly' | 'never';
    lock_screen_reminders: boolean;
    quiet_hours_enabled: boolean;
    quiet_start: string;  // 'HH:MM'
    quiet_end: string;    // 'HH:MM'
  };

STEP 2 — Settings store (or hook)
Create app/src/store/notificationSettingsStore.ts (Zustand, no persistence):
  State: settings: NotificationSettings | null, loading: boolean
  Actions:
    fetchSettings(): calls getNotificationSettings, sets state
    updateSettings(patch): optimistic update + API call, reverts on error

STEP 3 — Notification Preferences UI
Add a "Notification Preferences" section to app/src/screens/main/EditProfileScreen.tsx 
(or create a standalone NotificationSettingsScreen.tsx if EditProfile is very long — use judgment).

The section should contain:

a. Activity Reminders toggle (Switch component)
   Label: "Activity Reminders"
   Subtitle: "Get reminded before each scheduled activity"
   Maps to: lock_screen_reminders
   On toggle: call updateSettings({ lock_screen_reminders: value })

b. Email Digest selector
   Label: "Email Updates"
   Three tappable options styled as radio pills: "Daily" | "Weekly" | "Never"
   Active pill: teal background, white text
   Maps to: email_digest
   On tap: call updateSettings({ email_digest: value })

c. Quiet Hours toggle (Switch component)
   Label: "Quiet Hours (10pm – 8am)"
   Subtitle: "Pause non-urgent notifications at night"
   Maps to: quiet_hours_enabled
   On toggle: call updateSettings({ quiet_hours_enabled: value })

Style everything to match the existing EditProfileScreen design (same fonts, colours, card style).

STEP 4 — Load settings on mount
In the screen that contains this section, call fetchSettings() in useEffect on mount.
Show an ActivityIndicator while loading.
If settings is null after load, show a "Could not load settings" message.

STEP 5 — Navigate to the settings
If you created a standalone NotificationSettingsScreen, add it to MainStack.tsx and add a "Notification Preferences" row in EditProfileScreen that navigates to it.
If you added it inline to EditProfileScreen, no navigation change needed.
```

---

## Manual Testing — Prompt 8

**T8.1 — Settings load**
1. Open EditProfile (or NotificationSettings screen).
2. Current settings show correctly (default: reminders ON, digest Daily, quiet hours ON).

**T8.2 — Toggle Activity Reminders OFF**
1. Toggle "Activity Reminders" to OFF.
2. Optimistic UI update happens immediately.
3. GET /users/notification-settings → `lock_screen_reminders: false`.
4. Create an activity with a future start time.
5. DB check: no activity_reminders rows for this user.

**T8.3 — Toggle Activity Reminders ON**
1. Toggle back ON.
2. GET confirms `lock_screen_reminders: true`.
3. Create new activity → activity_reminders rows created.

**T8.4 — Email digest change**
1. Tap "Weekly".
2. GET confirms `email_digest: weekly`.
3. Tap "Never" → `email_digest: never`.

**T8.5 — Quiet hours toggle**
1. Toggle quiet hours OFF.
2. GET confirms `quiet_hours_enabled: false`.
3. Send EXPENSE_ADDED during "quiet" hours → push arrives (quiet hours disabled).

**T8.6 — Optimistic revert on API error**
1. Disconnect network.
2. Toggle a setting → UI updates optimistically.
3. API fails → UI reverts to previous value.

---

## Acceptance Criteria — Prompt 8

- [ ] `notificationSettings.api.ts` created with GET and PATCH calls
- [ ] `notificationSettingsStore.ts` with optimistic update + error revert
- [ ] UI shows: Activity Reminders toggle, Email Digest radio pills, Quiet Hours toggle
- [ ] All three controls reflect and update the backend settings
- [ ] Loading state shown while fetching
- [ ] Error state shown if fetch fails
- [ ] No TypeScript errors
- [ ] No visual regression in EditProfileScreen

---

---

# FINAL ACCEPTANCE — Full System Test

Run this after all 8 prompts are complete and accepted.

## Full notification matrix validation

| Event | In-app (correct tab) | Badge | Lock screen | Email |
|---|---|---|---|---|
| FRIEND_REQUEST | Requests tab ✓ | ✓ | Immediate push | Immediate email |
| FRIEND_ACCEPTED | Requests tab ✓ | ✓ | Immediate push | Immediate email |
| TRIP_MEMBER_ADDED | Requests tab ✓ | ✓ | Immediate push | — |
| TRIP_CANCELLED | Notifications tab ✓ | ✓ | Immediate push | Immediate email |
| ITINERARY_UPDATED | Notifications tab ✓ | ✓ | Batched push (2h) | Daily digest |
| DOCUMENT_UPLOADED | Notifications tab ✓ | ✓ | Batched push (2h) | Daily digest |
| EXPENSE_ADDED | Notifications tab ✓ | ✓ | Batched push (2h) | Daily digest |
| NEW_MEMBER_JOINED | Notifications tab ✓ | ✓ | — | Daily digest |
| TRIP_MILESTONE | Notifications tab ✓ | ✓ | — | Daily digest |
| TRIP_REMINDER | Notifications tab ✓ | ✓ | Scheduled push | Daily digest |
| EVENT_REMINDER | Notifications tab ✓ | ✓ | Scheduled push | Daily digest |
| ACTIVITY_REMINDER | Not shown ✓ | — | Scheduled push | — |

## Cross-cutting checks

- [ ] Actor never receives their own action notifications
- [ ] Quiet hours suppress default pushes but not critical ones
- [ ] Trip mute suppresses push but notification row still exists in DB
- [ ] `lock_screen_reminders: false` prevents activity reminder creation
- [ ] `email_digest: never` prevents all digest emails
- [ ] Unread count badge on bell icon updates on app foreground
- [ ] Notifications and Requests tab each have accurate unread badges
- [ ] Pull-to-refresh works on both tabs
- [ ] Tapping a notification card deep-links to correct screen (TripDetail/EventDetail)
- [ ] Mark all read clears both tabs
- [ ] Pagination works on Notifications tab (scroll to bottom)
- [ ] All DB migrations run cleanly in order (021 → 026)
- [ ] No TypeScript errors in app: `npx tsc --noEmit`
- [ ] No unhandled promise rejections in backend logs under normal use

## Regression checks

- [ ] Existing WELCOME notification still works on new user signup
- [ ] TRIP_INVITE_ACCEPTED / EVENT_INVITE_ACCEPTED still fire on invite link claim
- [ ] Login/logout clears notification store (`clearNotifications()` called)
- [ ] FCM token exclusivity still works (login on new device evicts old token)

---

*Document prepared for GatherrGo development team | Notification Implementation Guide v1.0*
