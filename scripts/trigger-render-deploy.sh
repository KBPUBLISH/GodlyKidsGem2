#!/usr/bin/env bash
# Trigger a manual deploy of godlykids-backend on Render from the terminal.
#
# One-time setup: Get your deploy hook URL from Render:
#   1. Open https://dashboard.render.com
#   2. Open the "godlykids-backend" service
#   3. Settings → Deploy Hook → copy the URL (looks like https://api.render.com/deploy/srv-...?key=...)
#   4. Export it (add to ~/.zshrc or run before this script):
#        export RENDER_DEPLOY_HOOK_URL="https://api.render.com/deploy/srv-XXXXX?key=YYYY"
#
# Then run:
#   ./scripts/trigger-render-deploy.sh
#
# Or inline (replace with your real URL):
#   curl -X POST "https://api.render.com/deploy/srv-XXXXX?key=YYYY"

set -e

if [ -z "$RENDER_DEPLOY_HOOK_URL" ]; then
  echo "RENDER_DEPLOY_HOOK_URL is not set."
  echo ""
  echo "To trigger a deploy from the terminal:"
  echo "  1. Open https://dashboard.render.com → godlykids-backend → Settings"
  echo "  2. Find 'Deploy Hook' and copy the URL"
  echo "  3. Run:"
  echo "     export RENDER_DEPLOY_HOOK_URL='https://api.render.com/deploy/srv-...?key=...'"
  echo "     ./scripts/trigger-render-deploy.sh"
  echo ""
  echo "Or trigger once with (paste your deploy hook URL):"
  echo '  curl -X POST "YOUR_DEPLOY_HOOK_URL"'
  exit 1
fi

echo "Triggering Render deploy for godlykids-backend..."
resp=$(curl -s -w "\n%{http_code}" -X POST "$RENDER_DEPLOY_HOOK_URL")
http_code=$(echo "$resp" | tail -n1)
body=$(echo "$resp" | sed '$d')

if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
  echo "Deploy triggered successfully (HTTP $http_code)."
  echo "Check Render dashboard for build status."
else
  echo "Request returned HTTP $http_code"
  echo "$body"
  exit 1
fi
