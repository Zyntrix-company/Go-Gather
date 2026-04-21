# Notification system context (GatherGo)

Use this document when changing **push notifications**, **in-app notification UI**, or **device token handling** on mobile or backend.

---

## High-level architecture

| Layer | Role |
|--------|------|
| **Backend** | Stores one FCM device token per user (`users.fcm_token`). Sends pushes via Firebase HTTP v1 when domain events occur (friends, trips, events, invites, reminders, etc.). |
| **Mobile app** | Registers for FCM, passes `deviceToken` on login (email / Google / Facebook). **In-app notification list** is **local only** (Zustand + AsyncStorage), not loaded from the API. |

There is **no** dedicated “notifications” REST resource today: the server pushes; the client optionally mirrors foreground messages into the local list.

---

## Mobile app (`app/`)

### Entry and FCM wiring

| File | Responsibility |
|------|------------------|
| `app/App.tsx` | Calls `usePushNotifications()` at root so listeners are active while the app runs. |
| `app/src/hooks/usePushNotifications.ts` | Android: requests `POST_NOTIFICATIONS`. Gets `messaging().getToken()`. Subscribes to `messaging().onMessage` for **foreground** messages: parses `notification.title/body` and `data.type`, calls `addNotification`, shows `Toast`. |
| `app/src/hooks/useAuth.ts` | On **login** / **googleLogin** / **facebookLogin**: `getFcmTokenForLogin()` → sends `deviceToken` (+ `platform`) to auth APIs. **OTP verify** path in this file does not send `deviceToken` in the snippet below—confirm `auth.api` if you add FCM to signup verify. |

### Local in-app list (not per-user in storage name)

| File | Responsibility |
|------|------------------|
| `app/src/store/notificationStore.ts` | Zustand store: `notifications[]`, `addNotification`, `markRead`, `markAllRead`. **Persist** key: `gathergo-notifications` (AsyncStorage via `zustand/middleware` `persist`). IDs are `Date.now().toString()` at insert time. |
| `app/src/screens/main/NotificationsScreen.tsx` | Renders list, filters all/unread, taps mark read; “Mark all read”. |
| `app/src/screens/home/HomeScreen.tsx` | Reads unread count from the same store for `AppHeader` `notificationCount`. |

### Types (`AppNotification`)

- `id`, `type`, `title`, `message`, `receivedAt`, `read`
- `type` defaults to `'default'` if FCM `data.type` is missing.

### When changing app behavior, check

1. **Account switch / logout**: `app/src/utils/storage.ts` `clearAll()` only clears **Keychain** tokens—not necessarily every AsyncStorage key. If the in-app list must be per-user, persist key should include **user id** and/or **clear the store on logout**.
2. **Foreground vs background**: Only `onMessage` updates the in-app store; background behavior depends on OS + Firebase config (not documented here).
3. **`fcmToken` from `usePushNotifications`**: Exposed for future use (e.g. register elsewhere); login flows use `getFcmTokenForLogin` inside `useAuth`.

---

## Backend (`backend/`)

### FCM transport

| File | Responsibility |
|------|------------------|
| `backend/src/utils/fcm.util.js` | `sendFCMNotification(token, { title, body }, data)`. Stringifies all `data` values for FCM v1. `notifyUsers(usersRows, notification, data)` sends one HTTP request per token. Uses `FIREBASE_SERVICE_ACCOUNT_B64` or `GOOGLE_APPLICATION_CREDENTIALS`; project id `FIREBASE_PROJECT_ID` (default `gatherrgo`). |

### Device token registration

| File | Responsibility |
|------|------------------|
| `backend/src/modules/auth/service.js` | `handleDeviceRegistration(userId, deviceToken, platform)` → `UPDATE users SET fcm_token = $1, platform = $2 ... WHERE id = $3`. Called from **login**, **googleAuth**, **facebookAuth** after successful auth (not from `verifyEmail` in the same file—email verify issues tokens without updating FCM in that flow). |
| `backend/src/modules/auth/validators.js` | `deviceToken` and `platform` optional on login / Google / Facebook bodies. |

### Modules that send pushes (non-exhaustive; grep for `sendFCMNotification` / `notifyUsers`)

| Area | File (indicative) |
|------|-------------------|
| Friends | `backend/src/modules/friends/friends.service.js` |
| Trips | `backend/src/modules/trips/trips.service.js` |
| Events | `backend/src/modules/events/events.service.js` |
| Invites | `backend/src/modules/invites/invites.service.js` |
| Reminders cron | `backend/src/utils/reminders.cron.js` |
| Users | `backend/src/modules/users/service.js` (conditional push) |

Typical pattern: `SELECT fcm_token FROM users WHERE id = $1` (or batch `notifyUsers`) then `sendFCMNotification`.

### FCM `data` payload conventions (examples)

Backend often passes a string `type` plus routing hints, e.g. friend flows use keys like `type`, `connectionId`, `fromUserId` / `userId`, `screen`. **There is no single global enum documented in code**—when adding client-side filtering, align new sends with a consistent `recipientUserId` (or similar) if you need it.

---

## Database

- **`users.fcm_token`**: last registered FCM token for that user.
- **`users.platform`**: `'ios' \| 'android'` (or null) from auth registration.

**Multi-device**: one column ⇒ last login’s device wins for that user. **Same device, multiple accounts**: only the **current** login updates that user’s row; other users may still hold the same token until explicitly cleared—relevant if you see cross-account delivery.

---

## Testing

- Backend tests mock FCM: see `backend/__tests__/friends/friends.test.js`, `invites`, `trips` for `sendFCMNotification` / `notifyUsers` mocks.

---

## Related (not in-app list)

- `backend/src/utils/sns.js`: AWS SNS helpers (separate from FCM v1 path above; confirm product usage before changing).
- Legal copy: `app/src/components/common/LegalModal.tsx` mentions push notifications.

---

## Quick grep commands for future edits

```bash
# App
rg -n "notification|fcm|messaging\\(" app --glob "*.{ts,tsx}"

# Backend
rg -n "sendFCMNotification|notifyUsers|fcm_token|handleDeviceRegistration" backend --glob "*.js"
```

---

*Last aligned with repo layout: app Zustand persist key `gathergo-notifications`, FCM v1 util, auth `handleDeviceRegistration` on login/social only.*
