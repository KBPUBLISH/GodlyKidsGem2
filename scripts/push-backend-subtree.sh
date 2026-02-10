#!/bin/bash
# Push only the backend/ folder to the BackendGK2.0 repo (for Render deploy).
# Run from repo root: ./scripts/push-backend-subtree.sh
# Can take 1–2 minutes.

set -e
cd "$(git rev-parse --show-toplevel)"
echo "Pushing backend/ to remote 'backend' (BackendGK2.0)..."
git subtree push --prefix=backend backend main
echo "Done."
