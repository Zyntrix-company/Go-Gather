# Push notification catalog (FCM)

Small reference for **notification title/body** and **`data.type`** (and related keys) sent from the backend. All `data` values are sent as **strings** (FCM v1 requirement).

Placeholders: `{name}` = trip/event name, `{inviterName}` / `{requesterName}` / `{claimantName}` / `{accepterName}` = profile names (fallbacks: `"Someone"` where noted).

---

## Friends

| `data.type` | Recipient | Title | Body | Other `data` keys |
|-------------|-----------|-------|------|-------------------|
| `FRIEND_REQUEST` | Addressee (in-app request) | `{requesterName} sent you a friend request` | `Tap to accept or decline` | `connectionId`, `fromUserId`, `screen` = `friends` |
| `FRIEND_REQUEST` | Inviter (friend invite link claimed) | `{claimantName} wants to be your friend on GatherGo` | `Tap to accept or decline` | `connectionId`, `fromUserId` (= claimant), `screen` = `friends` |
| `FRIEND_ACCEPTED` | Original requester | `{accepterName} accepted your friend request!` | `You're now connected on GatherGo` | `connectionId`, `userId` (= accepter), `screen` = `friends` |

*Sources: `backend/src/modules/friends/friends.service.js`, `backend/src/modules/invites/invites.service.js` (friend claim).*

---

## Trips

| `data.type` | Recipient | Title | Body | Other `data` keys |
|-------------|-----------|-------|------|-------------------|
| `TRIP_MEMBER_ADDED` | Added member(s) | `{tripName} — {inviterName} added you!` | `Open GatherGo to see the trip` | `tripId`, `screen` = `trips` |
| `TRIP_INVITE_ACCEPTED` | Trip admin (first admin token) | `{claimantName} accepted your trip invite` | `Tap to see trip members` | `tripId`, `newMemberId`, `screen` = `trip` |

*Sources: `backend/src/modules/trips/trips.service.js`, `backend/src/modules/invites/invites.service.js` (trip claim).*

---

## Events

| `data.type` | Recipient | Title | Body | Other `data` keys |
|-------------|-----------|-------|------|-------------------|
| `EVENT_MEMBER_ADDED` | Added member(s) | `{eventName} — {inviterName} added you!` | `Open GatherGo to see the event` | `eventId`, `screen` = `events` |
| `EVENT_INVITE_ACCEPTED` | Event admin (first admin token) | `{claimantName} accepted your event invite` | `Tap to see event members` | `eventId`, `newMemberId`, `screen` = `events` |

*Sources: `backend/src/modules/events/events.service.js`, `backend/src/modules/invites/invites.service.js` (event claim).*

---

## Scheduled reminders (cron)

**Trips** — `data.type`: `TRIP_REMINDER`; also `reminderType`, `tripId`.

| `reminder_type` | Title | Body |
|-----------------|-------|------|
| `trip_start` | `🚀 Trip starts today!` | `Your trip "{name}" starts today. Have a great trip!` |
| `1_day_before` | `✈️ Trip tomorrow!` | `"{name}" starts tomorrow. Time to pack!` |
| `1_week_before` | `📅 1 week to go!` | `"{name}" is just 1 week away. Get ready!` |
| *(other)* | `Trip Reminder` | `Reminder for your trip "{name}"` |

**Events** — `data.type`: `EVENT_REMINDER`; also `reminderType`, `eventId`.

| `reminder_type` | Title | Body |
|-----------------|-------|------|
| `event_start` | `🎉 Event starts today!` | `Your event "{name}" starts today. Enjoy!` |
| `1_day_before` | `📆 Event tomorrow!` | `"{name}" is tomorrow. Don't forget!` |
| *(other)* | `Event Reminder` | `Reminder for your event "{name}"` |

*Source: `backend/src/utils/reminders.cron.js`.*

---

## Onboarding

| `data.type` | Recipient | Title | Body | Notes |
|-------------|-----------|-------|------|--------|
| `WELCOME` | User whose profile was completed | `Welcome to GatherGo! 🎉` | `Hey {firstName}, your account is all set. Start planning your first trip!` | Sent **~100s** after profile completion (temporary testing delay in code; see TODO in `users/service.js`). |

*Source: `backend/src/modules/users/service.js`.*

---

## Mobile app mapping

The in-app list uses `remoteMessage.data?.type` as the notification `type` string (see `app/src/hooks/usePushNotifications.ts`). Icon routing in `NotificationsScreen.tsx` today includes types like `trip_invite`, `expense_added`, etc.—**many backend `type` values above use UPPER_SNAKE_CASE** and may fall through to the **default** icon until aligned.

---

*Generated from backend FCM call sites; re-run a repo search for `sendFCMNotification` / `notifyUsers` if you add new pushes.*
