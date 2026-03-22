# GatherGo — Frontend Integration Guide

> **Version:** M1 + M2 + M4 + Shared-Tables Architecture
> **Base URL:** `http://<YOUR_SERVER_HOST>:<PORT>` (e.g. `http://10.0.2.2:3000` for Android emulator)
> **Last updated:** 2026-03-22

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication & Token Management](#2-authentication--token-management)
3. [User Onboarding Flow](#3-user-onboarding-flow)
4. [Home Dashboard](#4-home-dashboard)
5. [Trips — Core CRUD](#5-trips--core-crud)
6. [Trip Members](#6-trip-members)
7. [Trip Activities](#7-trip-activities)
8. [Shared Features (Expenses, Docs, Photos, Notes, Polls)](#8-shared-features)
9. [Friends](#9-friends)
10. [Invites & Deep Links (Branch.io)](#10-invites--deep-links)
11. [File Upload Guidelines](#11-file-upload-guidelines)
12. [Push Notifications (FCM)](#12-push-notifications-fcm)
13. [Error Handling Reference](#13-error-handling-reference)
14. [Seeded Test Data](#14-seeded-test-data)
15. [Screen-by-Screen API Map](#15-screen-by-screen-api-map)

---

## 1. Architecture Overview

### What's been built

| Module | Base path | Description |
|--------|-----------|-------------|
| Auth | `/auth` | Signup, login, OTP verify, OAuth (Google/Facebook), token refresh |
| Users | `/users` | Profile create/update, avatar upload, user search |
| Home | `/home` | Personalised dashboard (upcoming trips, ongoing trip, friend requests badge) |
| Trips | `/trips` | Full trip lifecycle — CRUD, members, activities, expenses, docs, photos, notes, polls |
| Friends | `/friends` | Friend requests, friends list, Branch.io invite links |
| Invites | `/invites` | Universal deep-link claim endpoint (handles both friend + trip invites) |

### Shared Table Pattern (important to understand)

Expenses, docs, photos, notes, and polls are stored in **shared tables** with a `parent_type` column (`'trip'` or `'event'`). This means the API for these features is **the same** whether it's under a trip or a future event. From the frontend perspective, **the URL structure hasn't changed** — you still use `/trips/:id/expenses`, `/trips/:id/docs`, etc. The shared tables are an internal backend concern.

### Request format

- **Content-Type:** `application/json` for all JSON bodies
- **Auth header:** `Authorization: Bearer <accessToken>` on all protected routes
- **File uploads:** `multipart/form-data` — see [Section 11](#11-file-upload-guidelines)

---

## 2. Authentication & Token Management

### Token Lifecycle

```
accessToken  — expires in 15 minutes
refreshToken — expires in 30 days, single-use (rotates on every refresh)
```

**Store both tokens securely** (e.g. React Native `SecureStore` / Android Keystore). Never store in AsyncStorage for production.

### Refresh strategy (interceptor pattern)

```js
// Pseudocode — attach this as an Axios/Fetch interceptor
async function requestWithRefresh(config) {
  try {
    return await api.request(config);
  } catch (err) {
    if (err.response?.status === 401 && err.response?.data?.error === 'TokenExpired') {
      const { accessToken, refreshToken } = await callRefresh(storedRefreshToken);
      saveTokens(accessToken, refreshToken);
      config.headers.Authorization = `Bearer ${accessToken}`;
      return await api.request(config);
    }
    throw err;
  }
}
```

> **Important:** On `401 InvalidRefreshToken` from `/auth/refresh`, clear tokens and navigate to the login screen — the session is dead.

---

### `POST /auth/signup`

Register with email + password. No tokens issued yet — user must verify email first.

**Request body:**
```json
{
  "email": "alice@example.com",
  "password": "Secret123!",
  "phone": "+919876543210"   // optional
}
```

**Response `201`:**
```json
{
  "message": "Account created successfully",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "phone": "+919876543210",
    "isProfileComplete": false,
    "isVerified": false
  },
  "message": "Registration successful. Please verify your email with the OTP sent."
}
```

> A 6-digit OTP is emailed to the user. Tokens are **not** issued here — issue them after `/auth/verify-email`.

---

### `POST /auth/verify-email`

**Request body:**
```json
{
  "email": "alice@example.com",
  "otp": "847291"
}
```

**Response `200`:**
```json
{
  "message": "Email verified successfully",
  "user": { "id": "uuid", "email": "alice@example.com", "isVerified": true },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

> **After this step:** store tokens, check `user.isProfileComplete`. If `false`, redirect to profile creation screen. If `true`, go to Home.

---

### `POST /auth/resend-otp`

**Request body:**
```json
{
  "email": "alice@example.com",
  "purpose": "email-verification"   // or "password-reset"
}
```

**Response `200`:** `{ "message": "A new code has been sent." }`

---

### `POST /auth/login`

**Request body:**
```json
{
  "email": "alice@example.com",
  "password": "Secret123!",
  "deviceToken": "fcm_device_token_string",  // optional, for push notifications
  "platform": "android"                       // "android" or "ios"
}
```

**Response `200`:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "isProfileComplete": true,
    "isVerified": true
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

> Check `isProfileComplete` after login. If `false`, redirect to profile creation. If `true`, go to Home.

---

### `POST /auth/google`

**Request body:**
```json
{
  "idToken": "<Google ID Token from Google Sign-In SDK>",
  "deviceToken": "fcm_token",   // optional
  "platform": "android"
}
```

**Response `200`:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "isProfileComplete": false,
    "isNewUser": true
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

> `isNewUser: true` → redirect to profile creation. `isNewUser: false` → go to Home.

---

### `POST /auth/facebook`

**Request body:**
```json
{
  "accessToken": "<Facebook Access Token>",
  "deviceToken": "fcm_token",
  "platform": "ios"
}
```

Same response shape as Google auth.

---

### `POST /auth/refresh`

Call this whenever an access token expires (or proactively).

**Request body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response `200`:**
```json
{
  "message": "Tokens refreshed",
  "user": { "id": "uuid", "email": "alice@example.com", "isProfileComplete": true },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."   // NEW refresh token — replace the old one
}
```

---

### `POST /auth/logout`

**Headers:** `Authorization: Bearer <accessToken>`
**Request body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response `200`:** `{ "message": "Logged out successfully" }`

---

### `POST /auth/forgot-password`

**Request body (one of):**
```json
{ "email": "alice@example.com" }
// or
{ "phone": "+919876543210" }
```

**Response `200`:** `{ "message": "If an account exists, a reset code has been sent." }`

> Always returns 200 to prevent email enumeration.

---

### `POST /auth/reset-password`

**Request body:**
```json
{
  "email": "alice@example.com",
  "otp": "192837",
  "password": "NewSecret456!"
}
```

**Response `200`:** `{ "message": "Password reset successful. Please login with your new password." }`

> All active sessions are invalidated on password reset — force re-login.

---

### `GET /auth/me`

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`:**
```json
{
  "message": "User profile fetched",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "phone": "+919876543210",
    "isProfileComplete": true,
    "isVerified": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "profile": {
      "fullName": "Alice Smith",
      "dob": "1995-06-15",
      "gender": "female",
      "country": "IN",
      "bio": "Love travelling",
      "avatarUrl": "https://cdn.gathergoo.com/avatars/..."
    }
  }
}
```

---

## 3. User Onboarding Flow

### Step 1 — Signup or OAuth
Call `/auth/signup`, `/auth/google`, or `/auth/facebook`.

### Step 2 — OTP Verification (email/password only)
Call `/auth/verify-email` with the 6-digit code. Store returned tokens.

### Step 3 — Profile Creation
**Only needed when `isProfileComplete === false`.**

```
POST /users/profile
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "fullName": "Alice Smith",
  "dob": "1995-06-15",        // YYYY-MM-DD, optional
  "gender": "female",          // "male" | "female" | "other", optional
  "country": "IN",             // ISO 3166-1 alpha-2, optional
  "bio": "Love travelling"     // max 500 chars, optional
}
```

**Response `200`:**
```json
{
  "message": "Profile saved successfully",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "isProfileComplete": true,
    "profile": {
      "fullName": "Alice Smith",
      "dob": "1995-06-15",
      "gender": "female",
      "country": "IN",
      "bio": "Love travelling",
      "avatarUrl": null
    }
  }
}
```

### Step 4 — Upload Avatar (optional, can be done later)

```
PUT /users/photo
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

field name: "photo"
max size: 5 MB
accepted types: JPEG, PNG, WEBP
```

**Response `200`:**
```json
{
  "message": "Profile photo uploaded successfully",
  "avatarUrl": "https://cdn.gathergoo.com/avatars/uuid-photo.jpg"
}
```

---

### Update Profile

```
PUT /users/profile
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Same fields as `POST /users/profile` — all fields optional (only provided fields are updated).

---

### Search Users

```
GET /users/search?q=alice
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "alice_s",
      "fullName": "Alice Smith",
      "avatarUrl": "https://...",
      "friendshipStatus": "none"  // "none" | "pending" | "accepted"
    }
  ]
}
```

---

### Get User Profile

```
GET /users/:id/profile
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "fullName": "Alice Smith",
    "avatarUrl": "https://...",
    "country": "IN",
    "bio": "Love travelling",
    "friendshipStatus": "accepted",
    "mutualTripCount": 3,
    "tripCount": 12
  }
}
```

---

### Get User Gallery (past trips)

```
GET /users/:id/gallery
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "trips": [
    {
      "id": "uuid",
      "name": "Goa 2025",
      "coverPhotoUrl": "https://...",
      "startDate": "2025-01-10",
      "endDate": "2025-01-17"
    }
  ]
}
```

---

## 4. Home Dashboard

```
GET /home
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Alice Smith",
    "avatarUrl": "https://..."
  },
  "upcomingTrips": [
    {
      "id": "uuid",
      "name": "Manali 2026",
      "location": "Manali, Himachal Pradesh",
      "startDate": "2026-04-10",
      "endDate": "2026-04-17",
      "coverPhotoUrl": null,
      "daysToGo": 19,
      "memberAvatars": ["https://...", "https://..."]
    }
  ],
  "upcomingEvents": [],
  "ongoing": {
    "id": "uuid",
    "name": "Goa Trip",
    "location": "Goa, India",
    "endDate": "2026-03-25",
    "type": "trip"
  },
  "pendingFriendRequests": 2
}
```

> `ongoing` is `null` if no active trip/event right now.
> `pendingFriendRequests` drives the notification badge on the Friends tab.
> `upcomingEvents` is always `[]` until the Events module is built (M3).

---

## 5. Trips — Core CRUD

### Create Trip

```
POST /trips
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "name": "Goa 2026",
  "startDate": "2026-05-01",
  "endDate": "2026-05-07",
  "location": {
    "name": "Goa, India",
    "lat": 15.2993,
    "lng": 74.1240
  },
  "reminders": true,
  "friendIds": ["uuid-bob", "uuid-carol"],  // optional — direct add (must already be friends)
  "emails": ["dave@example.com"]            // optional — send email invite link
}
```

**Response `201`:**
```json
{
  "trip": {
    "id": "uuid",
    "name": "Goa 2026",
    "startDate": "2026-05-01",
    "endDate": "2026-05-07",
    "location": {
      "name": "Goa, India",
      "lat": 15.2993,
      "lng": 74.1240
    },
    "coverPhotoUrl": null,
    "createdBy": "uuid-alice",
    "createdAt": "2026-03-22T10:00:00.000Z"
  }
}
```

> Creator is auto-added as `admin`. `friendIds` members are added silently as `member`. Email invitees get a Branch smart link.

---

### Get My Trips

```
GET /trips?status=upcoming&page=1&limit=20
Authorization: Bearer <accessToken>
```

| Query param | Values | Default |
|-------------|--------|---------|
| `status` | `upcoming`, `ongoing`, `past` | all trips |
| `page` | integer | 1 |
| `limit` | integer | 20 |

**Response `200`:**
```json
{
  "trips": [ /* array of trip objects */ ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

---

### Get Trip Detail

```
GET /trips/:id
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "trip": {
    "id": "uuid",
    "name": "Goa 2026",
    "startDate": "2026-05-01",
    "endDate": "2026-05-07",
    "location": { "name": "Goa, India", "lat": 15.2993, "lng": 74.1240 },
    "coverPhotoUrl": null,
    "createdBy": "uuid-alice",
    "daysToGo": 40,
    "memberCount": 4,
    "photoVideoCount": 12,
    "docCount": 3,
    "totalExpenseAmount": "8500.00"
  },
  "role": "admin"
}
```

---

### Update Trip

**Admin only.**

```
PUT /trips/:id
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Any subset of `name`, `startDate`, `endDate`, `location`.

**Response `200`:** `{ "trip": { ...updatedFields } }`

---

### Delete Trip

**Admin only.** Deletes trip + all S3 files.

```
DELETE /trips/:id
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true }`

---

### Invite Members to Existing Trip

```
POST /trips/:id/invite
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "friendIds": ["uuid-bob"],       // optional — direct add
  "emails": ["dave@example.com"]  // optional — generates invite link + sends email
}
```

**Response `200`:**
```json
{
  "added": ["uuid-bob"],
  "invited": [
    {
      "email": "dave@example.com",
      "token": "abc123",
      "branchUrl": "https://gathergo.app.link/xyz",
      "expiresAt": "2026-03-29T10:00:00.000Z"
    }
  ]
}
```

> Rate-limited: max 20 invites per 15 minutes.

---

### Get / Accept Trip Invite (token flow)

**Preview invite (no auth needed):**
```
GET /trips/invite/:token
```

**Response `200`:**
```json
{
  "tripId": "uuid",
  "tripName": "Goa 2026",
  "inviterName": "Alice Smith",
  "expiresAt": "2026-03-29T10:00:00.000Z"
}
```

**Accept invite:**
```
POST /trips/invite/:token/accept
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true, "tripId": "uuid" }`

> See also: the unified `/invites/claim/:token` endpoint in [Section 10](#10-invites--deep-links) — this is preferred for deep link handling.

---

## 6. Trip Members

### Get Members

```
GET /trips/:id/members
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "members": [
    {
      "userId": "uuid-alice",
      "fullName": "Alice Smith",
      "avatarUrl": "https://...",
      "role": "admin",
      "joinedAt": "2026-03-20T08:00:00.000Z"
    },
    {
      "userId": "uuid-bob",
      "fullName": "Bob Jones",
      "avatarUrl": null,
      "role": "member",
      "joinedAt": "2026-03-21T09:00:00.000Z"
    }
  ]
}
```

---

### Remove Member

**Admin only.** Cannot remove yourself (use Delete Trip instead).

```
DELETE /trips/:id/members/:userId
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true }`

---

## 7. Trip Activities

Activities are **trip-specific** (not shared with events). An activity is a planned item like "Beach Day" or "Scuba Diving". Each activity can have up to **20 photos**.

### Get Activities

```
GET /trips/:id/activities
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "activities": [
    {
      "id": "uuid",
      "tripId": "uuid-trip",
      "title": "Scuba Diving",
      "description": "Book at Blue Waters dive shop",
      "date": "2026-05-03",
      "time": "09:00:00",
      "location": "Baga Beach",
      "cost": "1500.00",
      "createdBy": "uuid-alice",
      "createdAt": "2026-03-22T10:00:00.000Z",
      "photoCount": 3
    }
  ]
}
```

---

### Create Activity

```
POST /trips/:id/activities
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "title": "Scuba Diving",
  "description": "Book at Blue Waters dive shop",
  "date": "2026-05-03",            // YYYY-MM-DD, optional
  "time": "09:00",                  // HH:MM, optional
  "location": "Baga Beach",         // optional
  "cost": 1500                      // number, optional
}
```

**Response `201`:** `{ "activity": { ...activityObject } }`

---

### Update Activity

Creator or admin only.

```
PUT /trips/:id/activities/:actId
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Send only fields to update. Response `200`: `{ "activity": { ...updatedActivity } }`

---

### Delete Activity

Creator or admin only.

```
DELETE /trips/:id/activities/:actId
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true }`

---

### Upload Activity Photos (up to 5 per request, 20 total per activity)

```
POST /trips/:id/activities/:actId/photos
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

field name: "photos"  (multiple files)
max per request: 5 files
max per activity: 20 photos
max file size: 10 MB each
accepted: JPEG, PNG, WEBP, MP4, MOV
```

**Response `201`:**
```json
{
  "photos": [
    {
      "id": "uuid",
      "url": "https://cdn.gathergoo.com/trips/uuid/activities/uuid-photo.jpg",
      "uploadedBy": "uuid-alice",
      "uploadedAt": "2026-03-22T10:00:00.000Z"
    }
  ]
}
```

---

### Get Activity Photos

```
GET /trips/:id/activities/:actId/photos
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "photos": [ ...photoObjects ] }`

---

### Delete Activity Photo

Uploader or admin only.

```
DELETE /trips/:id/activities/:actId/photos/:photoId
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true }`

---

## 8. Shared Features

These features (Expenses, Docs, Photos, Notes, Polls) all live under `/trips/:id/...` but are backed by shared tables. The same APIs will work for events when that module is built.

---

### 8.1 Expenses

#### Add Expense

```
POST /trips/:id/expenses
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body (equal split):**
```json
{
  "description": "Hotel check-in",
  "amount": 6000,
  "currency": "INR",
  "category": "accommodation",
  "splitType": "equal",
  "splitAmong": [
    { "userId": "uuid-alice" },
    { "userId": "uuid-bob" },
    { "userId": "uuid-carol" }
  ]
}
```

**Request body (custom amounts):**
```json
{
  "description": "Dinner",
  "amount": 1500,
  "currency": "INR",
  "category": "food",
  "splitType": "amount",
  "splitAmong": [
    { "userId": "uuid-alice", "amount": 700 },
    { "userId": "uuid-bob", "amount": 500 },
    { "userId": "uuid-carol", "amount": 300 }
  ]
}
```

**Request body (percentage split):**
```json
{
  "description": "Bike rental",
  "amount": 2000,
  "currency": "INR",
  "category": "transportation",
  "splitType": "percentage",
  "splitAmong": [
    { "userId": "uuid-alice", "percentage": 50 },
    { "userId": "uuid-bob", "percentage": 30 },
    { "userId": "uuid-carol", "percentage": 20 }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `description` | string | Yes | |
| `amount` | number | Yes | |
| `currency` | string | No | Defaults to `INR` |
| `category` | string | No | `general`, `transportation`, `accommodation`, `entertainment`, `shopping`, `food`, `other` |
| `splitType` | string | Yes | `equal`, `amount`, `percentage` |
| `splitAmong` | array | Yes | Min 1 user; all must be trip members |

**Response `201`:**
```json
{
  "expense": {
    "id": "uuid",
    "description": "Hotel check-in",
    "amount": "6000.00",
    "currency": "INR",
    "category": "accommodation",
    "splitType": "equal",
    "paidBy": "uuid-alice",
    "parentType": "trip",
    "parentId": "uuid-trip",
    "createdAt": "2026-03-22T10:00:00.000Z",
    "splits": [
      { "userId": "uuid-alice", "amount": "2000.00", "percentage": null },
      { "userId": "uuid-bob", "amount": "2000.00", "percentage": null },
      { "userId": "uuid-carol", "amount": "2000.00", "percentage": null }
    ]
  },
  "balances": [ /* updated simplified debts — see Get Balances */ ]
}
```

---

#### Get Expenses

```
GET /trips/:id/expenses?category=food&page=1&limit=20
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "expenses": [ /* array of expense objects */ ],
  "total": 8,
  "page": 1,
  "limit": 20
}
```

---

#### Update Expense

Creator or admin only.

```
PUT /trips/:id/expenses/:eid
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Same fields as Add Expense (all optional). Response `200`: `{ "expense": {...}, "balances": [...] }`

---

#### Delete Expense

Creator or admin only.

```
DELETE /trips/:id/expenses/:eid
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true, "balances": [...] }`

---

#### Get Balances (simplified debts)

This returns who owes whom using greedy debt simplification (minimises the number of transactions).

```
GET /trips/:id/balances
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "debts": [
    {
      "from": "uuid-bob",
      "to": "uuid-alice",
      "amount": 2000,
      "fromName": "Bob Jones",
      "toName": "Alice Smith"
    }
  ],
  "myBalance": -2000,
  "totalExpenses": "6000.00"
}
```

> `myBalance < 0` → you owe money. `myBalance > 0` → others owe you.

---

#### Settle Debt

Records that I (the authenticated user) paid `withUserId` the given amount.

```
POST /trips/:id/settlements
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "withUserId": "uuid-alice",
  "amount": 2000
}
```

**Response `200`:** `{ "outstanding": [ /* remaining debts for the pair */ ] }`

---

### 8.2 Documents

#### Upload Document

```
POST /trips/:id/docs
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

field name: "file"
max file size: 20 MB
accepted types: PDF, DOCX, XLSX, TXT, CSV, PNG, JPG, WEBP
```

**Response `201`:**
```json
{
  "doc": {
    "id": "uuid",
    "fileName": "hotel_booking.pdf",
    "fileUrl": "https://cdn.gathergoo.com/trips/uuid/docs/uuid-hotel_booking.pdf",
    "fileSize": 245760,
    "mimeType": "application/pdf",
    "uploadedBy": "uuid-alice",
    "uploadedAt": "2026-03-22T10:00:00.000Z"
  }
}
```

---

#### Get Documents

```
GET /trips/:id/docs
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "docs": [ ...docObjects ], "total": 3 }`

---

#### Delete Document

Uploader or admin only.

```
DELETE /trips/:id/docs/:docId
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true }`

---

### 8.3 Photos / Videos

#### Upload Photos

```
POST /trips/:id/photos
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

field name: "photos"  (multiple files)
max per request: 5 files
max file size: 10 MB each
accepted: JPEG, PNG, WEBP, MP4, MOV
```

**Response `201`:**
```json
{
  "photos": [
    {
      "id": "uuid",
      "url": "https://cdn.gathergoo.com/trips/uuid/photos/uuid-photo.jpg",
      "mimeType": "image/jpeg",
      "uploadedBy": "uuid-alice",
      "uploadedAt": "2026-03-22T10:00:00.000Z"
    }
  ]
}
```

---

#### Get Photos

```
GET /trips/:id/photos
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "photos": [ ...photoObjects ], "total": 12 }`

---

#### Delete Photo

Uploader or admin only.

```
DELETE /trips/:id/photos/:photoId
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true }`

---

### 8.4 Notes

#### Create Note

```
POST /trips/:id/notes
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "title": "Things to pack",
  "content": "Sunscreen, camera, adapter...",
  "category": "todo"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | Yes | max 255 chars |
| `content` | string | Yes | max 5000 chars |
| `category` | string | No | `general`, `idea`, `important`, `todo` |

**Response `201`:**
```json
{
  "note": {
    "id": "uuid",
    "title": "Things to pack",
    "content": "Sunscreen, camera, adapter...",
    "category": "todo",
    "createdBy": "uuid-alice",
    "createdAt": "2026-03-22T10:00:00.000Z",
    "updatedAt": "2026-03-22T10:00:00.000Z"
  }
}
```

---

#### Get Notes

```
GET /trips/:id/notes
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "notes": [ ...noteObjects ], "total": 5 }`

---

#### Update Note

Creator or admin only.

```
PUT /trips/:id/notes/:noteId
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Send only fields to change. Response `200`: `{ "note": {...} }`

---

#### Delete Note

Creator or admin only.

```
DELETE /trips/:id/notes/:noteId
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true }`

---

### 8.5 Polls

#### Create Poll

```
POST /trips/:id/polls
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "question": "Which hotel should we book?",
  "options": ["Taj Holiday Village", "The Leela Goa", "Budget Hostel"]
}
```

**Response `201`:**
```json
{
  "poll": {
    "id": "uuid",
    "question": "Which hotel should we book?",
    "createdBy": "uuid-alice",
    "createdAt": "2026-03-22T10:00:00.000Z",
    "options": [
      { "id": "uuid-opt1", "text": "Taj Holiday Village", "voteCount": 0, "votedByMe": false },
      { "id": "uuid-opt2", "text": "The Leela Goa", "voteCount": 0, "votedByMe": false },
      { "id": "uuid-opt3", "text": "Budget Hostel", "voteCount": 0, "votedByMe": false }
    ],
    "totalVotes": 0,
    "myVoteOptionId": null
  }
}
```

---

#### Get Polls

```
GET /trips/:id/polls
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "polls": [ ...pollObjects ] }`

Each poll object has `votedByMe`, `myVoteOptionId` populated based on the authenticated user.

---

#### Vote on Poll

```
POST /trips/:id/polls/:pollId/vote
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "optionId": "uuid-opt2"
}
```

**Response `200`:** `{ "poll": { ...updatedPollWithVoteCounts } }`

> Voting again changes your vote (not additive). `votedByMe` will reflect the new choice.

---

## 9. Friends

### Send Friend Request

```
POST /friends/request
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "toUserId": "uuid-bob"
}
```

**Response `201`:**
```json
{
  "connectionId": "uuid",
  "status": "pending"
}
```

> Rate-limited: 20 requests per 24 hours.
> A push notification (`FRIEND_REQUEST` type) is sent to `toUserId`.

---

### Get Friend Requests

```
GET /friends/requests
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "incoming": [
    {
      "connectionId": "uuid",
      "user": {
        "id": "uuid-carol",
        "name": "Carol White",
        "avatarUrl": "https://...",
        "country": "IN"
      },
      "sentAt": "2026-03-22T09:00:00.000Z"
    }
  ],
  "outgoing": [
    {
      "connectionId": "uuid",
      "user": { "id": "uuid-dave", "name": "Dave Green", "avatarUrl": null, "country": "US" },
      "sentAt": "2026-03-21T14:00:00.000Z"
    }
  ]
}
```

---

### Accept / Decline Friend Request

```
PUT /friends/request/:connectionId
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "action": "accept"   // or "decline"
}
```

**Response `200` (accept):**
```json
{
  "connectionId": "uuid",
  "status": "accepted",
  "friend": {
    "userId": "uuid-carol",
    "name": "Carol White",
    "avatarUrl": "https://..."
  }
}
```

**Response `200` (decline):**
```json
{
  "connectionId": "uuid",
  "status": "declined"
}
```

> On accept: a push notification (`FRIEND_ACCEPTED`) is sent to the original requester.

---

### Get Friends List

```
GET /friends?search=alice
Authorization: Bearer <accessToken>
```

`search` is optional — case-insensitive, searches name and username.

**Response `200`:**
```json
{
  "friends": [
    {
      "connectionId": "uuid",
      "user": {
        "id": "uuid-alice",
        "name": "Alice Smith",
        "avatarUrl": "https://...",
        "country": "IN",
        "bio": "Love travelling"
      },
      "mutualTripCount": 3,
      "mutualEventCount": 0,
      "connectedAt": "2026-01-15T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### Remove Friend

```
DELETE /friends/:userId
Authorization: Bearer <accessToken>
```

**Response `200`:** `{ "success": true }`

---

### Invite Non-GatherGo User (Branch smart link)

Use this when you want to invite someone who doesn't have the app yet.

```
POST /friends/invite
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request body:**
```json
{
  "channels": ["share"],           // "share" | "email" — use "share" for native share sheet
  "emails": ["newuser@gmail.com"]  // only needed if channels includes "email"
}
```

**Response `201`:**
```json
{
  "token": "abc123def456",
  "branchUrl": "https://gathergo.app.link/abc123",
  "shareText": "Hey! Join me on GatherGo — https://gathergo.app.link/abc123",
  "expiresAt": "2026-03-29T10:00:00.000Z"
}
```

> Pass `branchUrl` to the native share sheet (`Share.share({ message: shareText })`).
> Rate-limited: 10 invites per hour.

---

## 10. Invites & Deep Links

### How Branch.io Deep Link Handling Works

1. User opens your app from a Branch smart link
2. Branch SDK fires a callback with the link data including `token`
3. Frontend calls `GET /invites/validate/:token` (no auth needed) to preview
4. If user is not logged in → redirect to login/signup, preserve token
5. After auth → call `POST /invites/claim/:token` to complete

---

### Validate Invite (public — no auth)

```
GET /invites/validate/:token
```

**Response `200` (valid):**
```json
{
  "valid": true,
  "type": "friend",          // "friend" | "trip"
  "token": "abc123",
  "expiresAt": "2026-03-29T10:00:00.000Z",
  "invitedBy": {
    "name": "Alice Smith",
    "avatarUrl": "https://..."
  },
  "context": {
    "tripName": null,        // populated for type="trip"
    "eventName": null
  },
  "installLinks": {
    "android": "https://play.google.com/...",
    "ios": "https://testflight.apple.com/..."
  }
}
```

**Response `200` (invalid):**
```json
{
  "valid": false,
  "reason": "EXPIRED"        // "NOT_FOUND" | "EXPIRED" | "ALREADY_CLAIMED"
}
```

> Use `installLinks` to show app store buttons if the user doesn't have the app.

---

### Claim Invite (authenticated)

```
POST /invites/claim/:token
Authorization: Bearer <accessToken>
```

**Response `200` (friend invite):**
```json
{
  "type": "friend",
  "status": "pending",       // "pending" | "accepted" (if already friends)
  "connectionId": "uuid"
}
```

**Response `200` (trip invite):**
```json
{
  "type": "trip",
  "tripId": "uuid",
  "tripName": "Goa 2026"
}
```

> After claiming a trip invite, navigate to `GET /trips/:tripId` to show the trip.
> After claiming a friend invite (`status: "pending"`), the inviter receives a `FRIEND_REQUEST` push and must accept.

---

## 11. File Upload Guidelines

### Common rules
- All uploads use `multipart/form-data`
- Magic-byte MIME validation — file extension alone is not enough; the actual file bytes are checked
- CloudFront CDN URLs are returned — these are persistent, cache-friendly URLs

### Upload limits by endpoint

| Endpoint | Field | Max files | Max size | Accepted types |
|----------|-------|-----------|----------|----------------|
| `PUT /users/photo` | `photo` | 1 | 5 MB | JPEG, PNG, WEBP |
| `POST /trips/:id/photos` | `photos` | 5 per request | 10 MB each | JPEG, PNG, WEBP, MP4, MOV |
| `POST /trips/:id/activities/:actId/photos` | `photos` | 5 per request (20 total) | 10 MB each | JPEG, PNG, WEBP, MP4, MOV |
| `POST /trips/:id/docs` | `file` | 1 | 20 MB | PDF, DOCX, XLSX, TXT, CSV, PNG, JPG, WEBP |

### React Native example (using `react-native-image-picker` + `axios`)

```js
import ImagePicker from 'react-native-image-picker';
import axios from 'axios';

const uploadTripPhoto = async (tripId, accessToken) => {
  const result = await ImagePicker.launchImageLibrary({
    mediaType: 'mixed',       // photo + video
    selectionLimit: 5,
  });

  if (result.didCancel || !result.assets) return;

  const formData = new FormData();
  result.assets.forEach((asset) => {
    formData.append('photos', {
      uri: asset.uri,
      type: asset.type,        // e.g. "image/jpeg"
      name: asset.fileName,
    });
  });

  const response = await axios.post(`/trips/${tripId}/photos`, formData, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.photos;
};
```

### Multer error codes

| Error | Meaning |
|-------|---------|
| `LIMIT_FILE_SIZE` | File exceeds the size limit |
| `LIMIT_FILE_COUNT` | More files sent than allowed |
| `INVALID_MIME_TYPE` | File type not allowed (checked by magic bytes, not extension) |

---

## 12. Push Notifications (FCM)

The backend sends **fire-and-forget FCM push notifications**. Your app receives them via the FCM SDK.

### Register device token

Pass `deviceToken` and `platform` on every login (including Google/Facebook OAuth). The backend registers/updates the SNS endpoint automatically.

### Notification types

Each notification includes a `data` payload with a `type` field. Use this to route to the correct screen.

| Type | When sent | `data` payload |
|------|-----------|----------------|
| `FRIEND_REQUEST` | When someone sends a friend request | `{ type, connectionId, fromUserId, screen: "friends" }` |
| `FRIEND_ACCEPTED` | When your friend request is accepted | `{ type, connectionId, userId, screen: "friends" }` |
| `TRIP_INVITE_ACCEPTED` | When someone accepts your trip invite | `{ type, tripId, newMemberId, screen: "trip" }` |

### Handling in React Native

```js
import messaging from '@react-native-firebase/messaging';

// Background / quit state
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const { type, tripId, screen } = remoteMessage.data;
  // Store for navigation after app opens
});

// Foreground
messaging().onMessage(async (remoteMessage) => {
  const { type, connectionId, screen } = remoteMessage.data;
  if (type === 'FRIEND_REQUEST') {
    // Show in-app notification badge
    setBadgeCount(prev => prev + 1);
  }
});
```

---

## 13. Error Handling Reference

All error responses follow this shape:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "statusCode": 400
}
```

### HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthenticated (missing or invalid token) |
| 403 | Forbidden (authenticated but not allowed) |
| 404 | Resource not found |
| 409 | Conflict (duplicate, already exists) |
| 410 | Gone (expired token/invite) |
| 422 | Unprocessable (business rule violation, e.g. split amounts don't add up) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### Common error codes

| `error` | Cause | Action |
|---------|-------|--------|
| `TokenExpired` | Access token expired | Refresh silently |
| `InvalidRefreshToken` | Refresh token invalid/expired | Force logout |
| `EmailExists` | Email already registered | Show "Already have an account?" |
| `InvalidCredentials` | Wrong email/password | Show error message |
| `GoogleOnlyAccount` | Email registered via Google, no password set | Prompt Google login |
| `SELF_REQUEST` | Sending friend request to self | Shouldn't reach server |
| `ALREADY_FRIENDS` | Already connected | Show status in UI |
| `REQUEST_ALREADY_EXISTS` | Pending request exists | Show pending state |
| `ADMIN_REQUIRED` | Non-admin tried an admin action | Show permission error |
| `NOT_FOUND` | Resource doesn't exist | 404 screen or ignore |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Show "Try again later" with `retryAfter` |
| `VALIDATION_ERROR` | Missing/invalid fields | Show field-level errors |
| `INVALID_INVITE` | Invite expired or already claimed | Show appropriate message |

### Validation errors (400)

When a validation rule fails, the response may include an `errors` array:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "statusCode": 400,
  "errors": [
    { "field": "email", "message": "Must be a valid email address" },
    { "field": "password", "message": "Must be at least 8 characters" }
  ]
}
```

---

## 14. Seeded Test Data

Use these IDs for development/testing. Run `node backend/seed.js` to populate.

### Users

| User | UUID | Email | Password |
|------|------|-------|----------|
| Alice (admin) | `a1a1a1a1-0000-0000-0000-000000000001` | `alice@example.com` | `Password123!` |
| Bob | `b2b2b2b2-0000-0000-0000-000000000002` | `bob@example.com` | `Password123!` |
| Carol | `c3c3c3c3-0000-0000-0000-000000000003` | `carol@example.com` | `Password123!` |
| Dave | `d4d4d4d4-0000-0000-0000-000000000004` | `dave@example.com` | `Password123!` |

### Trips

| Trip | UUID |
|------|------|
| Goa Beach Trip | `aaaa0001-0000-0000-0000-000000000001` |
| Manali Snow Trip | `aaaa0002-0000-0000-0000-000000000002` |

### Friends

Alice ↔ Bob are already connected (`accepted`).

### Expenses

| Expense | Amount | Paid by |
|---------|--------|---------|
| Hotel check-in | ₹6000 | Alice |
| Dinner at Shack | ₹1500 | Bob |

---

## 15. Screen-by-Screen API Map

### Splash / App Init
1. Check for stored `refreshToken`
2. If exists → `POST /auth/refresh` → store new tokens
3. If `isProfileComplete === false` → go to Profile Creation
4. If valid → go to Home

---

### Auth Screens
- **Signup:** `POST /auth/signup` → OTP screen
- **OTP Verify:** `POST /auth/verify-email` → store tokens → check `isProfileComplete`
- **Resend OTP:** `POST /auth/resend-otp`
- **Login:** `POST /auth/login` → store tokens → check `isProfileComplete`
- **Google Login:** `POST /auth/google` → same as login
- **Facebook Login:** `POST /auth/facebook` → same as login
- **Forgot Password:** `POST /auth/forgot-password` → OTP screen → `POST /auth/reset-password`

---

### Profile Creation Screen
- **Save profile:** `POST /users/profile`
- **Upload avatar (optional):** `PUT /users/photo`

---

### Home Screen
- **Load:** `GET /home`
- **Refresh:** re-call `GET /home`
- Tap upcoming trip → Trip Detail screen
- Tap ongoing → Trip Detail screen
- Friend requests badge → Friends/Requests screen

---

### Trips List Screen
- **Load:** `GET /trips?status=upcoming` (or `ongoing`, `past`)
- Tap trip → Trip Detail screen
- Tap "+" → Create Trip screen

---

### Create Trip Screen
- **Submit:** `POST /trips`
- **Pick friends from list:** `GET /friends` (for the friend picker)

---

### Trip Detail Screen
- **Load:** `GET /trips/:id`
- **Load members:** `GET /trips/:id/members`
- **Tab — Activities:** `GET /trips/:id/activities`
- **Tab — Expenses:** `GET /trips/:id/expenses` + `GET /trips/:id/balances`
- **Tab — Photos:** `GET /trips/:id/photos`
- **Tab — Docs:** `GET /trips/:id/docs`
- **Tab — Notes:** `GET /trips/:id/notes`
- **Tab — Polls:** `GET /trips/:id/polls`
- **Invite button:** `POST /trips/:id/invite`
- **Settings (admin):** `PUT /trips/:id`, `DELETE /trips/:id`

---

### Expense Screen
- **Add:** `POST /trips/:id/expenses`
- **Edit (creator/admin):** `PUT /trips/:id/expenses/:eid`
- **Delete (creator/admin):** `DELETE /trips/:id/expenses/:eid`
- **View balances:** `GET /trips/:id/balances`
- **Settle:** `POST /trips/:id/settlements`

---

### Activity Screen
- **List:** `GET /trips/:id/activities`
- **Create:** `POST /trips/:id/activities`
- **Edit:** `PUT /trips/:id/activities/:actId`
- **Delete:** `DELETE /trips/:id/activities/:actId`
- **Upload photos:** `POST /trips/:id/activities/:actId/photos`
- **View photos:** `GET /trips/:id/activities/:actId/photos`

---

### Photos Screen
- **Load:** `GET /trips/:id/photos`
- **Upload:** `POST /trips/:id/photos`
- **Delete:** `DELETE /trips/:id/photos/:photoId`

---

### Docs Screen
- **Load:** `GET /trips/:id/docs`
- **Upload:** `POST /trips/:id/docs`
- **Delete:** `DELETE /trips/:id/docs/:docId`

---

### Notes Screen
- **Load:** `GET /trips/:id/notes`
- **Create:** `POST /trips/:id/notes`
- **Edit:** `PUT /trips/:id/notes/:noteId`
- **Delete:** `DELETE /trips/:id/notes/:noteId`

---

### Polls Screen
- **Load:** `GET /trips/:id/polls`
- **Create:** `POST /trips/:id/polls`
- **Vote:** `POST /trips/:id/polls/:pollId/vote`

---

### Friends Screen
- **Friends list:** `GET /friends?search=query`
- **Requests tab:** `GET /friends/requests`
- **Accept request:** `PUT /friends/request/:connectionId` with `{ "action": "accept" }`
- **Decline request:** `PUT /friends/request/:connectionId` with `{ "action": "decline" }`
- **Remove friend:** `DELETE /friends/:userId`
- **Send request (from search):** `POST /friends/request` with `{ "toUserId": "uuid" }`
- **Search users:** `GET /users/search?q=name`

---

### Invite a Friend Screen
- **Generate link:** `POST /friends/invite` with `{ "channels": ["share"] }`
- Pass `branchUrl` or `shareText` to native Share sheet

---

### User Profile Screen
- **Load:** `GET /users/:id/profile`
- **Gallery:** `GET /users/:id/gallery`
- **Send friend request:** `POST /friends/request`

---

### Deep Link Handler (Branch callback)
1. Extract `token` from Branch data
2. `GET /invites/validate/:token` — check validity + get preview info
3. If `valid: false` → show error (reason: EXPIRED / NOT_FOUND / ALREADY_CLAIMED)
4. If not authenticated → navigate to login/signup, preserve `token` in state
5. After login → `POST /invites/claim/:token`
6. If `type === "friend"` → navigate to Friends screen
7. If `type === "trip"` → navigate to `GET /trips/:tripId`

---

### Settings / Profile Edit Screen
- **Update fields:** `PUT /users/profile`
- **Upload avatar:** `PUT /users/photo`
- **Logout:** `POST /auth/logout` → clear stored tokens → navigate to login

---

*This guide covers the complete backend API as of M1 + M2 + M4. Events (M3) will follow the same patterns — shared endpoints will automatically work for `parent_type = 'event'` when the Events module is released.*
