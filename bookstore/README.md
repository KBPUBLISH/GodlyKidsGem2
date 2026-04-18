# Bookstore (bookstore.godlykids.com)

Standalone public-facing site that lists Amazon books published by the Godly Kids team.
Clicking a book opens it on Amazon in a new tab.

## Where the data comes from

Books are managed from the admin portal (`projects-portal`) under **Amazon Book Store**, backed by
the existing `/api/amazon-books` REST endpoints in `backend/src/routes/amazonBooks.js`.

Only books with `status === 'published'` are displayed on the bookstore site.

## Local development

```bash
cd bookstore
npm install
npm run dev
```

By default the app talks to the production backend (`https://backendgk2-0.onrender.com`). To point
at a different backend, create `bookstore/.env.local`:

```
VITE_API_BASE_URL=http://localhost:5001
```

You can also run it from the repo root via `npm run bookstore`.

## Production build

```bash
npm run build
```

Outputs static files to `bookstore/dist/`.

## Deploying to bookstore.godlykids.com

1. Create a new Netlify site (separate from the main app and portal).
2. Connect it to this repo and set:
   - **Base directory**: `bookstore`
   - **Build command**: `npm run build`
   - **Publish directory**: `bookstore/dist`
3. Under **Domain management**, add the custom domain `bookstore.godlykids.com` and follow
   Netlify's CNAME / DNS instructions (typically a `CNAME` record for `bookstore` pointing to
   `<your-site>.netlify.app`).
4. (Optional) Set `VITE_API_BASE_URL` in Netlify env vars if the backend URL ever changes.

The `netlify.toml` already configures the build, and `public/_redirects` handles SPA fallback.
