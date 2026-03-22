# GatherGo — Backend API 

Group travel planning API built on Node.js, Express, and PostgreSQL. Covers authentication, trips, expenses, friends, and smart invite links.

---

## Architecture Overview

```
src/
├── modules/
│   ├── auth/          M1 — JWT auth, Google/Facebook OAuth
│   ├── users/         M1+M4 — Profiles, search, gallery
│   ├── home/          M2+M4 — Dashboard with pending friend requests
│   ├── trips/         M2+A — CRUD, expenses, activities, polls, photos, docs, notes
│   │   └── submodules/
│   │       ├── activities/   CRUD + activity photo upload (max 5/activity) — trip-only
│   │       ├── docs/         Thin wrapper → shared/docs
│   │       ├── expenses/     Thin wrapper → shared/expenses
│   │       ├── members/      Role management, email exposed within trip
│   │       ├── notes/        Thin wrapper → shared/notes
│   │       ├── photos/       Thin wrapper → shared/photos
│   │       └── polls/        Thin wrapper → shared/polls
│   ├── shared/        Migration 005 — single service per feature used by trips + events
│   │   ├── docs/         S3 upload, 15 MB limit, presigned download URLs
│   │   ├── expenses/     Splits (equal/amount/%), greedy debt simplification
│   │   ├── notes/        Multi-note per parent (title + category)
│   │   ├── photos/       Trip/event-level photo gallery
│   │   └── polls/        Multi-option polls with per-user vote tracking
│   ├── friends/       M4 — Friend requests, invite links
│   └── invites/       M4 — Token validation & atomic claiming
├── utils/
│   ├── fcm.util.js             Firebase push notifications
│   ├── branch.util.js          Branch.io smart link generation
│   ├── s3.util.js              S3 upload / CDN URL / presigned URLs
│   ├── mailer.js               AWS SES emails
│   ├── debtSimplifier.util.js  Greedy minimum-transaction settlement
│   └── reminders.cron.js       Hourly cron — sends FCM for upcoming trips
├── middleware/
│   ├── authenticate.js             JWT verification
│   ├── parentAccess.middleware.js  Membership gate for trips AND events (sets req.parent + req.tripMember)
│   ├── parentAdmin.middleware.js   Admin-only gate (runs after parentAccess)
│   ├── tripMember.middleware.js    Trip membership gate (legacy — delegates to parentAccess)
│   ├── tripAdmin.middleware.js     Trip admin gate (legacy — delegates to parentAdmin)
│   ├── upload.middleware.js        Multer + magic-bytes MIME validation
│   ├── errorHandler.js             Centralised error responses
│   └── validate.js                 express-validator formatter
└── static/
    ├── apple-app-site-association  iOS Universal Links
    └── assetlinks.json             Android App Links
```

### Shared Table Pattern (Migration 005)

Docs, photos, expenses, polls, and notes are stored in **single shared tables** that serve both trips and events:

```
parent_type  VARCHAR(10)  CHECK ('trip' | 'event')
parent_id    UUID         → trips.id  OR  events.id
```

Shared tables: `docs`, `photos`, `expenses`, `expense_splits`, `settlements`, `polls`, `poll_options`, `poll_votes`, `notes`

**Activities remain trip-only** — they are not shared. Trip activity photos (`trip_activity_photos`) are also separate from the gallery `photos` table.

---

## Flow Plans

---

### Trip Flow

#### 1. Creating a Trip

The admin creates a trip via `POST /trips`. This is a **two-step process** on the frontend:

**Step 1 — Create the trip record**
```
POST /trips
Body:
{
  name, startDate, endDate,
  location: { name, lat, lng },   ← required
  reminders: true,                 ← schedules 3 FCM reminders
  friendIds: ["uuid"],            ← directly added, must be accepted friends
  emails: ["x@y.com"]            ← sent Branch smart link via SES
}
Response: { trip: { id, name, ... } }
```

What happens server-side:
- Trip row is inserted, creator added as `admin` in `trip_members`
- If `reminders: true` → 3 rows inserted in `trip_reminders` (trip_start, 1_day_before, 1_week_before) all at 09:00 IST
- `friendIds` → each friend is added directly to `trip_members` (role: member) + FCM push `TRIP_MEMBER_ADDED`
- `emails` → Branch smart link generated per email, stored in `trip_invites` with `branch_url`, SES email fired (non-blocking)

**Step 2 — Upload docs immediately after (optional)**
```
POST /trips/:id/docs   (multipart, field: "file")
```

---

#### 2. Inviting Members to a Trip

`POST /trips/:id/invite` — handles two distinct paths in a single call:

```
Body:
{
  "friendIds": ["uuid1", "uuid2"],       ← Path A: direct add
  "emails": ["new@email.com"],           ← Path B: Branch invite
  "phones": ["+919876543210"]            ← Path B: Branch invite
}
```

**Path A — Invite a friend (already connected on GatherGo)**

1. Backend verifies each `friendId` is in `friend_connections` with `status = 'accepted'`
   - If NOT a friend → returns `400 { error: "NOT_A_FRIEND", userId: "uuid" }` immediately (does not silently skip)
2. Checks if already a trip member → skips silently (added to `skipped[]`)
3. Inserts into `trip_members` (role: member)
4. Fires FCM push to each added user: `TRIP_MEMBER_ADDED` → navigates to trip screen
5. Added user appears in `added[]` in the response

**Path B — Invite by email or phone**

1. Backend checks if a GatherGo user exists with that email/phone
   - **Exists + is a friend** → treated as Path A (direct add, no link needed)
   - **Exists + NOT a friend** → generate Branch link, store invite token, send SES email if email provided
   - **Does not exist** → generate Branch link, store invite token, send SES email if email provided
2. Branch smart link is generated via `createInviteSmartLink({ token, type: 'trip' })`
   - Falls back to plain deep link if Branch is unreachable
3. Token stored in `trip_invites` with `branch_url`, `expires_at` (7 days)
4. SES email fired non-blocking
5. Invite appears in `invited[]` in the response

**Response shape:**
```json
{
  "added":   [{ "userId": "uuid", "name": "Priya", "method": "direct" }],
  "invited": [{ "email": "x@y.com", "branchUrl": "https://...", "expiresAt": "ISO" }],
  "skipped": [{ "userId": "uuid", "reason": "already_member" }]
}
```

---

#### 3. Recipient Accepts the Invite (Deep Link Flow)

When the recipient taps the Branch link:

- **App already installed** → Branch SDK fires, app reads `invite_token` from deep link data → calls `POST /invites/claim/:token`
- **App not installed** → Branch redirects to APK (dev) or Play Store/App Store (prod). After install, Branch SDK re-fires the deferred deep link → app calls `POST /invites/claim/:token`

Server-side on claim:
1. Token locked with `SELECT FOR UPDATE` (race-condition safe)
2. User added to `trip_members` (role: member) — idempotent
3. `trip_invites.accepted_at` set
4. FCM push to trip admin: `TRIP_INVITE_ACCEPTED` with `tripId` and `newMemberId`
5. Returns `{ type: "trip", tripId, tripName }`

---

#### 4. Trip Lifecycle — Activities

Activities are per-trip itinerary items with optional photos and expense links.

```
POST /trips/:id/activities
Body:
{
  title, date,
  time: { hour: 17, minute: 30 },  ← stored as TIME column, returned as object
  locationName,                     ← free text, no coordinates needed
  description,                      ← optional, max 500 chars
  expenseId                         ← optional, links an existing expense (shared table)
}
```

Photos for an activity are uploaded separately (max 5 per activity):
```
POST /trips/:id/activities/:actId/photos   (multipart, field: "photos", max 5 files)
GET  /trips/:id/activities/:actId/photos
DELETE /trips/:id/activities/:actId/photos/:photoId
```

---

#### 5. Trip Reminders (Automated)

An hourly cron (`reminders.cron.js`) queries `trip_reminders` for rows where `scheduled_at <= NOW AND sent_at IS NULL`. For each due reminder, it:
1. Fetches all trip members' FCM tokens
2. Fires push notification with type `trip_start`, `1_day_before`, or `1_week_before`
3. Sets `sent_at = NOW()` to prevent re-sending

---

### Friends Flow

#### 1. Two Ways to Connect

**Path A — Direct request (target is already on GatherGo)**

```
1. Search for the user:       GET /users/search?q=name
2. Send request:              POST /friends/request { toUserId }
   → FCM push to recipient: FRIEND_REQUEST
3. Recipient sees request:    GET /friends/requests → incoming[]
4. Recipient responds:        PUT /friends/request/:connectionId { action: "accept" | "decline" }
   → FCM push to requester on accept: FRIEND_ACCEPTED (no push on decline — privacy)
5. Both users now appear in each other's GET /friends list
```

**Path B — Invite link (target not on GatherGo, or user wants to share a link)**

```
1. Generate smart link:       POST /friends/invite { channels: ["share"], emails: [] }
   → Returns { token, branchUrl, shareText, expiresAt }
2. Share branchUrl via WhatsApp / SMS / email (React Native Share.share())
3. Recipient taps link:
   → App installed  → Branch SDK fires → app calls POST /invites/claim/:token
   → App not installed → Branch redirects to store → deferred deep link fires after install
4. On claim:
   → friend_connections row created (status: pending)
   → FCM push to inviter: FRIEND_REQUEST
5. Inviter accepts:           PUT /friends/request/:connectionId { action: "accept" }
```

---

#### 2. Friendship States

```
none → pending → accepted
              → declined
     → blocked
```

- `pending`: one side sent a request, other hasn't responded
- `accepted`: both sides are friends — they appear in `GET /friends` and can be added to trips via `friendIds`
- `declined`: silently rejected, no push notification
- `blocked`: excluded from search results, profile returns 403

---

#### 3. Friendship Enforced in Trip Invites

When calling `POST /trips/:id/invite` with `friendIds`:
- Backend verifies `friend_connections.status = 'accepted'` bidirectionally
- Non-friends in `friendIds` → 400 `NOT_A_FRIEND` error (hard fail, not silent skip)
- This ensures the trip member list is always made up of people you know

---

#### 4. Rate Limits

| Action | Limit |
|---|---|
| `POST /friends/request` | 20 requests / user / day |
| `POST /friends/invite` | 10 invite links / user / hour |
| `POST /trips/:id/invite` | 20 invites / user / 15 min |

---

## Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL (local or AWS RDS)
- AWS account (S3, SES, CloudFront)
- Firebase project (FCM)
- Branch.io account (free tier is sufficient)

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` — fill in your database, AWS, FCM, and Branch.io credentials.

### 3. Run database migrations
```bash
npm run migrate
```
Runs all pending migrations in order:
- `001` — users, auth, OTPs, profiles
- `002` — trips, members, invites, activities, expenses, polls, notes (original trip-scoped tables)
- `003` — friends, friend invites, FCM token column
- `004` — activity descriptions & photos, expense categories, notes redesign (multi-note schema), trip invite phone/branch columns
- `005` — **consolidate shared tables**: creates `docs`, `photos`, `expenses`, `expense_splits`, `settlements`, `polls`, `poll_options`, `poll_votes`, `notes`; migrates existing data; renames old `trip_*` tables to `_bak_*`

The runner tracks applied migrations in `_migrations` table — safe to re-run, skips already-applied files.

### 4. Seed test data
```bash
node seed.js
```
Creates 5 users, 3 trips (upcoming/ongoing/past), friend connections, expenses, activities, polls, notes, and invite tokens. All users share password `TestPass123!`.

### 5. Start the server
```bash
npm run dev   # Development (hot-reload via nodemon)
npm start     # Production
```

Server starts on `PORT` from `.env` (default `3000`).

---

## Testing — Full Test Run

### Unit + Integration tests (Jest + Supertest)
```bash
# Run all tests
npm test

# With coverage report
npm run test:coverage

# Run a specific test file
npx jest __tests__/auth/auth.test.js --forceExit

# Run tests matching a pattern
npx jest --testNamePattern="POST /auth/login" --forceExit
```

### Manual API testing (Postman)

1. Import `GatherGo_Official.postman_collection.json` into Postman
2. The collection variable `base_url` defaults to `http://localhost:3000` — update if needed
3. **Start here:** run **"2. Login → Login as Alice"** — the test script auto-saves `access_token`, `refresh_token`, and `user_id`
4. All authenticated requests use `{{access_token}}` automatically
5. Run the seed script first — all seeded UUIDs are pre-filled in the collection

**Recommended test order:**
```
1. Login as Alice (saves token)
2. GET /home                     — dashboard
3. GET /trips?status=upcoming    — list trips
4. GET /trips/:id                — trip detail + stats
5. POST /trips/:id/expenses      — add expense
6. GET /trips/:id/balances       — check balances after expense
7. GET /trips/:id/notes          — list notes
8. POST /trips/:id/notes         — create note
9. GET /trips/:id/polls          — list polls (seeded)
10. POST /trips/:id/polls/:id/vote — cast a vote
11. GET /friends                 — friend list
12. GET /friends/requests        — pending requests (Eve's request visible)
13. POST /friends/invite         — generate invite link
```

### Smoke-test all endpoints with curl

```bash
BASE="http://localhost:3000"

# Health check
curl -s $BASE/health | jq .

# Login (saves token to shell variable)
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gathergo.com","password":"TestPass123!","deviceToken":"test","platform":"android"}' \
  | jq -r '.accessToken')
echo "Token: $TOKEN"

# Dashboard
curl -s -H "Authorization: Bearer $TOKEN" $BASE/home | jq .

# Trips
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/trips?status=upcoming" | jq .trips[0].name

# Trip detail (Goa trip)
curl -s -H "Authorization: Bearer $TOKEN" \
  $BASE/trips/b0000000-0000-4000-8000-000000000001 | jq .stats

# Expenses
curl -s -H "Authorization: Bearer $TOKEN" \
  $BASE/trips/b0000000-0000-4000-8000-000000000001/expenses | jq '{total:.total, grandTotal:.grandTotal}'

# Balances
curl -s -H "Authorization: Bearer $TOKEN" \
  $BASE/trips/b0000000-0000-4000-8000-000000000001/balances | jq .summary

# Notes
curl -s -H "Authorization: Bearer $TOKEN" \
  $BASE/trips/b0000000-0000-4000-8000-000000000001/notes | jq .total

# Polls
curl -s -H "Authorization: Bearer $TOKEN" \
  $BASE/trips/b0000000-0000-4000-8000-000000000001/polls | jq '.[0].options | map({text,voteCount})'

# Friends
curl -s -H "Authorization: Bearer $TOKEN" $BASE/friends | jq '[.friends[].name]'

# Friend requests (Eve's pending request)
curl -s -H "Authorization: Bearer $TOKEN" $BASE/friends/requests | jq .incoming[0].name

# Universal links (public)
curl -s $BASE/.well-known/assetlinks.json | jq .[0].relation
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | Yes | Access token signing key |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key |
| `AWS_RDS_HOST` | Yes | PostgreSQL host |
| `AWS_RDS_DB` | Yes | Database name |
| `AWS_RDS_USER` | Yes | Database user |
| `AWS_RDS_PASSWORD` | Yes | Database password |
| `AWS_S3_BUCKET` | Yes | S3 bucket for uploads |
| `AWS_CLOUDFRONT_DOMAIN` | Yes | CloudFront domain for CDN URLs |
| `AWS_SES_FROM_EMAIL` | Yes | Verified SES sender address |
| `FCM_SERVER_KEY` | Yes | Firebase legacy server key |
| `BRANCH_KEY` | Yes | Branch.io live key (`key_live_xxxx`) |
| `APP_IS_LIVE` | Yes | `false` = APK/TestFlight links, `true` = store links |
| `ANDROID_APK_URL` | Dev | Direct APK URL (dev) |
| `IOS_TESTFLIGHT_URL` | Dev | TestFlight URL (dev) |
| `ANDROID_STORE_URL` | Prod | Play Store URL (production) |
| `IOS_STORE_URL` | Prod | App Store URL (production) |
| `APP_INVITE_BASE_URL` | Yes | `https://gathergo.app/invite` |
| `APP_DEEPLINK_BASE_URL` | Yes | `https://gathergo.app` |
| `APP_TEAM_ID` | Yes | Apple Team ID (10-char) |
| `ANDROID_SHA256_CERT` | Yes | Android signing cert fingerprint |

---

## API Reference

### Auth (`/auth`)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | No | Register with email + password. Sends OTP. |
| POST | `/auth/verify-email` | No | Submit OTP → returns JWT tokens |
| POST | `/auth/login` | No | Email/password login |
| POST | `/auth/google` | No | Google OAuth |
| POST | `/auth/facebook` | No | Facebook OAuth |
| POST | `/auth/refresh` | No | Rotate tokens |
| POST | `/auth/logout` | Yes | Invalidate refresh token |
| POST | `/auth/forgot-password` | No | Send reset OTP |
| POST | `/auth/reset-password` | No | Reset with OTP |
| GET | `/auth/me` | Yes | Get current user |

### Users (`/users`)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/users/profile` | Yes | Create profile after signup |
| PUT | `/users/profile` | Yes | Update profile + username |
| PUT | `/users/photo` | Yes | Upload avatar to S3 |
| GET | `/users/search?q=` | Yes | Search users with friendship status |
| GET | `/users/:id/profile` | Yes | Enhanced profile + stats. 403 if blocked. |
| GET | `/users/:id/gallery` | Yes | Past trips only (privacy guarded) |

### Home (`/home`)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/home` | Yes | Dashboard: trips, ongoing trip, pendingFriendRequests count |

### Trips — Core (`/trips`)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/trips` | Yes | Create trip. `location` required. `friendIds` + `emails` for invites. |
| GET | `/trips` | Yes | List trips. `?status=upcoming\|ongoing\|past` |
| GET | `/trips/:id` | Yes | Trip detail with aggregated stats (single SQL query) |
| PUT | `/trips/:id` | Admin | Update trip metadata |
| DELETE | `/trips/:id` | Admin | Delete trip + S3 cleanup |

### Trips — Invites
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/trips/:id/invite` | Member | Invite via `friendIds` (direct) or `emails`/`phones` (Branch link). Rate: 20/15 min. |
| GET | `/trips/invite/:token` | No | Validate token (landing page use) |
| POST | `/trips/invite/:token/accept` | Yes | Legacy accept (non-Branch flow) |

### Trips — Members
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/trips/:id/members` | Member | Returns `{ members, total, adminCount }`. Includes `email`. |
| DELETE | `/trips/:id/members/:userId` | Admin | Remove member (cannot remove last admin) |

### Trips — Activities (trip-only, not shared)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/trips/:id/activities` | Member | Returns `{ upcoming[], completed[] }` with photoCount + linkedExpense |
| POST | `/trips/:id/activities` | Member | Create. Body: `{ title, date, time: {hour,minute}, locationName, description, expenseId }` |
| PUT | `/trips/:id/activities/:actId` | Member | Partial update. Creator or admin only. |
| DELETE | `/trips/:id/activities/:actId` | Member | Creator or admin only. |
| POST | `/trips/:id/activities/:actId/photos` | Member | Upload up to 5 photos total per activity (multipart, field: `photos`) |
| GET | `/trips/:id/activities/:actId/photos` | Member | Get all photos for an activity |
| DELETE | `/trips/:id/activities/:actId/photos/:photoId` | Member | Uploader or admin only |

### Trips — Docs (backed by shared `docs` table)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/trips/:id/docs` | Member | Upload doc. **15 MB max**. JPEG/PNG/PDF only. Buffer MIME validated. (multipart, field: `file`) |
| GET | `/trips/:id/docs` | Member | Returns `{ docs[], total }`. Includes `uploadedBy`, presigned URL (1hr). |
| DELETE | `/trips/:id/docs/:docId` | Member | Uploader or admin only. Deletes from S3 + DB. |

### Trips — Photos (backed by shared `photos` table)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/trips/:id/photos` | Member | Upload trip photos (multipart, field: `photos`, max 5 files, 50 MB each) |
| GET | `/trips/:id/photos` | Member | List trip photos |
| DELETE | `/trips/:id/photos/:photoId` | Member | Uploader or admin only |

### Trips — Expenses (backed by shared `expenses` table)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/trips/:id/expenses` | Member | Add expense. `splitType`: equal / amount / percentage. `category` defaults to `general`. |
| GET | `/trips/:id/expenses` | Member | Returns `{ expenses[], total, grandTotal }`. `paidBy` + splits include name + avatarUrl. |
| PUT | `/trips/:id/expenses/:eid` | Member | Update. Creator or admin only. |
| DELETE | `/trips/:id/expenses/:eid` | Member | Creator or admin only. |
| GET | `/trips/:id/balances` | Member | Returns `{ summary: { yoursTotal, youPaid, yourShare, netBalance }, outstanding[] }` |
| POST | `/trips/:id/settlements` | Member | Record a manual payment between two members |

### Trips — Polls (backed by shared `polls` table)
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/trips/:id/polls` | Member | Create poll. `options`: min 2, max 10. |
| GET | `/trips/:id/polls` | Member | All polls with vote counts, percentages, and `isMyVote` flag per option |
| POST | `/trips/:id/polls/:pollId/vote` | Member | Cast or change vote. One vote per user per poll. |

### Trips — Notes (backed by shared `notes` table)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/trips/:id/notes` | Member | Returns `{ notes[], total }`. Ordered by `updated_at DESC`. |
| POST | `/trips/:id/notes` | Member | Create note. Body: `{ title, content, category }`. Category: general / idea / important / todo. |
| PUT | `/trips/:id/notes/:noteId` | Member | Partial update. Any member can edit. Sets `last_edited_by`. |
| DELETE | `/trips/:id/notes/:noteId` | Member | Creator or admin only. |

### Friends (`/friends`)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/friends` | Yes | Friends list with mutual trip count. Optional `?search=` |
| GET | `/friends/requests` | Yes | `{ incoming[], outgoing[] }` — all pending requests |
| POST | `/friends/request` | Yes | Send friend request. Rate: 20/day. FCM push to recipient. |
| PUT | `/friends/request/:connectionId` | Yes | Accept or decline. Only the addressee can call this. |
| POST | `/friends/invite` | Yes | Generate Branch smart link. Rate: 10/hour. |
| DELETE | `/friends/:userId` | Yes | Remove accepted friendship |

### Invites (`/invites`)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/invites/validate/:token` | No | Validate token (landing page). Returns `{ valid, type, invitedBy, installLinks }` |
| POST | `/invites/claim/:token` | Yes | Claim token after Branch SDK fires. Atomic. Idempotent. Returns `{ type: "trip"\|"friend", tripId?, tripName? }` |

### Universal Links (`/.well-known`)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/.well-known/apple-app-site-association` | No | iOS Universal Links config |
| GET | `/.well-known/assetlinks.json` | No | Android App Links config |

---

## Expense Categories

```
general | transportation | accommodation | entertainment | shopping | food | other
```
Default: `general` (never reject a request missing category — just default it).

## Note Categories

```
general | idea | important | todo
```

---

## Error Response Format

All errors follow a consistent shape:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "statusCode": 400
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `NOT_A_FRIEND` | 400 | friendId provided for trip invite is not an accepted friend |
| `SELF_REQUEST` | 400 | Cannot send friend request to yourself |
| `ALREADY_FRIENDS` | 409 | Friendship already accepted |
| `REQUEST_ALREADY_EXISTS` | 409 | Pending request already exists |
| `BLOCKED` | 403 | User is blocked |
| `USERNAME_TAKEN` | 409 | Username already registered |
| `INVALID_INVITE` | 404 | Token expired, not found, or already claimed |
| `MAX_PHOTOS_EXCEEDED` | 400 | Activity already has 5 photos |
| `INVALID_FILE_TYPE` | 400 | File MIME type not allowed (validated from buffer) |
| `FILE_TOO_LARGE` | 400 | File exceeds size limit |
| `LAST_ADMIN` | 422 | Cannot remove the last admin from a trip |
| `NOT_FOUND` | 404 | Resource does not exist |
| `FORBIDDEN` | 403 | Authenticated but not authorised for this action |
| `RATE_LIMIT` | 429 | Too many requests |
| `VALIDATION_ERROR` | 400 / 422 | Input failed validation |

---

## Seeded Test Data

After running `node seed.js`, the following data is available for immediate testing.

### Users (all password: `TestPass123!`)
| User | Email | UUID |
|---|---|---|
| Alice (primary) | test@gathergo.com | `a0000000-0000-4000-8000-000000000001` |
| Bob | bob@gathergo.com | `a0000000-0000-4000-8000-000000000002` |
| Charlie | charlie@gathergo.com | `a0000000-0000-4000-8000-000000000003` |
| Diana | diana@gathergo.com | `a0000000-0000-4000-8000-000000000004` |
| Eve | eve@gathergo.com | `a0000000-0000-4000-8000-000000000005` |

### Trips
| Status | Name | UUID |
|---|---|---|
| Upcoming | Goa Trip 2027 (2027-04-10..15) | `b0000000-0000-4000-8000-000000000001` |
| Ongoing | Manali Winter 2026 (2026-01-01..12-31) | `b0000000-0000-4000-8000-000000000002` |
| Past | Kerala Backwaters (2024-03-15..20) | `b0000000-0000-4000-8000-000000000003` |

### Friendship states (as Alice)
| User | Status |
|---|---|
| Bob | accepted — can be added to trips via `friendIds` |
| Charlie | accepted — can be added to trips via `friendIds` |
| Diana | pending (Alice sent) |
| Eve | pending (Eve sent) — Alice can accept/decline |

### Seeded expenses (Goa trip)
| UUID | Description | Amount | Split | Paid by |
|---|---|---|---|---|
| `c0000000-0000-4000-8000-000000000001` | Hotel Booking | ₹9,000 | equal 3-way | Alice |
| `c0000000-0000-4000-8000-000000000002` | Scuba Diving Package | ₹4,000 | percentage (bob 50%, alice 30%, charlie 20%) | Bob |
| `c0000000-0000-4000-8000-000000000003` | Group Dinner | ₹3,600 | amount (alice ₹1500, bob ₹1200, charlie ₹900) | Charlie |

### Seeded invite tokens
| Token | Type |
|---|---|
| `friend-invite-seed-token-001` | Friend invite (created by Alice) |
| `trip-invite-seed-token-001` | Trip invite (Goa trip, created by Alice) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express.js |
| Database | PostgreSQL (AWS RDS) |
| Storage | AWS S3 + CloudFront CDN |
| Email | AWS SES |
| Push | Firebase Cloud Messaging (FCM) |
| Smart Links | Branch.io |
| Auth | JWT + Google/Facebook OAuth |
| Cron | node-cron (hourly reminders) |
| Logging | Winston + Morgan |
