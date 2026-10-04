# GatherrGo — Admin Panel (`admin/`)

Next.js 16 admin web panel for **GatherrGo**. Deployed as a static export to S3 + CloudFront. Talks to the backend `/admin/*` API (see `../backend/README.md` → *Admin*).

---

## Status

**Milestone 7 — Working.** Role-based dashboard (app routes under `app/dashboard/`):

| Page | Route | Roles |
|---|---|---|
| Business Insights | `/dashboard/overview` | full, content |
| Health & maintenance mode | `/dashboard/health` | full |
| Users (incl. creating content admins) | `/dashboard/users` | full |
| Trips & Events | `/dashboard/trips-events` | full |
| Storage & Capacity | `/dashboard/storage` | full |
| Feedback (contact submissions) | `/dashboard/contact` | full |
| AI Usage (Swee) | `/dashboard/ai-usage` | full |
| Blogs | `/dashboard/blogs` | full, content |
| Amazing Deals | `/dashboard/deals` | full, content |
| Promo Video, Legal publishing, Security | `/dashboard/promo-video`, `/legal`, `/security` | full |

**Auth & roles:** sign in at `/login` with a normal GatherrGo account that has `is_platform_admin` (**full**) or `is_content_admin` (**content**). Tokens are kept in `localStorage` (`admin_token`, `admin_refresh_token`, `admin_role`); `lib/api.js` handles refresh and logout. Create the first admin with `backend/scripts/create-platform-admin.js`.

---

## Tech Stack

| Purpose | Technology |
|---------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| React | 19.2.3 |
| Styling | Tailwind CSS 4 (`@tailwindcss/postcss`) |
| Output | Static export (`output: 'export'`) |
| Icons | lucide-react |
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
