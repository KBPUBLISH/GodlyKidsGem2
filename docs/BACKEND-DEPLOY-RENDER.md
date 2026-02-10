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
- **Manual deploy:** If nothing started:
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
