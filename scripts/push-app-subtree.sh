#!/bin/bash
# =============================================================================
# Push main branch to Appgk2.0 (app remote) for app deploy.
# Run from anywhere: /path/to/GodlyKidsGem2/scripts/push-app-subtree.sh
# IMPORTANT: Run in Terminal.app (not Cursor) so Keychain can supply GitHub credentials.
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

TARGET_BRANCH="${1:-app2.0gk}"
SOURCE_BRANCH="${2:-main}"
REMOTE="app"

echo "Repo root: $ROOT"
echo ""

# 1) Ensure remote exists
if ! git remote get-url "$REMOTE" &>/dev/null; then
    echo "ERROR: Remote '$REMOTE' is not configured."
    echo "Add it with:"
    echo "  git remote add app https://github.com/KBPUBLISH/Appgk2.0.git"
    exit 1
fi
REMOTE_URL=$(git remote get-url "$REMOTE")
echo "→ Remote $REMOTE = $REMOTE_URL"
echo ""

# 2) Use macOS Keychain for GitHub credentials (HTTPS)
git config --global credential.helper osxkeychain 2>/dev/null || true

echo "→ Pushing $SOURCE_BRANCH to $REMOTE/$TARGET_BRANCH (using Keychain for GitHub credentials)..."
if ! git push "$REMOTE" "$SOURCE_BRANCH:$TARGET_BRANCH" --force; then
    echo ""
    echo "PUSH FAILED. Common causes:"
    echo "  • Run this script from Terminal.app (not Cursor/IDE) so Keychain can authenticate."
    echo "  • Ensure GitHub token is in Keychain: Keychain Access → search 'github'"
    echo "  • Or use SSH: git remote set-url app git@github.com:KBPUBLISH/Appgk2.0.git"
    exit 1
fi

echo ""
echo "Done. Appgk2.0 ($REMOTE) is updated."
echo ""
