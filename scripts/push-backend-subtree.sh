#!/bin/bash
# =============================================================================
# ONE SCRIPT: Backend subtree split → push to BackendGK2.0 → Render deploys from there.
# Run from anywhere: /path/to/GodlyKidsGem2/scripts/push-backend-subtree.sh
# Or from repo root: ./scripts/push-backend-subtree.sh
# =============================================================================

set -e
# Repo root: same directory as the parent of scripts/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

BRANCH="${1:-main}"
REMOTE="backend"
PREFIX="backend"

echo "Repo root: $ROOT"
echo ""

# 1) Ensure remote exists
if ! git remote get-url "$REMOTE" &>/dev/null; then
    echo "ERROR: Remote '$REMOTE' is not configured."
    echo "Add it with:"
    echo "  git remote add backend git@github.com:KBPUBLISH/BackendGK2.0.git"
    exit 1
fi
REMOTE_URL=$(git remote get-url "$REMOTE")
echo "→ Remote $REMOTE = $REMOTE_URL"
echo ""

# 2) Require all backend changes to be committed (subtree split only uses committed files)
if ! git diff --quiet -- "$PREFIX/" || ! git diff --cached --quiet -- "$PREFIX/"; then
    echo "ERROR: You have uncommitted changes in backend/."
    echo "Subtree split only includes committed files. Commit first, then run this script:"
    echo "  git add backend/"
    echo "  git commit -m 'Your message'"
    echo "  $0 $BRANCH"
    exit 1
fi

# 3) Remove leftover branch from a previous failed run (so split can create it)
if git show-ref --quiet refs/heads/backend-split; then
    echo "→ Removing existing branch backend-split (from previous run)..."
    git branch -D backend-split
fi

# 4) Subtree split (this can take 1–2 minutes)
echo "→ Splitting subtree (prefix=$PREFIX) into branch backend-split..."
git subtree split --prefix="$PREFIX" -b backend-split

# 5) If remote already has this exact commit, add empty commit to force Render redeploy
git fetch "$REMOTE" "$BRANCH" --quiet 2>/dev/null || true
REMOTE_SHA=$(git rev-parse "refs/remotes/$REMOTE/$BRANCH" 2>/dev/null || echo "")
OUR_SHA=$(git rev-parse backend-split)
if [ -n "$REMOTE_SHA" ] && [ "$REMOTE_SHA" = "$OUR_SHA" ]; then
    echo ""
    echo "→ Remote already has this code. Adding empty commit to trigger Render redeploy..."
    SAVED_BRANCH=$(git branch --show-current)
    git stash push -m "push-backend-subtree temp" 2>/dev/null || true
    git checkout backend-split
    git commit --allow-empty -m "chore: trigger Render redeploy"
    git checkout "$SAVED_BRANCH"
    git stash pop 2>/dev/null || true
    echo ""
fi

# 6) Push to BackendGK2.0 (main branch). Render deploys from this repo.
# Use macOS Keychain for GitHub credentials (HTTPS: token/password stored in Keychain Access)
git config --global credential.helper osxkeychain 2>/dev/null || true
echo "→ Pushing backend-split to $REMOTE $BRANCH (using Keychain for GitHub credentials)..."
if ! git push "$REMOTE" backend-split:"$BRANCH" --force; then
    echo ""
    echo "PUSH FAILED. Common causes:"
    echo "  • Run this script from your Mac Terminal (not Cursor/IDE) so SSH/Keychain can authenticate."
    echo "  • Test SSH: ssh -T git@github.com"
    echo "  • Ensure remote uses SSH: git remote set-url backend git@github.com:KBPUBLISH/BackendGK2.0.git"
    echo ""
    echo "The subtree split already succeeded. To push only (no re-split), run:"
    echo "  cd $ROOT && git push $REMOTE backend-split:$BRANCH --force"
    exit 1
fi

PUSHED_SHA=$(git rev-parse backend-split)
git branch -D backend-split

echo ""
if [ -n "$REMOTE_SHA" ] && [ "$REMOTE_SHA" = "$OUR_SHA" ]; then
    echo "Push completed (remote was already up-to-date). To deploy on Render: Manual Deploy → Deploy latest commit."
else
    echo "Done. BackendGK2.0 ($REMOTE) is updated. Pushed commit: ${PUSHED_SHA:0:7}"
    echo "Render should auto-deploy. If not: dashboard.render.com → godlykids-backend → Manual Deploy."
fi
echo ""
