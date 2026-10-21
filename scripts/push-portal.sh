#!/bin/bash
# One script: subtree split + push portal to GitHub. Uses Keychain (HTTPS) or SSH.
# Run from repo root in Terminal: ./scripts/push-portal.sh
set -e
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Run this from inside GodlyKidsGem2 (e.g. cd ~/GodlyKidsGem2)."; exit 1; }
cd "$ROOT"

# Use Keychain for HTTPS auth
git config --global credential.helper osxkeychain 2>/dev/null || true

REMOTE="portal"
BRANCH="main"
PREFIX="projects-portal"

# Clean stale branch
git branch -D portal-split 2>/dev/null || true

echo "→ Splitting subtree (prefix=$PREFIX)... (1–2 min)"
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

echo "→ Pushing to $REMOTE ($BRANCH)..."
set +e
git push "$REMOTE" portal-split:"$BRANCH" --force
PUSH_OK=$?
set -e
if [ "$PUSH_OK" -eq 0 ]; then
    git branch -D portal-split
    echo ""
    echo "Done. portalgk2.0 updated. Netlify will deploy."
    exit 0
fi

# Push failed — try SSH (uses SSH key; often works when HTTPS auth fails)
echo ""
echo "HTTPS push failed. Trying SSH (uses your SSH key in Keychain)..."
git remote set-url portal git@github.com:KBPUBLISH/portalgk2.0.git
set +e
git push "$REMOTE" portal-split:"$BRANCH" --force
PUSH_OK=$?
set -e
git remote set-url portal https://github.com/KBPUBLISH/portalgk2.0.git
if [ "$PUSH_OK" -eq 0 ]; then
    git branch -D portal-split
    echo ""
    echo "Done. portalgk2.0 updated via SSH. Netlify will deploy."
    exit 0
fi

echo ""
echo "Push failed. Run in Terminal: ./scripts/push-portal.sh"
echo "If SSH failed: add SSH key to GitHub (Settings → SSH and GPG keys), then run again."
exit 1
