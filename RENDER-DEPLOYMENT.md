# Render Deployment Guide

## Services Configuration

This project has 3 services configured in `render.yaml`:

### 1. Backend API (`godlykids-backend`)
- **Type:** Web Service
- **Build Command:** `cd backend && npm install`
- **Start Command:** `cd backend && npm start`
- **Port:** Automatically set by Render (uses `process.env.PORT`)

### 2. Main App Frontend (`godlykids-app`)
- **Type:** Static Site
- **Build Command:** `npm install --production=false && npm run build`
- **Publish Path:** `./dist`

### 3. Projects Portal (`godlykids-portal`)
- **Type:** Static Site
- **Build Command:** `cd projects-portal && npm install --production=false && npm run build`
- **Publish Path:** `./projects-portal/dist`

## Required Environment Variables

### Backend Service
Set these in the Render dashboard for the backend service:

- `MONGO_URI` - MongoDB connection string
- `ELEVENLABS_API_KEY` - ElevenLabs API key for TTS
- `GCS_BUCKET_NAME` - Google Cloud Storage bucket name
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account JSON (or use environment variable)
- `PORT` - Automatically set by Render (optional override)

### Frontend Services
- `VITE_API_BASE_URL` - Backend API URL (e.g., `https://godlykids-backend.onrender.com`)

## Common Build Issues & Solutions

### 1. Build Fails with "Command not found"
- **Solution:** Ensure build commands use full paths or `cd` into directories correctly

### 2. Missing Dependencies
- **Solution:** Check that all dependencies are in `package.json` (not just `devDependencies`)

### 3. TypeScript Errors
- **Solution:** Run `npm run build` locally first to catch TypeScript errors before deploying

### 4. Environment Variables Not Set
- **Solution:** Add all required environment variables in Render dashboard before deploying

### 5. Port Binding Issues
- **Solution:** Backend uses `process.env.PORT` which Render sets automatically. Static sites don't need a port.

### 6. Node Version Issues
- **Solution:** Render.yaml specifies `nodeVersion: 20.x`. If issues persist, check Node compatibility.

## Deployment Steps

1. **Push render.yaml to GitHub**
   ```bash
   git add render.yaml
   git commit -m "Add Render deployment configuration"
   git push
   ```

2. **Connect Repository in Render**
   - Go to Render dashboard
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` and create all services

3. **Set Environment Variables**
   - For each service, go to Environment tab
   - Add all required environment variables
   - For sensitive values, mark as "Secret"

4. **Deploy**
   - Render will automatically build and deploy
   - Check build logs for any errors

## Troubleshooting

If build fails, check:
1. Build logs in Render dashboard
2. Node version compatibility
3. All environment variables are set
4. Dependencies install correctly
5. Build commands execute successfully

For backend issues:
- Check MongoDB connection string format
- Verify service account credentials for GCS
- Ensure all API keys are valid

For frontend issues:
- Verify `VITE_API_BASE_URL` points to correct backend URL
- Check that build output directory matches `publishPath`
- Ensure no TypeScript or linting errors


