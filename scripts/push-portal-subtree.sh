#!/bin/bash
# Push projects-portal/ to portalgk2.0 repo.
# Run from repo root: ./scripts/push-portal-subtree.sh
# Usage: ./scripts/push-portal-subtree.sh [branch]
#   branch defaults to main
# Usage (split only, no push): ./scripts/push-portal-subtree.sh --split-only [branch]
#   Then push from a machine with GitHub auth: git push portal portal-split:main

set -e
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

SPLIT_ONLY=false
if [[ "${1:-}" == "--split-only" ]]; then
  SPLIT_ONLY=true
  shift
fi

BRANCH="${1:-main}"
REMOTE="portal"
PREFIX="projects-portal"

echo "→ Splitting subtree (prefix=$PREFIX) into branch portal-split..."
git subtree split --prefix="$PREFIX" -b portal-split

if [[ "$SPLIT_ONLY" == "true" ]]; then
  echo ""
  echo "Split done. To push (with GitHub auth):"
  echo "  git push $REMOTE portal-split:$BRANCH"
  echo "  git branch -D portal-split"
  exit 0
fi

echo "→ Pushing portal-split to $REMOTE $BRANCH (force; subtree history differs from remote)..."
git push "$REMOTE" portal-split:"$BRANCH" --force

echo "→ Deleting local branch portal-split..."
git branch -D portal-split

echo ""
echo "Done. portalgk2.0 ($REMOTE) is updated."
