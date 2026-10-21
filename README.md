<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Godly Kids

Faith-filled interactive reading adventure app for kids. React (Vite) frontend
with a Node/Express backend (see `backend/`) and a separate admin portal
(`projects-portal/`) and public bookstore (`bookstore/`).

> **Security note (2026-04-18):** This project was originally scaffolded from
> Google AI Studio, which published a frontend-only app at
> `https://ai.studio/apps/drive/...` with the `GEMINI_API_KEY` baked into the
> client bundle. That public AI Studio app was the source of a billing-spike
> leak. The AI Studio app must remain **unpublished / deleted**, and all Gemini
> calls must go through the backend (see `backend/src/routes/aiGenerate.js`).
> **NEVER** re-introduce `process.env.API_KEY` or `process.env.GEMINI_API_KEY`
> references in any frontend file — the Vite `define` for that key has been
> removed in `vite.config.ts` on purpose.

## Run Locally

**Prerequisites:** Node.js 20.x

```bash
# Frontend
npm install
npm run dev

# Backend (separate terminal)
cd backend
npm install
cp .env.example .env   # then fill in secrets
npm start
```

## Environment

- Frontend: no secrets should ever live here. Only `VITE_*` variables that are
  safe to ship publicly.
- Backend: `GEMINI_API_KEY`, `GCS_CREDENTIALS_JSON` (or
  `GOOGLE_SERVICE_ACCOUNT_JSON`), `MONGO_URI`, `STRIPE_SECRET_KEY`, etc. go in
  `backend/.env` (or Render env vars in production). Never commit these.

## Deployment

- Frontend: Netlify (`netlify.toml`).
- Backend: Render (`backend/render.yaml`).
- Admin portal: Netlify subdomain.
- Bookstore: Netlify (`bookstore.godlykids.com`).
