# Render Deployment Fix

## Issue 1: "Missing script: start"

If you see:
```
npm error Missing script: "start"
```

**Quick fix:** Set the start command directly so Render doesn’t rely on `npm start`:

1. Go to [Render Dashboard](https://dashboard.render.com) → **godlykids-backend** → **Settings**
2. Find **Start Command**
3. Set it to: **`node src/index.js`**
4. Save. Render will redeploy.

After that, redeploy from **Manual Deploy** → **Deploy latest commit** if needed.

---

## Issue 2: Wrong start command (node index.js)

Render is trying to run `node index.js` instead of the app entrypoint, causing:
```
Error: Cannot find module '/opt/render/project/src/index.js'
```

## Solution

The service needs to run the app entrypoint. You have two options:

### Option 1: Set Start Command in Render Dashboard (Quick Fix)

1. Go to your Render dashboard
2. Select the `godlykids-backend` service
3. Go to **Settings** → **Start Command**
4. Set it to: **`node src/index.js`** (or `npm start` if package.json has a start script)
5. Save changes
6. Render will automatically redeploy

### Option 2: Use Blueprint (Recommended for Future)

If you want to use the `render.yaml` file:

1. Delete the current service in Render dashboard
2. Go to **Dashboard** → **New** → **Blueprint**
3. Connect your GitHub repository: `https://github.com/KBPUBLISH/BackendGK2.0`
4. Render will automatically detect `render.yaml` and create the service with correct settings

## Current Configuration

- **Start Command:** `npm start` (which runs `node src/index.js`)
- **Build Command:** `npm install`
- **Node Version:** 20.x (specified in render.yaml)

## Verification

After updating, the service should:
1. Build successfully ✅
2. Start with `npm start` ✅
3. Run `node src/index.js` correctly ✅



