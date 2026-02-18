#!/bin/bash
# One-shot: push projects-portal/ to portalgk2.0 so Netlify can deploy.
# Run from repo root IN YOUR TERMINAL (so Keychain works): ./scripts/push-portal-now.sh
# This script: stashes changes, switches to main, subtree split, force-push, restores.

set -e
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

REMOTE="portal"
BRANCH="main"
PREFIX="projects-portal"
SAVED_BRANCH=$(git branch --show-current)

echo "=========================================="
echo "Portal subtree push to portalgk2.0 (main)"
echo "=========================================="

# Stash if there are local changes so we can switch to main
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "→ Stashing local changes..."
  git stash push -m "push-portal-now $(date +%Y%m%d-%H%M%S)"
  STASHED=1
else
  STASHED=0
fi

echo "→ Switching to main..."
git checkout main

echo "→ Removing old portal-split branch if it exists..."
git branch -D portal-split 2>/dev/null || true

echo "→ Splitting subtree (prefix=$PREFIX)... (this takes 1–2 min)"
git subtree split --prefix="$PREFIX" -b portal-split

echo "→ Force-pushing to $REMOTE $BRANCH..."
if git push "$REMOTE" portal-split:"$BRANCH" --force; then
  echo ""
  echo "*** SUCCESS: Portal pushed to GitHub (portalgk2.0 main). ***"
  echo "If Netlify doesn’t deploy: Netlify Dashboard → your site → Trigger deploy / check branch is 'main'."
else
  echo ""
  echo "*** PUSH FAILED. Run this script in your own terminal so Keychain can supply GitHub credentials. ***"
  git branch -D portal-split 2>/dev/null || true
  git checkout "$SAVED_BRANCH"
  [ "$STASHED" = 1 ] && git stash pop
  exit 1
fi

echo "→ Cleaning up..."
git branch -D portal-split
git checkout "$SAVED_BRANCH"
[ "$STASHED" = 1 ] && git stash pop && echo "→ Restored your changes."

echo ""
echo "Done."
