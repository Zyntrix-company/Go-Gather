# GatherGo

> Group travel planning — one shared space to organise trips and events, split expenses, store memories, connect with friends, and get AI-powered travel help.

**Version:** v1 &nbsp;|&nbsp; **Prepared by:** Zyntrix &nbsp;|&nbsp; **Client:** GatherrGo

---

## Repository Structure

```
Go Gather/
├── app/          # React Native mobile app (iOS & Android)
├── backend/      # Node.js + Express REST API
├── frontend/     # Marketing / landing website (Vite + React + TypeScript)
├── admin/        # Next.js admin panel (scaffolded; features planned for M7)
├── docs/         # Internal docs (e.g. notification context, push catalog)
└── .github/
    └── workflows/
        ├── backend-deploy.yml   # Docker → ECR → EC2 (path: backend/**)
        └── frontend-deploy.yml  # Vite build → S3 → CloudFront (path: frontend/**)
```

### `app/` — Mobile App (React Native)
The primary user-facing product. A single codebase targets iOS 14+ and Android 8+.

- **Navigation:** bottom tab navigation — Home | Trips | Events | Friends | Gallery
- **Auth:** Splash, Login (email + Google + Facebook OAuth), Signup, Create Profile
- **Core modules:** Home dashboard, Trip detail, Event detail, Notifications, Swee AI chat
- **State management:** Zustand store
- **Styling:** NativeWind (Tailwind for RN)

### `backend/` — REST API (Node.js + Express)
Modular Express API. Each feature is an isolated module under `src/modules/`.

| Module | Responsibility |
|--------|---------------|
| `auth` | Signup, login, Google / Facebook OAuth, JWT access + refresh tokens, password reset, FCM device token on login |
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
**AI:** Swee AI agent — **Google Gemini 2.5 Flash** only (no OpenAI); `@google/generative-ai` on the backend

### `frontend/` — Marketing Website (Vite + React + TypeScript)
Public-facing website for GatherGo. Includes sitemap.xml for SEO. Deployed separately from the backend.

### `admin/` — Admin Web Panel (Next.js)
Next.js app scaffold lives in `admin/` (`npm run dev` / `npm run build`). **Operational features** (users, trips/events, analytics, etc.) are planned for Milestone 7 — same scope as before: business insights, user management, trip/event oversight, health monitoring, storage analytics, and feedback management.

---

## CI/CD & GitHub Actions

Deployments are automated with **GitHub Actions** on pushes to **`main`** (no separate `ci.yml` today). **Lint and tests** are run locally or in your own pipeline — use `npm run lint` and `npm test` in `backend/` before merging.

### Backend — `.github/workflows/backend-deploy.yml`

**Trigger:** push to `main` when files under `backend/**` change.

| Step | What happens |
|------|----------------|
| Checkout | Repository code |
| AWS auth | `configure-aws-credentials` (secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, region `ap-south-1`) |
| ECR | Build Docker image from `backend/`, tag with commit SHA, push to Amazon ECR |
| EC2 | SSH (`appleboy/ssh-action`) using `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`; pull image, replace `gathergo-container`, run with `--env-file` on port **3000** |
| Extras | Injects `FIREBASE_SERVICE_ACCOUNT_B64` into server `.env` for FCM; optional nginx `client_max_body_size` for large uploads |

**Secrets (typical):** `AWS_*`, `EC2_*`, `FIREBASE_SERVICE_ACCOUNT_B64`, ECR registry is pinned in the workflow file.

### Frontend — `.github/workflows/frontend-deploy.yml`

**Trigger:** push to `main` when files under `frontend/**` change.

| Step | What happens |
|------|----------------|
| Node 20 | Install deps, `npm run build` (Vite) with `VITE_API_URL`, `VITE_CONTACT_RECEIVER_EMAIL` |
| S3 | Upload `dist/` to bucket **`gatherrgo-frontend`** with cache rules (immutable hashed assets, `no-cache` for `index.html`) |
| CDN | CloudFront invalidation via `CLOUDFRONT_FRONTEND_DISTRIBUTION_ID` |

### Mobile app (`app/`)

There is **no** GitHub Actions workflow for the React Native app in this repo; releases use local builds / EAS or store pipelines (configure as needed).

### Possible follow-ups

- Add a **`ci.yml`** (or job in existing workflows) for **ESLint + Jest** on every PR, with a PostgreSQL service container if you want CI parity with local tests.
- **Admin** deploy workflow when the panel is production-ready.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (iOS 14+, Android 8+) |
| Admin Panel | Next.js (SSR) |
| Backend | Node.js + Express.js |
| Database | AWS RDS — PostgreSQL |
| File Storage | AWS S3 + CloudFront CDN |
| Authentication | Email/password, Google & Facebook OAuth + JWT (15 min access / 30 day refresh) |
| Email | AWS SES |
| AI Assistant (Swee) | **Google Gemini 2.5 Flash** — agent-style travel help; streaming from the API |
| Push Alerts | Firebase Cloud Messaging |
| Maps / Places | Google Places API |
| CI/CD | GitHub Actions — backend Docker → **ECR + EC2**; frontend **S3 + CloudFront** |
| Hosting | API on **EC2** (Docker); marketing site on **S3** behind **CloudFront**; HTTPS via ACM (typical setup) |

---

## Milestone Progress

| # | Milestone | Status | What's working |
|---|-----------|--------|----------------|
| M1 | Auth & Profiles | ✅ Complete | Splash, Login (email + Google + Facebook), Signup, Create Profile, JWT sessions, password reset |
| M2 | Home Screen & Trips | ✅ Complete | Home dashboard, Trip creation, Trip detail with all tabs — Activities, Docs, Members, Photos, Expenses, Polls, Notes, expense splits & debt simplification |
| M3 | Events | ✅ Working | Event creation, Event detail — Docs, Members, Photos, Expenses, Polls, Notes |
| M4 | Friends & Invite System | ✅ Working | Friend requests, accept/decline, connected friends list, deep-link invites, user profile gallery |
| M5 | Gallery & AI Chatbot | 🟡 In progress | Per-trip/event gallery, personal gallery, Swee AI agent powered by **Google Gemini 2.5 Flash** only (not OpenAI) |
| M6 | Revisions & Deployment | 🟡 In progress | Backend + marketing site deploy via GitHub Actions; QA & polish; mobile store submission |
| M7 | Admin Web Panel | 🟡 Scaffolded | Next.js app present; dashboard features — Business Insights, Users, Trips/Events, Error/Health, Storage, Feedback |

Each major package also has its own README with deeper detail: **`app/README.md`**, **`backend/README.md`**, **`frontend/README.md`**.

---

## Local Development

### Backend

```bash
cd backend
cp .env.example .env      # fill in AWS, DB, JWT, Google credentials
npm install
npm run migrate           # run all SQL migrations
npm run seed              # optional: seed test data
npm run lint              # ESLint (run before PRs; not in GitHub Actions today)
npm test                  # Jest (requires DB; see test setup / docker-compose)
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

```bash
cd admin
npm install
npm run dev        # local dev
npm run build      # production build
```

Scaffold only until M7 features land — see `admin/README.md`.

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
- API reference, deployment guide, environment setup documentation (see `docs/` and `.github/workflows/` for deploy behaviour)
- 30-day post-launch free support for bug fixes and production issues
