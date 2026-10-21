#!/bin/bash
# Trigger a Netlify deploy for the portal (portal.godlykids.com).
# Uses a Netlify build hook URL so you don't have to click in the dashboard.
#
# One-time setup in Netlify:
#   Site settings → Build & deploy → Build hooks → Add build hook (e.g. "Portal deploy")
#   Copy the URL (looks like https://api.netlify.com/build_hooks/xxxxxxxx)
#
# Then either:
#   export NETLIFY_PORTAL_BUILD_HOOK_URL="https://api.netlify.com/build_hooks/xxxxxxxx"
#   ./scripts/trigger-netlify-portal.sh
# Or:
#   ./scripts/trigger-netlify-portal.sh "https://api.netlify.com/build_hooks/xxxxxxxx"
#
# Optional: clear_cache=1 to clear cache before building:
#   clear_cache=1 ./scripts/trigger-netlify-portal.sh

set -e
HOOK_URL="${1:-$NETLIFY_PORTAL_BUILD_HOOK_URL}"

if [[ -z "$HOOK_URL" ]]; then
  echo "ERROR: No build hook URL."
  echo "  Set NETLIFY_PORTAL_BUILD_HOOK_URL in .env or pass the URL as the first argument."
  echo ""
  echo "Get the URL from Netlify:"
  echo "  Site (portal.godlykids.com) → Site settings → Build & deploy → Build hooks"
  echo "  Add build hook → copy the URL (https://api.netlify.com/build_hooks/...)"
  exit 1
fi

if [[ "$clear_cache" == "1" ]]; then
  HOOK_URL="${HOOK_URL}?clear_cache=true"
fi

echo "Triggering Netlify deploy..."
if curl -s -o /dev/null -w "%{http_code}" -X POST "$HOOK_URL" | grep -q "200\|201"; then
  echo "Deploy triggered. Check: app.netlify.com → your site → Deploys"
else
  echo "Trigger request may have failed. Check the URL and Netlify dashboard."
  exit 1
fi
