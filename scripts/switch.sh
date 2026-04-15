#!/usr/bin/env bash
# scripts/switch.sh — Switch between main and working branches
#
# Usage:
#   ./scripts/switch.sh main      # switch to main
#   ./scripts/switch.sh working   # switch to working
#   ./scripts/switch.sh           # toggle between main and working
#
# Checks for uncommitted changes before switching and offers to stash.

set -euo pipefail
cd "$(dirname "$0")/.."

CURRENT=$(git branch --show-current)

if [ $# -eq 0 ]; then
  # Toggle
  if [ "$CURRENT" = "main" ]; then
    TARGET="working"
  elif [ "$CURRENT" = "working" ]; then
    TARGET="main"
  else
    echo "❌ Current branch is '$CURRENT', not main or working. Specify target explicitly."
    exit 1
  fi
else
  TARGET="$1"
fi

if [ "$TARGET" != "main" ] && [ "$TARGET" != "working" ]; then
  echo "❌ Only 'main' and 'working' branches are supported. Got: $TARGET"
  exit 1
fi

if [ "$CURRENT" = "$TARGET" ]; then
  echo "Already on $TARGET"
  exit 0
fi

# Check for dirty working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  Uncommitted changes detected:"
  git status --short
  echo ""
  read -p "Stash changes and continue? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git stash push -m "switch-to-$TARGET-$(date +%Y%m%d%H%M%S)"
  else
    echo "Aborting."
    exit 1
  fi
fi

echo "🔄 Switching to $TARGET..."
git checkout "$TARGET"
git pull --ff-only origin "$TARGET"

echo "✅ Now on $TARGET"
