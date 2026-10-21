#!/bin/bash
# Generate WebP assets for avatar shop parts (full + 160px thumbs).
# Run from repo root: ./scripts/optimize-avatar-images.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AVATARS="$ROOT/public/avatars"

if ! command -v cwebp >/dev/null 2>&1; then
  echo "ERROR: cwebp not found. Install with: brew install webp"
  exit 1
fi

process_dir() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  mkdir -p "$dir/thumbs"

  shopt -s nullglob
  for png in "$dir"/*.png; do
    local base
    base="$(basename "$png" .png)"
    local webp="$dir/${base}.webp"
    local thumb="$dir/thumbs/${base}.webp"

    cwebp -q 85 "$png" -o "$webp" >/dev/null
    cwebp -q 82 -resize 160 0 "$png" -o "$thumb" >/dev/null
    echo "  ${base}: $(du -h "$png" | cut -f1) png → $(du -h "$webp" | cut -f1) webp, thumb $(du -h "$thumb" | cut -f1)"
  done
  shopt -u nullglob
}

echo "Optimizing avatar PNGs → WebP (full + thumbs)…"
for sub in bodies hats heads wings-left wings-right feet; do
  if [ -d "$AVATARS/$sub" ]; then
    echo "→ $sub"
    process_dir "$AVATARS/$sub"
  fi
done
echo "Done."
