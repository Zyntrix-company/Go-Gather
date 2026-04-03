# GatherGo — Frontend Implementation Guide

> **Stack:** React Native (Expo / bare) · TailwindCSS (NativeWind) · React Navigation v6  
> **Auth:** JWT (access + refresh tokens stored in SecureStore)  
> **Base URL:** configured via `EXPO_PUBLIC_API_URL` env var (e.g. `http://localhost:3000`)

---

## Table of Contents

1. [Auth & Token Management](#1-auth--token-management)
2. [API Client Setup](#2-api-client-setup)
3. [Home / Dashboard](#3-home--dashboard)
4. [Trips Module](#4-trips-module)
5. [Events Module](#5-events-module)
6. [Shared Features — Docs, Photos, Expenses, Polls, Notes](#6-shared-features)
7. [Friends & Invites](#7-friends--invites)
8. [User Profiles](#8-user-profiles)
9. [Deep Links & Branch Smart Links](#9-deep-links--branch-smart-links)
10. [Push Notifications (FCM)](#10-push-notifications-fcm)
11. [Navigation Structure](#11-navigation-structure)
12. [Error Handling Conventions](#12-error-handling-conventions)

---

## 1. Auth & Token Management

### Endpoints
| Method | URL | Description |
|---|---|---|
| POST | `/auth/signup` | Register (email + phone + password) |
| POST | `/auth/verify-otp` | Verify OTP → returns tokens |
| POST | `/auth/login` | Login → returns tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| GET  | `/auth/me` | Current user + profile |

### Token Storage
```js
// Store on login / OTP verify
await SecureStore.setItemAsync('access_token', res.accessToken);
await SecureStore.setItemAsync('refresh_token', res.refreshToken);
```

### Auto-Refresh Pattern
On every 401 response, call `POST /auth/refresh` with the stored `refresh_token`, save the new `accessToken`, then retry the original request once.

---

## 2. API Client Setup

```js
// src/api/client.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Add 401 → refresh interceptor here
export default api;
```

---

## 3. Home / Dashboard

**`GET /home`** — returns upcoming trips/events, friend activity, balances summary.

```js
// Response shape
{
  upcomingTrips: Trip[],
  upcomingEvents: Event[],   // NEW — included after Events module
  recentActivity: Activity[],
  pendingBalances: Balance[]
}
```

---

## 4. Trips Module

### 4.1 Core CRUD

| Method | URL | Notes |
|---|---|---|
| POST | `/trips` | multipart/form-data — `photos[]`, `docs[]`, JSON fields as strings |
| GET  | `/trips?status=upcoming\|ongoing\|past\|archived` | Paginated |
| GET  | `/trips/:id` | Detail + members + stats |
| PUT  | `/trips/:id` | Admin only |
| DELETE | `/trips/:id` | Admin only — irreversible |
| POST | `/trips/:id/archive` | Admin only |
| POST | `/trips/:id/unarchive` | Admin only |

### 4.2 Trip Creation — Multipart Form
Trip creation accepts files at creation time (photos + docs in one request):

```js
const form = new FormData();
form.append('name', 'Goa Trip');
form.append('startDate', '2027-04-10');
form.append('endDate', '2027-04-15');
form.append('location', JSON.stringify({ name: 'Goa, India', lat: 15.2993, lng: 74.1240 }));
form.append('reminders', 'true');
form.append('friendIds', JSON.stringify(['uuid1', 'uuid2']));
// Attach photos
photos.forEach(p => form.append('photos', { uri: p.uri, name: p.name, type: p.type }));
// Attach docs
docs.forEach(d => form.append('docs', { uri: d.uri, name: d.name, type: d.type }));

await api.post('/trips', form, { headers: { 'Content-Type': 'multipart/form-data' } });
```

### 4.3 Trip Detail Response
```json
{
  "trip": {
    "id": "uuid",
    "name": "Goa Trip 2027",
    "startDate": "2027-04-10",
    "endDate": "2027-04-15",
    "location": { "name": "Goa, India", "lat": 15.2993, "lng": 74.1240 },
    "bannerImageUrl": "https://...",
    "daysToGo": 372,
    "createdBy": "uuid",
    "archivedAt": null
  },
  "members": [
    { "userId": "uuid", "name": "Alice Sharma", "avatarUrl": "...", "role": "admin", "joinedAt": "..." }
  ],
  "stats": {
    "memberCount": 3,
    "photoVideoCount": 14,
    "docCount": 3,
    "totalExpenseAmount": 16600.00,
    "upcomingActivityCount": 2,
    "completedActivityCount": 1
  }
}
```

### 4.4 Invites

**`POST /trips/:id/invite`**
```json
{ "friendIds": ["uuid1"], "emails": ["person@example.com"], "phones": ["+919999999999"] }
```
- `friendIds` → direct add + FCM push
- `emails`/`phones` → Branch smart link + SES email

**`GET /trips/invite/:token`** — public, no auth  
**`POST /trips/invite/:token/accept`** — requires auth

---

## 5. Events Module

Events are like trips but **shorter in scope** — they have docs, photos, expenses, polls, notes but **no activities**.

### 5.1 Core CRUD

| Method | URL | Notes |
|---|---|---|
| POST | `/events` | JSON body (no file upload at creation) |
| GET  | `/events?status=upcoming\|ongoing\|past` | No `archived` status for events |
| GET  | `/events/:eventId` | Detail + members + stats |
| PUT  | `/events/:eventId` | Admin only |
| DELETE | `/events/:eventId` | Admin only — irreversible |

### 5.2 Event Creation — JSON Body
Unlike trips, event creation is pure JSON (no files at creation time). Upload docs/photos after via the sub-routes.

```js
await api.post('/events', {
  name: 'Diwali Night 2026',
  startDate: '2026-10-20',
  endDate: '2026-10-20',
  location: { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777 },
  reminders: true,              // schedules event_start + 1_day_before only
  friendIds: ['uuid-bob'],      // direct add
  emails: ['guest@example.com'] // Branch invite email
});
```

### 5.3 Event Detail Response
```json
{
  "event": {
    "id": "uuid",
    "name": "Diwali Night 2026",
    "startDate": "2026-10-20",
    "endDate": "2026-10-20",
    "location": { "name": "Mumbai, India", "lat": 19.076, "lng": 72.8777 },
    "createdBy": "uuid",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "members": [
    { "userId": "uuid", "name": "Alice Sharma", "avatarUrl": "...", "role": "admin", "joinedAt": "..." }
  ],
  "stats": {
    "memberCount": 2,
    "photoVideoCount": 5,
    "docCount": 1,
    "totalExpenseAmount": 16000.00
  }
}
```

> **Note:** No `upcomingActivityCount` / `completedActivityCount` — events have no activities.  
> **Note:** No `daysToGo` — not included in event detail.  
> **Note:** No `bannerImageUrl` — events don't have banner images.

### 5.4 Event Invites

**`POST /events/:eventId/invite`**
```json
{ "friendIds": ["uuid1"], "emails": ["person@example.com"] }
```
- Same friend-vs-non-friend logic as trips
- FCM push data: `{ type: "EVENT_MEMBER_ADDED", eventId: "uuid", screen: "events" }`

**`GET /events/invite/:token`** — public, no auth  
**`POST /events/invite/:token/accept`** — requires auth

### 5.5 What Events Do NOT Have
- ❌ No `/events/:eventId/activities` route
- ❌ No `archived` status / archive/unarchive endpoints
- ❌ No `bannerImageUrl`
- ❌ No `daysToGo`
- ❌ No `1_week_before` reminder (only `event_start` + `1_day_before`)

---

## 6. Shared Features

All features below work identically for both trips and events. Just swap the prefix:
- Trips: `/trips/:tripId/docs`, `/trips/:tripId/photos`, etc.
- Events: `/events/:eventId/docs`, `/events/:eventId/photos`, etc.

### 6.1 Docs

| Method | URL | Notes |
|---|---|---|
| GET | `/{parent}/:id/docs` | Returns `{ docs[], total }` with presigned URLs (1hr) |
| POST | `/{parent}/:id/docs` | `multipart/form-data`, field: `file` |
| DELETE | `/{parent}/:id/docs/:docId` | Uploader or admin |

**Allowed types:** PDF, DOCX, XLSX, PPTX, DOC, XLS, PPT, TXT, CSV (max 15 MB)

```js
const form = new FormData();
form.append('file', { uri: doc.uri, name: doc.name, type: doc.mimeType });
await api.post(`/events/${eventId}/docs`, form, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

**Doc response shape:**
```json
{
  "id": "uuid",
  "parentType": "event",
  "parentId": "uuid",
  "fileName": "invoice.pdf",
  "mimeType": "application/pdf",
  "fileSizeBytes": 204800,
  "downloadUrl": "https://presigned-s3-url...",
  "uploadedBy": { "userId": "uuid", "name": "Alice", "avatarUrl": "..." },
  "createdAt": "..."
}
```

### 6.2 Photos / Videos

| Method | URL | Notes |
|---|---|---|
| GET | `/{parent}/:id/photos` | Paginated. `page`, `limit` query params |
| POST | `/{parent}/:id/photos` | `multipart/form-data`, field: `photos` (array, max 5) |
| DELETE | `/{parent}/:id/photos/:photoId` | Uploader or admin |

**Allowed types:** JPEG, PNG, HEIC, HEIF, MP4, MOV (max 50 MB each)

```js
const form = new FormData();
selectedPhotos.forEach(p =>
  form.append('photos', { uri: p.uri, name: p.fileName, type: p.mimeType })
);
await api.post(`/events/${eventId}/photos`, form, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

**Photo response shape:**
```json
{
  "id": "uuid",
  "parentType": "event",
  "parentId": "uuid",
  "activityId": null,
  "url": "https://presigned-s3-url...",
  "mimeType": "image/jpeg",
  "uploadedBy": "uuid",
  "uploaderName": "Alice",
  "createdAt": "..."
}
```

### 6.3 Expenses & Balances

| Method | URL | Notes |
|---|---|---|
| GET | `/{parent}/:id/expenses` | `category`, `page`, `limit` query params |
| POST | `/{parent}/:id/expenses` | Add expense |
| PUT | `/{parent}/:id/expenses/:expenseId` | Creator or admin |
| DELETE | `/{parent}/:id/expenses/:expenseId` | Creator or admin |
| GET | `/{parent}/:id/balances` | Simplified debts + my balance |
| POST | `/{parent}/:id/settlements` | Record a payment |

**Add expense body:**
```json
{
  "description": "Venue Booking",
  "amount": 6000,
  "category": "general",
  "paidBy": "uuid-alice",
  "splitType": "equal",
  "splitAmong": [
    { "userId": "uuid-alice" },
    { "userId": "uuid-bob" }
  ]
}
```

**`splitType` options:**
- `"equal"` — `splitAmong` needs only `userId`
- `"amount"` — each entry needs `userId` + `amount` (must sum to total)
- `"percentage"` — each entry needs `userId` + `percentage` (must sum to 100)

**Valid categories:** `general` · `transportation` · `accommodation` · `entertainment` · `shopping` · `food` · `other`

**Balances response:**
```json
{
  "debts": [
    { "from": "uuid-bob", "to": "uuid-alice", "fromName": "Bob", "toName": "You", "amount": 3000 }
  ],
  "myBalance": 3000,
  "totalExpenses": "16000"
}
```

**Settle up body:**
```json
{ "withUserId": "uuid-alice", "amount": 3000 }
```

### 6.4 Polls

| Method | URL | Notes |
|---|---|---|
| GET | `/{parent}/:id/polls` | Returns all polls with vote counts |
| POST | `/{parent}/:id/polls` | Create poll |
| POST | `/{parent}/:id/polls/:pollId/vote` | Cast/change vote (upsert) |

**Create poll body:**
```json
{
  "question": "Which decoration theme?",
  "options": ["Bollywood", "Traditional", "Modern Glam", "Minimal"]
}
```
Min 2 options, max 10.

**Poll response shape:**
```json
{
  "id": "uuid",
  "question": "Which decoration theme?",
  "myVotedOptionId": "uuid-option",
  "options": [
    { "id": "uuid", "text": "Bollywood", "voteCount": 2, "percentage": 66.67, "isMyVote": true }
  ]
}
```

**Vote body:** `{ "optionId": "uuid-option" }` — one vote per user, re-voting changes the vote.

### 6.5 Notes

| Method | URL | Notes |
|---|---|---|
| GET | `/{parent}/:id/notes` | Favorited notes sorted first |
| POST | `/{parent}/:id/notes` | Create |
| PUT | `/{parent}/:id/notes/:noteId` | Any member can edit |
| DELETE | `/{parent}/:id/notes/:noteId` | Creator or admin |
| POST | `/trips/:id/notes/:noteId/favorite` | Toggle favorite (trips only) |

**Note body:**
```json
{ "title": "Guest List", "content": "Alice, Bob, Charlie.", "category": "important" }
```
**Valid categories:** `general` · `idea` · `important` · `todo`

> ⚠️ `POST /trips/:id/notes/:noteId/favorite` exists only for trips — not for events.

**Note response:**
```json
{
  "id": "uuid",
  "parentType": "event",
  "parentId": "uuid",
  "title": "Guest List",
  "content": "Alice, Bob, Charlie.",
  "category": "important",
  "isFavorited": false,
  "createdBy": { "userId": "uuid", "name": "Alice", "avatarUrl": "..." },
  "lastEditedBy": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 7. Friends & Invites

### 7.1 Friends

| Method | URL | Notes |
|---|---|---|
| GET | `/friends` | List accepted friends |
| GET | `/friends/requests` | Incoming friend requests |
| PUT | `/friends/requests/:connectionId/accept` | Accept |
| PUT | `/friends/requests/:connectionId/decline` | Decline |
| POST | `/friends/request/:userId` | Send friend request |
| DELETE | `/friends/:userId` | Remove friend |

### 7.2 Friend Invite Links

```js
// Generate a Branch smart link for friend invite
POST /friends/invite
// → { token, branchUrl, expiresAt }
```

### 7.3 Invite Claim Flow

All Branch deep links route through:
```
POST /invites/claim/:token
```
This handles `type: friend | trip | event` automatically. Response includes `type` so the app knows where to navigate.

```json
// Event invite claim response
{ "type": "event", "eventId": "uuid", "eventName": "Diwali Night 2026" }
```

---

## 8. User Profiles

| Method | URL | Notes |
|---|---|---|
| GET | `/users/search?q=alice` | Search by name or email |
| GET | `/users/:userId` | User profile |
| PUT | `/users/me` | Update own profile |
| GET | `/users/:userId/gallery` | Past trips + events |

---

## 9. Deep Links & Branch Smart Links

### URL Scheme
```
gathergo://invite/:token
gathergo://event/:eventId
gathergo://trip/:tripId
```

### Handling Incoming Links
```js
// In your Linking handler
const handleDeepLink = async (url) => {
  const token = extractToken(url);
  if (token) {
    const result = await api.post(`/invites/claim/${token}`);
    if (result.data.type === 'event') {
      navigation.navigate('EventDetail', { eventId: result.data.eventId });
    } else if (result.data.type === 'trip') {
      navigation.navigate('TripDetail', { tripId: result.data.tripId });
    } else if (result.data.type === 'friend') {
      navigation.navigate('Friends');
    }
  }
};
```

---

## 10. Push Notifications (FCM)

### FCM Payload Types

| `data.type` | Trigger | Navigate to |
|---|---|---|
| `TRIP_MEMBER_ADDED` | Added to trip | `TripDetail` screen |
| `EVENT_MEMBER_ADDED` | Added to event | `EventDetail` screen |
| `TRIP_INVITE_ACCEPTED` | Someone accepted trip invite | `TripDetail` → members |
| `EVENT_INVITE_ACCEPTED` | Someone accepted event invite | `EventDetail` → members |
| `FRIEND_REQUEST` | Someone sent friend request | `Friends` → requests |

### Registering FCM Token
```js
// After login, save FCM token to backend
const fcmToken = await messaging().getToken();
await api.put('/users/me', { fcmToken });
```

---

## 11. Navigation Structure

```
RootNavigator
├── AuthStack
│   ├── Login
│   ├── Register
│   ├── VerifyOTP
│   └── CompleteProfile
└── AppTabs (bottom tabs)
    ├── HomeTab → HomeScreen
    ├── TripsTab
    │   ├── TripList
    │   ├── TripDetail
    │   │   ├── TripOverview (stats)
    │   │   ├── TripMembers
    │   │   ├── TripActivities
    │   │   ├── TripDocs
    │   │   ├── TripPhotos
    │   │   ├── TripExpenses
    │   │   ├── TripPolls
    │   │   └── TripNotes
    │   └── CreateTrip
    ├── EventsTab
    │   ├── EventList
    │   ├── EventDetail
    │   │   ├── EventOverview (stats — no activities)
    │   │   ├── EventMembers
    │   │   ├── EventDocs
    │   │   ├── EventPhotos
    │   │   ├── EventExpenses
    │   │   ├── EventPolls
    │   │   └── EventNotes
    │   └── CreateEvent
    └── ProfileTab
        ├── MyProfile
        ├── Friends
        └── Settings
```

---

## 12. Error Handling Conventions

All API errors follow this shape:
```json
{ "error": "ERROR_CODE", "message": "Human readable message", "statusCode": 400 }
```

### Common Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid input fields |
| `NOT_A_FRIEND` | 400 | friendId is not an accepted friend |
| `FORBIDDEN` | 403 | Not a member or not admin |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Already exists (e.g. invite already accepted) |
| `TOKEN_EXPIRED` | 410 | Invite token expired |
| `LAST_ADMIN` | 422 | Cannot remove last admin |
| `LIMIT_EXCEEDED` | 422 | Max docs/photos reached |
| `RATE_LIMIT` | 429 | Too many invite requests |
| `INVALID_FILE_TYPE` | 400 | Wrong file format uploaded |
| `FILE_TOO_LARGE` | 400 | File exceeds size limit |

### Recommended Pattern
```js
try {
  const res = await api.post('/events', body);
  // handle success
} catch (err) {
  const { error, message, statusCode } = err.response?.data || {};
  if (error === 'NOT_A_FRIEND') {
    showAlert('Not a friend', message);
  } else if (statusCode === 401) {
    // token expired — interceptor handles refresh, but if refresh also fails:
    logout();
  } else {
    showAlert('Error', message || 'Something went wrong');
  }
}
```

---

## Seeded Test Data (from `node seed.js`)

| Resource | ID | Details |
|---|---|---|
| Alice (primary) | `a0000000-0000-4000-8000-000000000001` | `test@gathergo.com` |
| Bob (friend) | `a0000000-0000-4000-8000-000000000002` | `bob@gathergo.com` |
| Charlie (friend) | `a0000000-0000-4000-8000-000000000003` | `charlie@gathergo.com` |
| Upcoming Trip | `b0000000-0000-4000-8000-000000000001` | Goa Trip 2027 |
| Upcoming Event | `e1000000-0000-4000-8000-000000000001` | Diwali Night 2026 |
| Past Event | `e1000000-0000-4000-8000-000000000002` | Holi 2024 |
| Trip invite token | `trip-invite-seed-token-001` | For Goa trip |
| Event invite token | `event-invite-seed-token-001` | For Diwali event |
| Friend invite token | `friend-invite-seed-token-001` | Alice's friend invite |

Password for all seed users: **TestPass123!**
