#!/bin/bash
# Push backend/ and projects-portal/ to their subtree remotes.
# Run from repo root: ./scripts/push-all-subtrees.sh [branch]
# Uses macOS keychain for GitHub auth when available.

set -e
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
BRANCH="${1:-main}"

echo "=== Pushing backend subtree to BackendGK2.0 ==="
"$ROOT/scripts/push-backend-subtree.sh" "$BRANCH"

echo ""
echo "=== Pushing portal subtree to portalgk2.0 ==="
"$ROOT/scripts/push-portal-subtree.sh" "$BRANCH"

echo ""
echo "Done. Both subtrees updated."
