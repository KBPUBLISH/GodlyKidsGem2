# Backend deploy to Render

## Which repo does Render use?

**Check in Render:** Dashboard → **godlykids-backend** → **Settings** → **Build & Deploy** → **Repository**.

- **If it shows BackendGK2.0**  
  Deploys are triggered by pushes to that repo. You must run the **subtree push** below (from your machine, so GitHub auth works). Pushing only to **origin** (GodlyKidsGem2) will **not** trigger Render.

- **If it shows GodlyKidsGem2** with **Root Directory** = `backend`  
  Deploys are triggered by pushes to **origin** (GodlyKidsGem2). You do **not** need the subtree push; just `git push origin main` after backend changes.

---

## 1. Push backend to BackendGK2.0 (only if Render uses BackendGK2.0)

Run **on your machine** (GitHub auth required; the script can’t push from CI/Cursor):

```bash
./scripts/push-backend-subtree.sh
```

This splits `backend/` and pushes to the `backend` remote (BackendGK2.0) as `main`. The first run can take 1–2 minutes.

## 2. Trigger deploy on Render

- **Auto-deploy:** If the Render service is connected to **BackendGK2.0** and “Auto-Deploy” is on for `main`, a deploy should start after the push. Check the Render dashboard for a new deploy.
- **From the terminal:** Run `./scripts/trigger-render-deploy.sh` (one-time: set `RENDER_DEPLOY_HOOK_URL` from Render → godlykids-backend → Settings → Deploy Hook).
- **Manual deploy in dashboard:** If nothing started:
  1. Open [Render Dashboard](https://dashboard.render.com)
  2. Open the **godlykids-backend** service
  3. **Manual Deploy** → **Deploy latest commit**

## 3. If Render still doesn’t deploy

- **Repo:** In Render → **Settings** → confirm the connected repo is **KBPUBLISH/BackendGK2.0** (not GodlyKidsGem2).
- **Branch:** Branch should be **main** (or whatever you pushed).
- **Root directory:** Leave blank (BackendGK2.0 repo root is the backend code).
- **Build / Start:** Build command `npm install`, start command `npm start` (see `backend/render.yaml`).

**If Render is connected to GodlyKidsGem2 with Root Directory = `backend`:**  
Then the subtree push to BackendGK2.0 does nothing for Render. Pushing to **origin** (e.g. `git push origin main`) is what triggers the deploy. No need to run `push-backend-subtree.sh` for Render in that case.

---

## 4. Gemini “User location is not supported” (502 from analyze-scene-prompt)

If you see in logs:

```text
Gemini analyze-scene-prompt error: 400 { "error": { "message": "User location is not supported for the API use.", "status": "FAILED_PRECONDITION" } }
```

the **Consumer Gemini API** is not allowed from the region your Render service uses (even if Render is set to Oregon, routing can still trigger this).

**Preferred fix:** Use **Vertex AI** for this endpoint so the request uses an explicit GCP region (e.g. `us-central1`), not Render’s location.

1. Ensure the backend has **GCP credentials** set: **GCS_CREDENTIALS_JSON** or **GOOGLE_SERVICE_ACCOUNT_JSON** (same as for monthly book image generation).
2. Redeploy. The analyze-scene-prompt route **tries Vertex first** when those env vars are set; only if Vertex is missing or fails does it call the Consumer Gemini API.
3. Optional: set **VERTEX_AI_ANALYZE_SCENE_LOCATION** (e.g. `us-central1`) to force a specific region; default is `us-central1`.

**Alternative:** If you cannot use Vertex, set the Render service **Region** to **Oregon (US West)** or **Ohio (US East)** in the dashboard and redeploy. Sometimes that resolves the Consumer API block; if not, Vertex is the reliable fix.
