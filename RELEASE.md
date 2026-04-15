# Release Workflow

This monorepo uses a script-driven release workflow. No custom build tools required — just bash, git, npm, and `gh`.

## Philosophy

- **Scripts over frameworks.** Four shell scripts in `scripts/` handle everything. Read them, edit them, they're yours.
- **GitHub Actions publishes.** Pushing a `v*` tag triggers `release.yml`, which builds, tests, and publishes all 9 packages to npm with OIDC provenance. No local `npm publish` needed.
- **Working branch for development.** All work happens on `working`. Releases merge to `main` via PR (main is protected) and tag there.
- **Versions move in concert.** All 9 packages + the root `package.json` share the same version number. Bump once, sync everywhere.

## Branch Model

```
working  ──── develop here ──── PR to main ──── merge ──── tag vX.Y.Z ──── push tag
    │                                      │                              │
    │                                      │                              ▼
    │                                      │                       GitHub Actions
    │                                      │                       release.yml
    │                                      │                       publishes to npm
    │                                      │
    └──── back to working ──── bump to X.Y.Z+1-dev.0 ──── continue developing
```

> **Important:** The `main` branch is protected — all changes must go through a pull request. The release script creates a PR from `working` to `main` and merges it automatically (requires `gh` CLI).

## Scripts

### `scripts/build.sh` — Build, lint, test

```bash
./scripts/build.sh          # full: build + lint + test
./scripts/build.sh --quick  # build only
```

### `scripts/release.sh` — Cut a release

```bash
./scripts/release.sh              # patch: 1.1.4-dev.0 → 1.1.4
./scripts/release.sh minor        # minor: 1.1.4-dev.0 → 1.2.0
./scripts/release.sh major        # major: 1.1.4-dev.0 → 2.0.0
./scripts/release.sh 3.0.0        # explicit version
./scripts/release.sh --dry-run    # preview without making changes
```

What it does:
1. Verify clean working tree on `working` branch
2. Verify all packages have the same version
3. Build, lint, test
4. Bump all 9 workspace packages + root `package.json` to the release version
5. Sync `@planvokter/*` dependency ranges via `sync-internal-deps.mjs`
6. Commit the version bump
7. Push `working` and create a PR to `main` (via `gh` CLI)
8. Merge the PR
9. Fetch the merged `main`, tag it (`vX.Y.Z`)
10. Push the tag → **triggers `release.yml` on GitHub Actions**
11. Create a GitHub release via `gh`
12. Switch back to `working`

**If `gh` is not available**, the script prints manual instructions and exits. You'll need to:
1. Create a PR: https://github.com/planvokter/riotplan/compare/main...working
2. Merge it
3. Tag and push: `git checkout main && git pull && git tag vX.Y.Z && git push origin vX.Y.Z`
4. Switch back: `git checkout working`

### `scripts/dev.sh` — Start next dev cycle

```bash
./scripts/dev.sh              # patch: 1.1.4 → 1.1.5-dev.0
./scripts/dev.sh minor        # minor: 1.1.4 → 1.2.0-dev.0
./scripts/dev.sh --dry-run    # preview
```

Run this after `release.sh` to bump to the next `-dev` version and continue developing. Also bumps the root `package.json` and syncs internal deps.

### `scripts/switch.sh` — Switch branches

```bash
./scripts/switch.sh main      # switch to main
./scripts/switch.sh working   # switch to working
./scripts/switch.sh           # toggle between main and working
```

Checks for uncommitted changes and offers to stash before switching.

## Typical Workflow

```bash
# 1. Develop on working
git checkout working
# ... make changes, commit ...

# 2. Verify everything builds
./scripts/build.sh

# 3. Cut a release
./scripts/release.sh            # bumps, PRs, merges, tags, pushes

# 4. Wait for GitHub Actions to publish to npm
#    Check: https://github.com/planvokter/riotplan/actions
#    Or: npm view @planvokter/riotplan-core version

# 5. Start next dev cycle
./scripts/dev.sh                # bumps to next -dev version

# 6. Keep developing
# ...
```

## Build System

### Build Order

The monorepo uses a layered build. Packages are built in dependency order:

```
Layer 1 (leaves — no internal deps):
  riotplan-verify, riotplan-format, riotplan-catalyst, riotplan-cloud, riotplan-templates

Layer 2 (mid — depend on leaves):
  riotplan-core, riotplan-ai

Layer 3 (upper — depends on core + ai):
  riotplan (CLI)

Layer 4 (top — depends on everything):
  riotplan-mcp-http
```

This is defined in the root `package.json` scripts:
- `build:leaves` → verify, format, catalyst, cloud, templates
- `build:mid` → core, ai
- `build:upper` → riotplan (CLI)
- `build:top` → riotplan-mcp-http

### Build Toolchain

- **Vite 7+** — builds each package (requires Node 24+)
- **vite-plugin-dts** — generates `.d.ts` declaration files
- **Vitest** — test runner with v8 coverage
- **ESLint** — linting (per-package, not all packages have it)

### Key Files Per Package

Each package follows this structure:
```
packages/riotplan-<name>/
├── src/           # TypeScript source
├── dist/          # Built output (gitignored)
├── tests/         # Vitest test files
├── package.json   # npm package config
├── tsconfig.json  # TypeScript config
└── vite.config.ts # Vite build config
```

## GitHub Actions

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push to `main`, `working`; PRs to `main` | Build, lint, test + MCP token measurement |
| `release.yml` | Push `v*` tag | Verify versions, build, test, publish all packages to npm |
| `deploy-docs.yml` | Manual (`workflow_dispatch`) | Build and deploy docs to GitHub Pages |

### CI Workflow (`ci.yml`)

Runs on every push and PR. Two jobs:
1. **test** — `npm ci` → `npm run build` → `npm run lint` → `npm run test`
2. **measure-mcp-tokens** — Builds and uploads the MCP token report as a CI artifact (90-day retention)

### Release Workflow (`release.yml`)

Triggered by pushing a `v*` tag. Steps:
1. **Verify tag matches workspace versions** — The tag version must equal the root `package.json` version AND all 9 workspace package versions. This catches mismatches early.
2. **Verify stable semver** — Rejects `-dev` versions. Only `X.Y.Z` tags can publish.
3. **Build and test** — `npm ci` → `npm run build` → `npm run test`
4. **Upload token report** — Saves `mcp-token-report.json` as a CI artifact (365-day retention, tagged with version)
5. **Publish all workspaces** — Publishes in dependency order with `--provenance` (OIDC, no `NPM_TOKEN` needed)

### Package Publish Order

The dependency order (from `release.yml`):

1. `riotplan-verify` (leaf)
2. `riotplan-format` (leaf)
3. `riotplan-catalyst` (leaf)
4. `riotplan-cloud` (leaf)
5. `riotplan-templates` (leaf)
6. `riotplan-core` (depends on above)
7. `riotplan-ai` (depends on core)
8. `riotplan` (CLI, depends on core + ai)
9. `riotplan-mcp-http` (depends on all above)

## Version Management

### How Versions Work

- All 9 packages + root `package.json` share the **same version number**
- Dev versions: `X.Y.Z-dev.N` (e.g., `1.1.5-dev.0`)
- Release versions: `X.Y.Z` (e.g., `1.1.4`)
- The `-dev` suffix prevents accidental publishing — `release.yml` rejects non-stable versions

### `sync-internal-deps.mjs`

After any version bump, this script updates all `@planvokter/*` dependency ranges across all packages to match the root version. For example, if the root is `1.1.5-dev.0`, all internal deps become `^1.1.5-dev.0`.

This is critical because npm workspaces use symlinks for local development, but the published packages need correct version ranges to resolve from the registry.

### Root `package.json` Version

**Important:** `npm version -ws` only bumps workspace packages, NOT the root `package.json`. Both `release.sh` and `dev.sh` include an explicit step to bump the root version. If you skip this, the `release.yml` "Verify tag matches workspace versions" step will fail because the tag won't match the root version.

## npm Setup

### OIDC Trusted Publishing

Each `@planvokter/*` package on npmjs.com must be configured to trust this GitHub repo:

1. Go to npmjs.com → package settings → Trusted Publishers
2. Add: `planvokter/riotplan` with environment `""` (empty) and workflow `release.yml`

No `NPM_TOKEN` secret is needed — GitHub Actions authenticates via OIDC.

### Verifying Publication

After a release, verify all packages are on npm:

```bash
# Quick check
npm view @planvokter/riotplan-core version

# Full check (all 9 packages)
for pkg in riotplan-core riotplan-mcp-http riotplan riotplan-verify \
           riotplan-cloud riotplan-ai riotplan-catalyst riotplan-format \
           riotplan-templates; do
  echo "@planvokter/$pkg: $(npm view @planvokter/$pkg version)"
done
```

## Troubleshooting

### "Verify tag matches workspace versions" fails

The tag version must match ALL `package.json` versions (root + 9 workspaces). Common causes:
- Root `package.json` wasn't bumped (see "Root package.json Version" above)
- A previous PR merge resolved a version conflict incorrectly
- The tag was created on the wrong commit

Fix: Create a PR that sets all versions correctly, merge it, delete and re-create the tag.

### "Working tree is not clean"

Commit or stash your changes before running `release.sh`. The script requires a clean tree.

### "Must be on 'working' branch"

The release script only runs from `working`. Switch with `git checkout working` or `./scripts/switch.sh working`.

### `gh` CLI not found

Install it: https://cli.github.com/
Or follow the manual instructions the script prints.

### npm publish fails with 403

Check that the package on npmjs.com has this repo configured as a trusted publisher (OIDC). Also verify the `id-token: write` permission in `release.yml`.

### Stale `dev` dist-tag on npm

If an old prerelease version has the `dev` dist-tag, you can clean it up:
```bash
npm dist-tag rm @planvokter/riotplan-mcp-http dev
```

## Why Not KodrDriv?

KodrDriv was built to automate git workflows across this monorepo, but in practice:

- **Node 24 requirement** creates environment friction (Vite 7+ dependency)
- **AI-generated commit messages** add latency and sometimes need correction
- **MCP server integration** breaks when API keys aren't available in child processes
- **Custom config layer** means another thing to debug when something goes wrong
- **The actual workflow is simple** — bump versions, sync deps, merge, tag, push

The scripts in `scripts/` do the same job with zero dependencies beyond standard CLI tools. They're easy to read, easy to modify, and easy to debug.

## Migration Notes

If you previously used KodrDriv commands, here's the mapping:

| KodrDriv | Script |
|----------|--------|
| `kodrdriv precommit` | `./scripts/build.sh` |
| `kodrdriv publish` | `./scripts/release.sh` (local) + GitHub Actions (npm) |
| `kodrdriv development` | `./scripts/dev.sh` |
| `kodrdriv tree link` | `npm install` (workspace links are automatic) |
| `kodrdriv commit` | `git add -A && git commit -m "..."` |
| `kodrdriv pull` | `git pull --ff-only origin working` |

The `.kodrdriv/` config directory can be removed once you've fully migrated.
