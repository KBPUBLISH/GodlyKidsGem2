#!/bin/bash
# =============================================================================
# Push projects-portal/ to portalgk2.0 repo → Netlify deploys from that repo.
# Run from repo root: ./scripts/push-portal-subtree.sh main
# Or from anywhere: /path/to/GodlyKidsGem2/scripts/push-portal-subtree.sh main
#
# IMPORTANT: Run this in your system Terminal (Terminal.app, iTerm), not inside
# Cursor. Cursor's terminal often cannot supply GitHub credentials; the push will
# fail with "could not read Username" or similar. If HTTPS fails, use SSH:
#   git remote set-url portal git@github.com:KBPUBLISH/portalgk2.0.git
#
# Usage (split only, no push): ./scripts/push-portal-subtree.sh --split-only [branch]
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

SPLIT_ONLY=false
if [[ "${1:-}" == "--split-only" ]]; then
  SPLIT_ONLY=true
  shift
fi

BRANCH="${1:-main}"
REMOTE="portal"
PREFIX="projects-portal"

echo "Repo root: $ROOT"
echo ""

if ! git remote get-url "$REMOTE" &>/dev/null; then
  echo "ERROR: Remote '$REMOTE' is not configured."
  echo "Add it with: git remote add portal https://github.com/KBPUBLISH/portalgk2.0.git"
  exit 1
fi
echo "→ Remote $REMOTE = $(git remote get-url $REMOTE)"
echo ""

if [[ "$SPLIT_ONLY" == "false" ]]; then
  if ! git diff --quiet -- "$PREFIX/" 2>/dev/null || ! git diff --cached --quiet -- "$PREFIX/" 2>/dev/null; then
    echo "ERROR: You have uncommitted changes in projects-portal/."
    echo "Commit first, then run this script again."
    exit 1
  fi
  if git show-ref --quiet refs/heads/portal-split 2>/dev/null; then
    echo "→ Removing existing branch portal-split..."
    git branch -D portal-split
  fi
fi

echo "→ Splitting subtree (prefix=$PREFIX) into branch portal-split..."
git subtree split --prefix="$PREFIX" -b portal-split

# Safety: ensure we did not push the full monorepo (subtree root must be portal-only)
ROOT_FILES=$(git ls-tree --name-only portal-split)
for bad in backend components pages projects-portal; do
  if echo "$ROOT_FILES" | grep -q "^${bad}$"; then
    echo "ERROR: portal-split root contains '$bad' — full repo was split, not just portal. Aborting push."
    git branch -D portal-split 2>/dev/null || true
    exit 1
  fi
done
echo "→ Verified: split branch root is portal-only."
echo ""

if [[ "$SPLIT_ONLY" == "true" ]]; then
  echo ""
  echo "Split done. To push (with GitHub auth):"
  echo "  git push $REMOTE portal-split:$BRANCH --force"
  echo "  git branch -D portal-split"
  exit 0
fi

# Warn if remote already has this commit (push would say "Everything up-to-date")
git fetch "$REMOTE" "$BRANCH" --quiet 2>/dev/null || true
REMOTE_SHA=$(git rev-parse "refs/remotes/$REMOTE/$BRANCH" 2>/dev/null || echo "")
OUR_SHA=$(git rev-parse portal-split)
if [[ -n "$REMOTE_SHA" && "$REMOTE_SHA" == "$OUR_SHA" ]]; then
  echo ""
  echo "*** NO NEW CHANGES TO PUSH ***"
  echo "portalgk2.0/main already has this code. Commit portal changes and run again, or trigger Netlify deploy manually."
  echo ""
fi

# Use Keychain for HTTPS auth (GitHub credentials from Keychain Access)
git config --global credential.helper osxkeychain 2>/dev/null || true
echo "→ Pushing portal-split to $REMOTE $BRANCH (--force for subtree history)..."
if ! git push "$REMOTE" portal-split:"$BRANCH" --force; then
  echo ""
  echo "PUSH FAILED (often due to GitHub auth in this environment)."
  echo "  1. Open Terminal.app or iTerm (not Cursor) and run:"
  echo "     cd $ROOT"
  echo "     ./scripts/push-portal-subtree.sh main"
  echo "  2. If HTTPS still fails, switch to SSH and retry:"
  echo "     git remote set-url portal git@github.com:KBPUBLISH/portalgk2.0.git"
  echo "     ./scripts/push-portal-subtree.sh main"
  echo "  Or push the existing split branch manually:"
  echo "     git push portal portal-split:$BRANCH --force"
  exit 1
fi

# OUR_SHA is the commit we just pushed (portal-split is still pointing at it)
COMMIT_URL="https://github.com/KBPUBLISH/portalgk2.0/commit/${OUR_SHA}"
git branch -D portal-split
echo ""
echo "Done. portalgk2.0 ($REMOTE) is updated."
echo ""
echo "Verify push: $COMMIT_URL"
echo "  (Open that URL; you should see the commit on main.)"
echo ""
echo "If Netlify did not start a deploy:"
echo "  → app.netlify.com → site (portal.godlykids.com) → Deploys → Trigger deploy → Deploy site"
echo "  If the build fails with 'Failed to prepare repo', fix the deploy key:"
echo "  → Site settings → Build & deploy → Repository → Manage deploy keys (give Read access to KBPUBLISH/portalgk2.0)"
echo ""
