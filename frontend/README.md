# GatherrGo — Marketing website (`frontend/`)

Vite + React + TypeScript public site for **GatherGo / GatherrGo** (landing, legal pages, SEO). Figma-derived UI lives in this package.

- **Design reference:** [Figma — GatherrGo](https://www.figma.com/design/2xmI17hMKkO25OYEgMmERH/GatherrGo)

---

## Scripts

```bash
cd frontend
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
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
