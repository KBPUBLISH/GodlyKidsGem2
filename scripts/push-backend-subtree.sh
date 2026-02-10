#!/bin/bash
# Push backend/ to BackendGK2.0 repo so Render can deploy.
# Run from repo root: ./scripts/push-backend-subtree.sh
# After this, trigger a deploy in Render (or it may auto-deploy if enabled).

set -e
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

BRANCH="${1:-main}"
REMOTE="backend"
PREFIX="backend"

echo "→ Splitting subtree (prefix=$PREFIX) into branch backend-split..."
git subtree split --prefix="$PREFIX" -b backend-split

echo "→ Pushing backend-split to $REMOTE $BRANCH..."
git push "$REMOTE" backend-split:"$BRANCH"

echo "→ Deleting local branch backend-split..."
git branch -D backend-split

echo ""
echo "Done. BackendGK2.0 ($REMOTE) is updated."
echo "If Render didn’t auto-deploy: Dashboard → godlykids-backend → Manual Deploy → Deploy latest commit."
