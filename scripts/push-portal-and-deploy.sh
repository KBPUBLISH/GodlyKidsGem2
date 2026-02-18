#!/bin/bash
# Push portal subtree to GitHub, then trigger a Netlify deploy.
# Run from repo root. Uses Keychain for GitHub; needs NETLIFY_PORTAL_BUILD_HOOK_URL set for the trigger.
#
#   ./scripts/push-portal-and-deploy.sh
#
# First time: create a build hook in Netlify (Build & deploy → Build hooks), add the URL to .env:
#   NETLIFY_PORTAL_BUILD_HOOK_URL=https://api.netlify.com/build_hooks/xxxxxxxx

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# Load .env if present (for NETLIFY_PORTAL_BUILD_HOOK_URL)
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

echo "=== 1. Pushing portal to GitHub ==="
"$SCRIPT_DIR/push-portal-subtree.sh" main

echo ""
echo "=== 2. Triggering Netlify deploy ==="
if [[ -n "$NETLIFY_PORTAL_BUILD_HOOK_URL" ]]; then
  "$SCRIPT_DIR/trigger-netlify-portal.sh"
else
  echo "NETLIFY_PORTAL_BUILD_HOOK_URL not set. Trigger deploy manually:"
  echo "  app.netlify.com → your portal site → Deploys → Trigger deploy → Deploy site"
  echo "Or add NETLIFY_PORTAL_BUILD_HOOK_URL to .env and run this script again."
fi
