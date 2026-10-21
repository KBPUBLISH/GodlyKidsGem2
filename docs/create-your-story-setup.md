# Create Your Story — Step-by-Step Setup & Fixes

## 1. Run the app locally (dev)

1. Open a terminal in the project root: `GodlyKidsGem2`.
2. Run: **`npm run dev`**
3. In the browser, open the URL shown (e.g. **http://127.0.0.1:3000** or **http://127.0.0.1:3001** if 3000 is in use).
4. Code changes will hot-reload when you save. You do **not** need to run `npm run build` or `npm run preview` while developing.

---

## 2. Run a production-style build (preview)

Only when you want to test the **built** app (like production):

1. **Build:** `npm run build`
2. **Preview:** `npm run preview`
3. Open the URL shown (e.g. **http://127.0.0.1:4173**).

If you change code, run **step 1** again, then **step 2**, to see changes in preview.

---

## 3. “Failed to generate character” (500) — what it means

When you tap **Take Photo** in Create Your Story (selfie step), the app calls the backend:

**`POST /api/character/generate`**

The backend then:

1. Uses **Google Cloud credentials** to call **Vertex AI Imagen** (turns the selfie into a character image).
2. Uploads the result to **Google Cloud Storage (GCS)** and returns the image URL.

A **500** means one of these failed (credentials, Imagen, or GCS).

---

## 4. What we did so the flow doesn’t block

- **Backend:** If character generation throws (missing credentials, Imagen error, etc.), the API now returns **200** with a **placeholder image URL** and `fallback: true` instead of 500.
- **Result:** You can still click **Next** and finish Create Your Story; the book will use the placeholder as the child’s image until you fix the backend (step 5).

---

## 5. Fix character generation for real (step by step)

Do this on **Render** (or wherever the backend runs).

### Step 5.1 — Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable **Vertex AI API** (and **Cloud Storage** if you use a GCS bucket for uploads).

### Step 5.2 — Service account and key

1. In Cloud Console: **IAM & Admin → Service accounts**.
2. Create a service account (e.g. “godlykids-backend”).
3. Grant it roles that include:
   - **Vertex AI User** (for Imagen).
   - **Storage Object Admin** (or similar) on the bucket you use for character images.
4. Create a **JSON key** for that service account and download it.

### Step 5.3 — GCS bucket (for saving character images)

1. In Cloud Console: **Cloud Storage → Buckets**.
2. Create a bucket (e.g. `godlykids-characters`) in a region you use.
3. Set permissions so the service account can read/write objects (and make objects public if the app needs public URLs).

### Step 5.4 — Set environment variables on Render

1. Open your **Render** dashboard → your **backend service** → **Environment**.
2. Add (or update) these variables:

| Variable | What to set |
|----------|-------------|
| **GCS_CREDENTIALS_JSON** | The **entire contents** of the service account JSON key file (paste as one line, or use Render’s “multi-line” if supported). |
| **GCS_BUCKET_NAME** | Your bucket name (e.g. `godlykids-characters`). |

3. Save. Render will redeploy with the new env.

### Step 5.5 — Confirm

1. Trigger **Create Your Story** again and take a selfie.
2. If it still fails, open **Render → Logs** and look for the exact error (e.g. “GCS credentials not configured”, “Could not get access token”, or an Imagen/Vertex error). Fix the missing permission or API enablement based on that message.

---

## 6. Hiding the wheel and header on Create Your Story

- **Wheel:** The bottom nav wheel is hidden when the path is **`/create-your-story`** (see `BottomNavigation.tsx`).
- **Header:** The main app header is not shown on the Create Your Story page (see `CreateYourStoryPage.tsx`).

No extra config needed. If you still see the wheel or header, do a **hard refresh** (e.g. Cmd+Shift+R) or restart **`npm run dev`** and open **`/#/create-your-story`** again.

---

## 7. Deploying backend (subtree push to Render)

So that **BackendGK2.0** (and Render) get your latest backend code:

1. **Commit** all changes in the main repo (e.g. `GodlyKidsGem2`).
2. From the **repo root**, run:  
   **`./scripts/push-backend-subtree.sh main`**
3. That pushes the **backend/** folder to the **backend** remote (`BackendGK2.0`). Render will deploy from that repo (auto or manual deploy).

---

## 8. Deploying portal (subtree push for Netlify)

So that the **portal** repo (and Netlify) get your latest portal code:

1. **Commit** all changes.
2. From the **repo root**, run:  
   **`./scripts/push-portal-subtree.sh main`**  
   This splits `projects-portal/` from main and pushes to the `portal` remote (portalgk2.0). The split step can take a few minutes.
3. Netlify will build and deploy from the portal repo.

**GitHub credentials:** To use macOS Keychain so push works without re-entering your password, set:  
`git config --global credential.helper osxkeychain`

**If push fails in IDE (e.g. "Device not configured"):** Run the push **in your own Terminal** so Keychain can supply credentials. If the subtree split already completed but push failed, run:  
`./scripts/push-portal-push-only.sh`  
Otherwise run `./scripts/push-portal-subtree.sh main` in Terminal.

**Note:** The **portal** deploys on **Netlify** (not Render). Render is for the backend. Pushing to the portal remote (portalgk2.0) triggers Netlify; ensure the Netlify site is connected to that repo and branch `main`.

---

## 9. Quick checklist

| Goal | Action |
|------|--------|
| Develop locally with live reload | `npm run dev` → open URL in browser |
| Test production build locally | `npm run build` then `npm run preview` |
| Create Your Story works (with placeholder avatar) | No extra steps; backend returns placeholder on error |
| Real character generation (selfie → avatar) | Set **GCS_CREDENTIALS_JSON** and **GCS_BUCKET_NAME** on Render (see step 5) |
| Wheel/header hidden on Create Your Story | Already in code; refresh or restart dev |
| Backend live on Render | Commit → `./scripts/push-backend-subtree.sh main` |
| Portal live on Netlify | Commit → `./scripts/push-portal-subtree.sh main` |
