#!/usr/bin/env bash
# scripts/release.sh — Cut a release from working → main
#
# Usage:
#   ./scripts/release.sh              # patch bump (1.1.4-dev.0 → 1.1.4)
#   ./scripts/release.sh minor        # minor bump (1.1.4-dev.0 → 1.2.0)
#   ./scripts/release.sh major        # major bump (1.1.4-dev.0 → 2.0.0)
#   ./scripts/release.sh 3.0.0        # explicit version
#   ./scripts/release.sh --dry-run    # show what would happen without doing it
#
# What this does:
#   1. Verify we're on working branch with a clean tree
#   2. Build, lint, test
#   3. Bump all 9 packages to the release version (strip -dev suffix or bump)
#   4. Sync internal @planvokter/* dependency ranges
#   5. Commit the version bump
#   6. Merge working into main
#   7. Tag the merge commit (vX.Y.Z)
#   8. Push main + tag → triggers release.yml on GitHub Actions
#   9. Create a GitHub release via gh
#
# What this does NOT do:
#   - npm publish (GitHub Actions handles that via release.yml)
#   - Any AI-generated commit messages or release notes
#
# Prerequisites:
#   - gh CLI authenticated
#   - Clean working tree on working branch
#   - All packages at the same -dev version

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=false
BUMP_TYPE="patch"
EXPLICIT_VER=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    patch|minor|major) BUMP_TYPE="$arg" ;;
    [0-9]*) EXPLICIT_VER="$arg" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
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

# --- Pre-flight checks ---
echo "🔍 Pre-flight checks..."

CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "working" ]; then
  echo "❌ Must be on 'working' branch. Currently on: $CURRENT"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree is not clean. Commit or stash changes first."
  git status --short
  exit 1
fi

# Verify all packages have the same version
ROOT_VER=$(node -p "require('./package.json').version")
for f in packages/*/package.json; do
  PKG_VER=$(node -p "require('./$f').version")
  if [ "$PKG_VER" != "$ROOT_VER" ]; then
    echo "❌ Version mismatch: $f has $PKG_VER, root has $ROOT_VER"
    exit 1
  fi
done

# Verify we're on a dev version
if [[ ! "$ROOT_VER" =~ -dev\. ]]; then
  echo "⚠️  Current version $ROOT_VER is not a -dev version. Are you sure you want to release?"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "✅ All packages at version $ROOT_VER"

# --- Calculate release version ---
if [ -n "$EXPLICIT_VER" ]; then
  RELEASE_VER="$EXPLICIT_VER"
else
  # Strip -dev suffix to get the release version
  # e.g. 1.1.4-dev.0 → 1.1.4 (patch/default)
  #      1.1.4-dev.0 → 1.2.0 (minor)
  #      1.1.4-dev.0 → 2.0.0 (major)
  BASE_VER="${ROOT_VER%%-dev.*}"
  IFS='.' read -r MAJOR MINOR PATCH <<< "$BASE_VER"
  case "$BUMP_TYPE" in
    patch) RELEASE_VER="$MAJOR.$MINOR.$PATCH" ;;
    minor) RELEASE_VER="$MAJOR.$((MINOR + 1)).0" ;;
    major) RELEASE_VER="$((MAJOR + 1)).0.0" ;;
  esac
fi

echo ""
echo "📦 Release: $ROOT_VER → $RELEASE_VER"
echo ""

# --- Build and test ---
echo "🔨 Building and testing..."
if [ "$DRY_RUN" = false ]; then
  npm run build
  npm run lint
  npm run test
else
  echo "  [DRY RUN] npm run build && npm run lint && npm run test"
fi

# --- Bump versions ---
echo "📝 Bumping versions to $RELEASE_VER..."
run npm version "$RELEASE_VER" -ws --no-git-tag-version
run node scripts/sync-internal-deps.mjs
run npm install

# --- Commit ---
echo "💾 Committing version bump..."
run git add -A
run git commit -m "release: v$RELEASE_VER"

# --- Merge to main via PR (main branch is protected) ---
echo "🔀 Creating PR to merge working into main..."
run git push origin working

if [ "$DRY_RUN" = false ]; then
  if command -v gh &>/dev/null; then
    # Create PR from working to main
    PR_URL=$(gh pr create \
      --base main \
      --head working \
      --title "release: v$RELEASE_VER" \
      --body "Release v$RELEASE_VER — version bump from $ROOT_VER" \
      --json url -q '.url' 2>/dev/null || true)

    if [ -n "$PR_URL" ]; then
      echo "📋 PR created: $PR_URL"
      # Merge the PR
      gh pr merge "$PR_URL" --merge --delete-branch=false
      echo "✅ PR merged"
    else
      echo "⚠️  Could not create PR (may already exist). Merge manually."
    fi

    # Fetch the merged main and tag it
    git fetch origin main
    git checkout main
    git pull --ff-only origin main
  else
    echo "⚠️  gh CLI not found. Create and merge PR manually:"
    echo "   https://github.com/planvokter/riotplan/compare/main...working"
    echo ""
    echo "   After merging, run:"
    echo "     git checkout main && git pull origin main"
    echo "     git tag v$RELEASE_VER"
    echo "     git push origin v$RELEASE_VER"
    echo "     git checkout working"
    echo ""
    echo "   Stopping here. Complete the release manually."
    exit 0
  fi
else
  echo "  [DRY RUN] gh pr create --base main --head working --title release: v$RELEASE_VER"
  echo "  [DRY RUN] gh pr merge --merge"
  echo "  [DRY RUN] git fetch origin main && git checkout main && git pull --ff-only origin main"
fi

# --- Tag ---
echo "🏷️  Tagging v$RELEASE_VER..."
run git tag "v$RELEASE_VER"

# --- Push tag ---
echo "🚀 Pushing tag to origin..."
run git push origin "v$RELEASE_VER"

# --- Switch back to working ---
echo "🔄 Switching back to working..."
run git checkout working

# --- GitHub release ---
echo "📋 Creating GitHub release..."
if [ "$DRY_RUN" = false ]; then
  if command -v gh &>/dev/null; then
    # Generate release notes from commits since last tag
    PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
    if [ -n "$PREV_TAG" ]; then
      NOTES=$(git log "$PREV_TAG"..HEAD --pretty=format:"- %s" 2>/dev/null || echo "")
    else
      NOTES=$(git log --pretty=format:"- %s" -20)
    fi
    gh release create "v$RELEASE_VER" \
      --title "v$RELEASE_VER" \
      --notes "$NOTES" \
      --target main
    echo "✅ GitHub release created: v$RELEASE_VER"
  else
    echo "⚠️  gh CLI not found. Create release manually at:"
    echo "   https://github.com/planvokter/riotplan/releases/new?tag=v$RELEASE_VER"
  fi
else
  echo "  [DRY RUN] gh release create v$RELEASE_VER --title v$RELEASE_VER --target main"
fi

echo ""
echo "🎉 Release v$RELEASE_VER complete!"
echo "   GitHub Actions will publish to npm via release.yml"
echo "   Next: run ./scripts/dev.sh to start the next dev cycle"
