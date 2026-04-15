#!/usr/bin/env bash
# scripts/build.sh — Build, lint, and test the monorepo
#
# Usage:
#   ./scripts/build.sh          # full build + lint + test
#   ./scripts/build.sh --quick  # build only (skip lint and test)
#
# This is a thin wrapper around npm run precommit. It exists so that
# every workflow script lives in scripts/ and you never need to remember
# the right npm incantation.

set -euo pipefail
cd "$(dirname "$0")/.."

QUICK=false
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

echo "🔨 Building all packages..."
npm run build

if [ "$QUICK" = true ]; then
  echo "⚡ Quick mode — skipping lint and test"
  exit 0
fi

echo "🔍 Linting..."
npm run lint

echo "🧪 Testing..."
npm run test

echo "✅ Build complete"
