#!/bin/bash
# Push existing portal-split branch to portal remote (no split).
# Use this when subtree split already ran but push failed (e.g. auth in IDE).
# Run IN YOUR TERMINAL so Keychain can supply GitHub credentials.
# From repo root:  ./scripts/push-portal-push-only.sh
# From anywhere in repo:  bash "$(git rev-parse --show-toplevel)/scripts/push-portal-push-only.sh"
set -e
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Run this from inside the GodlyKidsGem2 repo."; exit 1; }
cd "$ROOT"
REMOTE="portal"
BRANCH="main"
if ! git rev-parse --verify portal-split >/dev/null 2>&1; then
  echo "Branch portal-split not found. Run full push: ./scripts/push-portal.sh"
  exit 1
fi
echo "→ Pushing portal-split to $REMOTE $BRANCH (force)..."
git push "$REMOTE" portal-split:"$BRANCH" --force
echo "→ Deleting local branch portal-split..."
git branch -D portal-split
echo ""
echo "Done. portalgk2.0 ($REMOTE) is updated. Netlify will deploy from main."
