# GatherGo

> Group travel planning — one shared space to organise trips and events, split expenses, store memories, connect with friends, and get AI-powered travel help.

**Version:** v1 &nbsp;|&nbsp; **Prepared by:** Zyntrix &nbsp;|&nbsp; **Client:** GatherrGoAdd 

---

## Repository Structure

```
Go Gather/
├── app/          # React Native mobile app (iOS & Android)
├── backend/      # Node.js + Express REST API
├── frontend/     # Marketing / landing website (Vite + React)
├── admin/        # Next.js admin panel  ← NOT STARTED YET
└── .github/
    └── workflows/
        └── ci.yml   # CI/CD pipeline (backend)
```

### `app/` — Mobile App (React Native)
The primary user-facing product. A single codebase targets iOS 14+ and Android 8+.

- **Navigation:** bottom tab navigation — Home | Trips | Events | Friends | Gallery
- **Auth:** Splash, Login (email + Google OAuth), Signup, Create Profile
- **Core modules:** Home dashboard, Trip detail, Event detail, Notifications, Swee AI chat
- **State management:** Zustand store
- **Styling:** NativeWind (Tailwind for RN)

### `backend/` — REST API (Node.js + Express)
Modular Express API. Each feature is an isolated module under `src/modules/`.

| Module | Responsibility |
|--------|---------------|
| `auth` | Signup, login, Google OAuth, JWT access + refresh tokens, password reset |
| `users` | Profiles, photo upload, user search, gallery |
| `trips` | Trip CRUD, activities, expenses, polls, notes, docs, gallery, members |
| `friends` | Friend requests, connections, friend invites |
| `invites` | Deep-link token management for trip/event invitations |
| `home` | Aggregated home dashboard data |
| `shared` | Shared tables for docs, photos, expenses, polls, notes (used by both trips & events) |
| `contact` | User feedback and Swee AI issue reports |

**Database:** AWS RDS (PostgreSQL) — migrations in `backend/migrations/`
**File storage:** AWS S3 + CloudFront CDN
**Email:** AWS SES
**Push notifications:** Firebase Cloud Messaging
**AI:** OpenAI GPT-4o (Swee assistant)

### `frontend/` — Marketing Website (Vite + React + TypeScript)
Public-facing website for GatherGo. Includes sitemap.xml for SEO. Deployed separately from the backend.

### `admin/` — Admin Web Panel (Next.js) — NOT STARTED
Planned for Milestone 7. Will provide Zyntrix and the client's team with full operational control — business insights, user management, trip/event oversight, health monitoring, storage analytics, and feedback management.

---

## CI/CD Pipeline

The backend has a GitHub Actions pipeline at `.github/workflows/ci.yml` that triggers on every push and pull request to `main`.

```
Push / PR to main
       │
       ├── Lint (ESLint)
       │
       ├── Test (Jest + real PostgreSQL 15 service)
       │   ├── Run migrations
       │   └── Run test suite
       │
       └── Build Check
           └── Verify app module loads correctly
```

- **Lint** and **Build Check** run in parallel.
- **Test** job runs after Lint passes and spins up a real PostgreSQL 15 container — no mocks.
- All environment variables (JWT secrets, AWS credentials, DB config) are injected via GitHub Actions secrets.

> Auto-deploy to AWS (EC2 / Elastic Beanstalk) will be added as part of the deployment milestone.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (iOS 14+, Android 8+) |
| Admin Panel | Next.js (SSR) |
| Backend | Node.js + Express.js |
| Database | AWS RDS — PostgreSQL |
| File Storage | AWS S3 + CloudFront CDN |
| Authentication | Google OAuth 2.0 + JWT (15 min access / 30 day refresh) |
| Email | AWS SES |
| AI Assistant | OpenAI GPT-4o (streaming via SSE) |
| Push Alerts | Firebase Cloud Messaging |
| Maps / Places | Google Places API |
| CI/CD | GitHub Actions |
| Hosting | AWS EC2 / Elastic Beanstalk + HTTPS via AWS ACM |

---

## Milestone Progress

| # | Milestone | Status | What's working |
|---|-----------|--------|----------------|
| M1 | Auth & Profiles | ✅ Complete | Splash screen, Login (email + Google OAuth), Signup, Create Profile, JWT sessions, password reset |
| M2 | Home Screen & Trips | ✅ Complete | Home dashboard, Trip creation, Trip detail with all tabs — Activities, Docs, Members, Photos, Expenses, Polls, Notes, expense splits & debt simplification |
| M3 | Events | ✅ Working | Event creation, Event detail — Docs, Members, Photos, Expenses, Polls, Notes |
| M4 | Friends & Invite System | ✅ Working | Friend requests, accept/decline, connected friends list, deep-link invites, user profile gallery |
| M5 | Gallery & AI Chatbot | 🔲 Not Started | Per-trip/event gallery, personal gallery, Swee AI assistant (OpenAI GPT-4o) |
| M6 | Revisions & Deployment | 🔲 Not Started | QA & polish, AWS backend deployment, app store submission |
| M7 | Admin Web Panel | 🔲 Not Started | Next.js dashboard — Business Insights, Users, Trips/Events, Error/Health, Storage, Feedback |

---

## Local Development

### Backend

```bash
cd backend
cp .env.example .env      # fill in AWS, DB, JWT, Google credentials
npm install
npm run migrate           # run all SQL migrations
npm run seed              # optional: seed test data
npm run dev               # starts with nodemon
```

Requires a running PostgreSQL instance. See `docker-compose.yml` for a local Docker setup:

```bash
cd backend
docker-compose up         # spins up Postgres + the API server
```

### Mobile App

```bash
cd app
npm install

# iOS
npx pod-install ios
npx react-native run-ios

# Android
npx react-native run-android
```

### Frontend (Marketing Website)

```bash
cd frontend
npm install
npm run dev
```

### Admin Panel

> Not yet started — will be a Next.js application in the `admin/` directory.

---

## Out of Scope (v1)

- Community / Social Feed
- Group Chat between members (Swee AI is the only chat in v1)
- Multi-currency support (v1 defaults to INR)
- In-app payments or wallet integration

---

## Handover (on full completion)

- Full source code transferred to client GitHub repository
- AWS RDS production instance with automated backups and multi-AZ
- AWS S3 media bucket with CORS, pre-signed URLs, CloudFront CDN
- Android APK submitted to Google Play
- iOS IPA submitted to Apple App Store via TestFlight
- API reference, deployment guide, and environment setup documentation
- 30-day post-launch free support for bug fixes and production issues
