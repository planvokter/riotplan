#!/usr/bin/env bash
# scripts/dev.sh — Start a new development cycle
#
# Usage:
#   ./scripts/dev.sh                # patch bump (1.1.4 → 1.1.5-dev.0)
#   ./scripts/dev.sh minor          # minor bump (1.1.4 → 1.2.0-dev.0)
#   ./scripts/dev.sh 2.0.0-dev.0    # explicit version
#   ./scripts/dev.sh --dry-run      # show what would happen
#
# What this does:
#   1. Verify we're on working branch
#   2. Bump all 9 packages to the next -dev version
#   3. Sync internal @planvokter/* dependency ranges
#   4. Commit and push to working
#
# Run this after ./scripts/release.sh to start developing the next version.

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=false
BUMP_TYPE="patch"
EXPLICIT_VER=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    patch|minor|major) BUMP_TYPE="$arg" ;;
    *) EXPLICIT_VER="$arg" ;;
  esac
done

# --- Helpers ---
run() {
  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY RUN] $*"
  else
    echo "  $ $*"
    "$@"
  fi
}

# --- Pre-flight ---
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "working" ]; then
  echo "❌ Must be on 'working' branch. Currently on: $CURRENT"
  exit 1
fi

ROOT_VER=$(node -p "require('./package.json').version")

# --- Calculate dev version ---
if [ -n "$EXPLICIT_VER" ]; then
  DEV_VER="$EXPLICIT_VER"
else
  # If current is a dev version, bump from the base
  BASE_VER="${ROOT_VER%%-dev.*}"
  IFS='.' read -r MAJOR MINOR PATCH <<< "$BASE_VER"
  case "$BUMP_TYPE" in
    patch) DEV_VER="$MAJOR.$MINOR.$((PATCH + 1))-dev.0" ;;
    minor) DEV_VER="$MAJOR.$((MINOR + 1)).0-dev.0" ;;
    major) DEV_VER="$((MAJOR + 1)).0.0-dev.0" ;;
  esac
fi

# Verify it's a dev version
if [[ ! "$DEV_VER" =~ -dev\. ]]; then
  echo "❌ Dev version must contain '-dev.'. Got: $DEV_VER"
  exit 1
fi

echo "🔧 Dev cycle: $ROOT_VER → $DEV_VER"

# --- Bump ---
run npm version "$DEV_VER" -ws --no-git-tag-version
# Also bump root package.json (npm version -ws skips it)
run node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.version='$DEV_VER'; fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n')"
run node scripts/sync-internal-deps.mjs
run npm install

# --- Commit and push ---
run git add -A
run git commit -m "chore: start dev cycle $DEV_VER"
run git push origin working

echo "✅ Now developing $DEV_VER on working"
