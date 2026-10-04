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
├── admin/        # Next.js admin panel (static export; RBAC dashboard)
├── docs/         # Internal docs (notifications, Swee, upload limits, plans, trackers)
└── .github/
    └── workflows/
        ├── backend-deploy.yml   # Docker → ECR → EC2 (path: backend/**)
        ├── frontend-deploy.yml  # Vite build → S3 → CloudFront (path: frontend/**)
        └── admin-deploy.yml     # Next.js static export → S3 → CloudFront (path: admin/**)
```

### `app/` — Mobile App (React Native)
The primary user-facing product. A single codebase targets iOS 14+ and Android 8+.

- **Navigation:** Home screen with bottom tabs — Home | Trips | Events | Friends | Swee | Gallery; hamburger opens a full-screen Menu (Profile, Settings, Support, Legal)
- **Auth:** Welcome, Login / Signup (email + Google + Sign in with Apple), OTP verification, Create Profile; account deletion in Settings
- **Core modules:** Home dashboard, Trip detail, Event detail, Notifications, personal documents, connected email/Drive import, Swee AI chat
- **State management:** Zustand store
- **Styling:** NativeWind (Tailwind for RN)

### `backend/` — REST API (Node.js + Express)
Modular Express API. Each feature is an isolated module under `src/modules/`.

| Module | Responsibility |
|--------|---------------|
| `auth` | Signup, login, Google + Apple sign-in, JWT access + refresh tokens, OTP verification, password reset |
| `users` | Profiles, photo upload, search, personal gallery/albums & docs, notification settings, account deletion |
| `trips` / `events` | CRUD, members, archive; trips also have activities |
| `shared` | Shared tables for docs, photos, expenses, polls, notes (used by both trips & events) |
| `friends` / `invites` / `requests` | Friend graph, universal-link invite tokens, pending invite requests |
| `home` | Aggregated home dashboard data |
| `ai` | Swee chat, conversations, confirmed actions, usage tracking |
| `notifications` | In-app feed + FCM push, batching, digests, reminders (cron) |
| `emailDocs` / `driveDocs` | Gmail / Outlook / Google Drive doc import |
| `places` / `config` / `legal` | Places autocomplete proxy, upload limits, Privacy/Terms |
| `blogs` / `deals` / `promo-video` | Content for the marketing site, managed from admin |
| `contact` / `feedback` | Website contact form and in-app feedback |
| `admin` | Admin platform API (RBAC, dashboards, storage, maintenance mode, content, legal publishing) |

**Database:** AWS RDS (PostgreSQL) — migrations in `backend/migrations/`
**File storage:** AWS S3 + CloudFront CDN
**Email:** AWS SES (Brevo for transactional email where configured)
**Push notifications:** Firebase Cloud Messaging
**AI:** Swee AI agent — **Google Gemini 2.5 Flash** only (no OpenAI); `@google/generative-ai` on the backend

### `frontend/` — Marketing Website (Vite + React + TypeScript)
Public-facing website for GatherGo: landing, about, careers, blog, contact, privacy/terms, data-deletion, and the **invite landing page** (`/invite/:type/:token`). Serves the iOS/Android association files under `public/.well-known/`. Deployed separately from the backend.

### `admin/` — Admin Web Panel (Next.js)
Next.js 16 app in `admin/`, deployed as a **static export** to S3 bucket `gatherrgo-admin` + CloudFront (`.github/workflows/admin-deploy.yml`). Role-based: **full** admins see everything; **content** admins see only Business Insights, Blogs and Amazing Deals. Pages: Business Insights, Health (incl. maintenance mode), Users, Trips & Events, Storage & Capacity, Feedback, AI Usage, Blogs, Amazing Deals, Promo Video, Legal, Security. See `admin/README.md`.

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
| Extras | Injects `FIREBASE_SERVICE_ACCOUNT_B64` into server `.env` for FCM; writes the Sign in with Apple config (`APPLE_*`, key from `APPLE_PRIVATE_KEY_B64`); optional nginx `client_max_body_size` for large uploads |

**Secrets (typical):** `AWS_*`, `EC2_*`, `FIREBASE_SERVICE_ACCOUNT_B64`, `APPLE_PRIVATE_KEY_B64`; the ECR registry is pinned in the workflow file.

### Frontend — `.github/workflows/frontend-deploy.yml`

**Trigger:** push to `main` when files under `frontend/**` change.

| Step | What happens |
|------|----------------|
| Node 20 | Install deps, `npm run build` (Vite) with `VITE_API_URL`, `VITE_CONTACT_RECEIVER_EMAIL` |
| S3 | Upload `dist/` to bucket **`gatherrgo-frontend`** with cache rules (immutable hashed assets, `no-cache` for `index.html`) |
| CDN | CloudFront invalidation via `CLOUDFRONT_FRONTEND_DISTRIBUTION_ID` |

### Admin — `.github/workflows/admin-deploy.yml`

**Trigger:** push to `main` when files under `admin/**` change.

| Step | What happens |
|------|----------------|
| Node 20 | Install deps, `npm run build` (Next.js static export) with `NEXT_PUBLIC_API_URL=https://api.gatherrgo.com` |
| S3 | Upload `out/` to bucket **`gatherrgo-admin`** with cache rules (immutable hashed `_next/static`, `no-cache` for HTML files) |
| CDN | CloudFront invalidation via `CLOUDFRONT_ADMIN_DISTRIBUTION_ID` |

### Mobile app (`app/`)

There is **no** GitHub Actions workflow for the React Native app in this repo; releases use local builds / EAS or store pipelines (configure as needed).

### Possible follow-ups

- Add a **`ci.yml`** (or job in existing workflows) for **ESLint + Jest** on every PR, with a PostgreSQL service container if you want CI parity with local tests.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native 0.84 (iOS + Android) |
| Admin Panel | Next.js 16 (static export, role-based) |
| Backend | Node.js 22 + Express.js |
| Database | AWS RDS — PostgreSQL |
| File Storage | AWS S3 + CloudFront CDN |
| Authentication | Email/password, Google and Sign in with Apple + JWT access/refresh tokens |
| Email | AWS SES / Brevo |
| AI Assistant (Swee) | **Google Gemini 2.5 Flash** — agent-style travel help; streaming from the API |
| Push Alerts | Firebase Cloud Messaging |
| Maps / Places | Google Places API |
| CI/CD | GitHub Actions — backend Docker → **ECR + EC2**; frontend and admin → **S3 + CloudFront** |
| Hosting | API on **EC2** (Docker); marketing site and admin panel on **S3** behind **CloudFront**; HTTPS via ACM (typical setup) |

---

## Milestone Progress

| # | Milestone | Status | What's working |
|---|-----------|--------|----------------|
| M1 | Auth & Profiles | ✅ Complete | Welcome, Login/Signup (email + Google + Apple), OTP verification, Create Profile, JWT sessions, password reset, account deletion |
| M2 | Home Screen & Trips | ✅ Complete | Home dashboard, Trip creation, Trip detail with all tabs — Activities, Docs, Members, Photos, Expenses, Polls, Notes, expense splits & debt simplification |
| M3 | Events | ✅ Complete | Event creation, Event detail — Docs, Members, Photos, Expenses, Polls, Notes |
| M4 | Friends & Invite System | ✅ Working | Friend requests, accept/decline, friends list, universal-link / app-link invites (trip, event, friend), invite requests, user profile gallery |
| M5 | Gallery & AI Chatbot | 🟡 In progress | Per-trip/event gallery, personal gallery + albums + engagement, Swee AI agent (conversations, form-driven create/edit, attachments) on **Google Gemini 2.5 Flash** only (not OpenAI) |
| M6 | Revisions & Deployment | 🟡 In progress | Backend, marketing site and admin deploy via GitHub Actions; QA & polish; iOS/Android store submission (Apple team + universal links configured) |
| M7 | Admin Web Panel | ✅ Working | RBAC login, Business Insights, Users, Trips & Events, Health + maintenance mode, Storage, Feedback, AI Usage, content (blogs/deals/promo video), legal publishing |

Each major package also has its own README with deeper detail: **`app/README.md`**, **`backend/README.md`**, **`frontend/README.md`**, **`admin/README.md`**. Open work is tracked in `docs/pending-development-changes.md`.

---

## Local Development

### Backend

```bash
cd backend
cp .env.example .env      # fill in AWS, DB, JWT, Google, Apple, Gemini, Firebase credentials
npm install
npm run migrate           # run all SQL migrations
npm run db:seed           # optional: seed test data
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
bundle install && bundle exec pod install --project-directory=ios
npm run ios

# Android
npm run android
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

Sign in with an account that has `is_platform_admin` / `is_content_admin` set (see `backend/scripts/create-platform-admin.js`). Details: `admin/README.md`.

---

## Out of Scope (v1)

- Community / Social Feed
- Group Chat between members (Swee AI is the only chat in v1)
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
