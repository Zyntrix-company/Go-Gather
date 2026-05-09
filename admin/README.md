# GatherrGo — Admin Panel (`admin/`)

Next.js 16 admin web panel for **GatherrGo**. Deployed as a static export to S3 + CloudFront. Operational dashboard features are planned for **Milestone 7**.

---

## Status

**Milestone 7 — Scaffolded.** The Next.js project is initialised and wired into the CI/CD pipeline. Admin features planned:

- **Business Insights** — usage metrics, active trips/events, growth trends
- **User Management** — search, view, and moderate accounts
- **Trips & Events** — oversight, archiving, member management
- **Error & Health** — API health status, error monitoring
- **Storage Analytics** — S3 usage by bucket/prefix
- **Feedback Management** — user-submitted feedback and Swee AI issue reports

---

## Tech Stack

| Purpose | Technology |
|---------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| React | 19.2.3 |
| Styling | Tailwind CSS 4 (`@tailwindcss/postcss`) |
| Output | Static export (`output: 'export'`) |
| Linting | ESLint 9 |

---

## Scripts

```bash
cd admin
npm install
npm run dev      # local dev server → http://localhost:3000
npm run build    # static export → out/
npm run start    # server mode (local preview only — prod uses static export)
npm run lint     # ESLint
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | GatherrGo API base URL (e.g. `https://api.gatherrgo.com`) |

Create a `.env.local` for local development:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Deploy

On **push to `main`** with changes under `admin/**`, `.github/workflows/admin-deploy.yml`:

| Step | What happens |
|------|-------------|
| Node 20 | Install deps, `npm run build` with `NEXT_PUBLIC_API_URL=https://api.gatherrgo.com` |
| S3 | Upload `out/` to bucket **`gatherrgo-admin`** with smart cache headers |
| CDN | CloudFront invalidation via `CLOUDFRONT_ADMIN_DISTRIBUTION_ID` |

**Cache strategy:**

| Path | Cache-Control |
|---|---|
| `*.html` | `no-cache` (always fresh) |
| `_next/static/**` | `max-age=31536000, immutable` (content-hashed) |
| Favicon / other static | `max-age=86400` |

**Required GitHub secrets:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_ADMIN_DISTRIBUTION_ID`

---

## Monorepo

This folder is one part of the GatherGo repo. Mobile app: `../app/`, API: `../backend/`, marketing site: `../frontend/`, overview: **`../README.md`**.
