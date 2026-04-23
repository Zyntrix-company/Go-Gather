# Notification System — Architecture & Context

Use this document when changing **push notifications**, **in-app notification UI**, or **device token handling** on mobile or backend.

---

## High-level architecture

| Layer | Role |
|---|---|
| **Database** | `notifications` table — one row per recipient per event; server is the source of truth |
| **Backend** | Persists notification rows then sends FCM push (fire-and-forget); push is a delivery hint only |
| **Mobile app** | Fetches its own notifications via `GET /notifications`; FCM foreground handler prepends real-time entries to the in-memory list |

There is **no AsyncStorage persistence** for notifications. The server is authoritative — missed pushes are recovered on the next API fetch.

---

## Database

### `notifications` table (migration 021)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → `users.id` ON DELETE CASCADE — **strict per-user ownership** |
| `type` | VARCHAR(60) | Notification type key (see types below) |
| `title` | TEXT | Display title |
| `body` | TEXT | Display body |
| `data` | JSONB | Extra payload (tripId, eventId, screen, etc.) |
| `read` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | Default NOW() |

**Indexes:**
- `idx_notif_user_created` on `(user_id, created_at DESC)` — paginated list queries
- `idx_notif_user_unread` partial on `(user_id) WHERE read = false` — fast badge count

### Supporting tables (unchanged)

- `users.fcm_token` — last registered FCM device token per user
- `users.platform` — `'ios' | 'android'` (or null)
- `trip_reminders`, `event_reminders` — scheduler tables processed by the hourly cron

---

## Notification Types

| Type | Who Receives | Trigger |
|---|---|---|
| `WELCOME` | New user | Profile completion |
| `FRIEND_REQUEST` | Addressee | Friend request sent / friend invite claimed |
| `FRIEND_ACCEPTED` | Original requester | Request accepted |
| `TRIP_MEMBER_ADDED` | Added user | Added to trip at creation or via invite |
| `TRIP_INVITE_ACCEPTED` | Trip admin | Invite link claimed |
| `TRIP_REMINDER` | All trip members | Cron job (trip_start, 1_day_before, 1_week_before) |
| `EVENT_MEMBER_ADDED` | Added user | Added to event at creation or via invite |
| `EVENT_INVITE_ACCEPTED` | Event admin | Invite link claimed |
| `EVENT_REMINDER` | All event members | Cron job (event_start, 1_day_before, 1_week_before) |

---

## Backend

### Core helpers (`backend/src/utils/fcm.util.js`)

**`createAndSendNotification(userId, {title, body}, type, data)`**
- Single recipient
- Inserts one row into `notifications`
- Fetches the user's current `fcm_token` from DB
- Sends FCM push (fire-and-forget, failures logged but not thrown)

**`createAndSendNotifications(users, {title, body}, type, data)`**
- Batch recipients — `users` must be `[{ id, fcm_token }, ...]`
- Bulk-inserts one row per user in a single query
- Sends FCM per token via `Promise.allSettled`

`sendFCMNotification` and `notifyUsers` still exist as low-level helpers; **do not call them directly from service files** — use the `createAndSend*` wrappers above.

### Services that create notifications

All 5 service files import `createAndSendNotification` / `createAndSendNotifications`:

| File | Notifications sent |
|---|---|
| `modules/users/service.js` | WELCOME |
| `modules/friends/friends.service.js` | FRIEND_REQUEST, FRIEND_ACCEPTED |
| `modules/invites/invites.service.js` | FRIEND_REQUEST (claim), TRIP_INVITE_ACCEPTED, EVENT_INVITE_ACCEPTED |
| `modules/trips/trips.service.js` | TRIP_MEMBER_ADDED (×2 code paths) |
| `modules/events/events.service.js` | EVENT_MEMBER_ADDED (×2 code paths) |
| `utils/reminders.cron.js` | TRIP_REMINDER, EVENT_REMINDER (all 3 cadences each) |

### Scheduled reminders (`utils/reminders.cron.js`)

Runs hourly (Asia/Kolkata). For each due row in `trip_reminders` / `event_reminders`:
1. Fetches all members (`user_id` + `fcm_token`)
2. Calls `createAndSendNotifications` — persists rows + pushes
3. Sets `sent_at = NOW()` to prevent re-processing

### FCM token exclusivity (`auth/service.js`)

`handleDeviceRegistration` runs on every login:
1. `UPDATE users SET fcm_token = NULL WHERE fcm_token = $token AND id != $userId` — evicts the token from any previous user
2. `UPDATE users SET fcm_token = $token WHERE id = $userId` — assigns to current user

This prevents cross-user notification delivery when a device is shared or reused.

---

## API Endpoints (`/notifications`)

All routes require `authenticateJWT`. Every query enforces `WHERE user_id = req.user.id`.

| Method | Path | Response |
|---|---|---|
| GET | `/notifications?page=1` | `{ notifications[], total, unreadCount, page, hasMore }` — 20 per page, newest first |
| GET | `/notifications/unread-count` | `{ unreadCount }` — lightweight badge query |
| PATCH | `/notifications/:id/read` | Marks one notification read (ownership verified) |
| PATCH | `/notifications/read-all` | Marks all user's notifications read |

---

## Frontend

### API module (`app/src/api/notifications.api.ts`)

Thin Axios wrappers for all 4 endpoints: `getNotifications`, `getUnreadCount`, `markRead`, `markAllRead`.

### Store (`app/src/store/notificationStore.ts`)

Zustand — **no AsyncStorage persistence**.

| State | Description |
|---|---|
| `notifications[]` | Pages loaded so far |
| `page` | Next page number to fetch |
| `hasMore` | Whether more pages exist on server |
| `loading` | Fetch in progress |
| `unreadCount` | Authoritative count from server (drives badge) |

Key actions:

| Action | Behaviour |
|---|---|
| `fetchNotifications(reset?)` | `reset=true` replaces list (mount / pull-to-refresh); `reset=false` appends (pagination) |
| `addNotification(n)` | Prepends foreground FCM push to list, increments `unreadCount` |
| `markRead(id)` | Optimistic local update + `PATCH /:id/read` |
| `markAllRead()` | Optimistic + `PATCH /read-all`, sets `unreadCount = 0` |
| `refreshUnreadCount()` | Polls `GET /unread-count`; called on app foreground |
| `clearNotifications()` | Wipes in-memory state on all auth transitions (login / logout / verifyOtp) |

### Notifications screen (`app/src/screens/main/NotificationsScreen.tsx`)

- Calls `fetchNotifications(true)` on mount
- Pull-to-refresh resets to page 1
- `FlatList onEndReached` (threshold 0.3) loads next page
- Spinner at list bottom while paginating
- Mark read / mark all read are optimistic

### Badge count (`app/src/screens/home/HomeScreen.tsx`)

- Reads `unreadCount` from store (server-authoritative, not computed from local array)
- `refreshUnreadCount()` called on mount and on every `AppState` → `'active'` transition
- Passed as `notificationCount` to `AppHeader` → bell icon

### Foreground push (`app/src/hooks/usePushNotifications.ts`)

`messaging().onMessage` handler:
1. Calls `addNotification()` — prepends to list, increments `unreadCount`
2. Shows a Toast

When the user next visits the Notifications screen, `fetchNotifications(reset)` reloads from server — the foreground-only in-memory entry is replaced by the persisted row.

---

## User Isolation Guarantees

| Layer | Mechanism |
|---|---|
| Database | `notifications.user_id` FK; every query has `WHERE user_id = $userId` |
| API | All routes behind `authenticateJWT`; `req.user.id` injected by middleware |
| FCM token | `handleDeviceRegistration` evicts token from previous user before assigning to current |
| Frontend auth transitions | `clearNotifications()` called on `login`, `googleLogin`, `facebookLogin`, `verifyOtp`, `logout` |
| No AsyncStorage | No stale cross-user data cached on shared devices |

---

## Key Files

| File | Purpose |
|---|---|
| `backend/migrations/021_create_notifications.sql` | Table DDL + indexes |
| `backend/src/utils/fcm.util.js` | `createAndSendNotification`, `createAndSendNotifications`, raw FCM helpers |
| `backend/src/utils/reminders.cron.js` | Hourly reminder processing |
| `backend/src/modules/notifications/notifications.service.js` | Paginate, markRead, markAllRead, unreadCount |
| `backend/src/modules/notifications/notifications.controller.js` | Route handlers |
| `backend/src/modules/notifications/notifications.routes.js` | Express router |
| `app/src/api/notifications.api.ts` | Axios wrappers |
| `app/src/store/notificationStore.ts` | Zustand store (no persist) |
| `app/src/screens/main/NotificationsScreen.tsx` | UI — fetch, pagination, pull-to-refresh |
| `app/src/hooks/usePushNotifications.ts` | FCM foreground handler |
| `app/src/hooks/useAuth.ts` | Clears notifications on all auth transitions |

---

## Quick Grep

```bash
# Backend: find all notification sends
rg -n "createAndSendNotification" backend --glob "*.js"

# Frontend: notification store usage
rg -n "notificationStore|fetchNotifications|addNotification" app --glob "*.{ts,tsx}"

# FCM token handling
rg -n "fcm_token|handleDeviceRegistration" backend --glob "*.js"
```
