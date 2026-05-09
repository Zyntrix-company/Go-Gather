# GatherrGo — Marketing website (`frontend/`)

Vite + React + TypeScript public site for **GatherGo / GatherrGo** (landing, legal pages, SEO). Figma-derived UI lives in this package.

- **Design reference:** [Figma — GatherrGo](https://www.figma.com/design/2xmI17hMKkO25OYEgMmERH/GatherrGo)

---

## Tech Stack

| Purpose | Technology |
|---------|-----------|
| Build tool | Vite 6.3.5 |
| Framework | React 19 + TypeScript |
| Routing | react-router-dom v7 |
| UI components | Material UI v7, Radix UI primitives |
| Styling | Tailwind CSS 4 (Vite plugin) |
| Forms | React Hook Form + Zod |
| Icons | lucide-react |
| Charts | recharts |
| Carousel | Embla Carousel, react-slick |
| Toasts | Sonner |
| Date utils | date-fns |

---

## Pages

- **Landing** — hero section, feature highlights, app download CTA
- **About** — team and product story
- **Contact** — inquiry form (posts to API at `VITE_API_URL/contact`)
- **Blog** — editorial content
- **Deals** — curated travel deals (hotel / cab cards from backend `deals/`)
- **Privacy Policy** — legal (references Google Maps, Gemini AI, AWS)
- **Terms of Service** — legal

SEO: `sitemap.xml` and `robots.txt` included in `public/`.

---

## Scripts

```bash
cd frontend
npm install
npm run dev      # local dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

Build-time env (see also GitHub Actions `frontend-deploy.yml`):

- `VITE_API_URL` — public API base URL (e.g. `https://api.gatherrgo.com`)
- `VITE_CONTACT_RECEIVER_EMAIL` — contact form destination

---

## Deploy

On **push to `main`** with changes under `frontend/**`, `.github/workflows/frontend-deploy.yml` builds and uploads **`dist/`** to **S3** (`gatherrgo-frontend`) and invalidates **CloudFront**. Details: repo root **`README.md`** → *CI/CD & GitHub Actions*.

---

## Monorepo

This folder is one part of the GatherGo repo. Mobile app: `../app/`, API: `../backend/`, overview: **`../README.md`**.

Third-party copy in legal pages references **Google Maps**, **Gemini AI** (suggestions), **AWS**, etc., as described in Terms/Privacy source files under `src/`.
