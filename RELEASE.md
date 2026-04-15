# Release Workflow

This monorepo uses a simple, script-driven release workflow. No custom build tools required — just bash, git, npm, and `gh`.

## Philosophy

- **Scripts over frameworks.** Four shell scripts in `scripts/` handle everything. Read them, edit them, they're yours.
- **GitHub Actions publishes.** Pushing a `v*` tag triggers `release.yml`, which builds, tests, and publishes all 9 packages to npm with OIDC provenance. No local `npm publish` needed.
- **Working branch for development.** All work happens on `working`. Releases merge to `main` and tag there.
- **Versions move in concert.** All 9 packages share the same version number. Bump once, sync everywhere.

## Branch Model

```
working  ──── develop here ──── merge to main ──── tag vX.Y.Z ──── push tag
   │                                      │                            │
   │                                      │                            ▼
   │                                      │                     GitHub Actions
   │                                      │                     release.yml
   │                                      │                     publishes to npm
   │                                      │
   └──── back to working ──── bump to X.Y.Z+1-dev.0 ──── continue developing
```

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
2. Build, lint, test
3. Bump all 9 packages to the release version
4. Sync `@planvokter/*` dependency ranges
5. Commit the version bump
6. Merge `working` into `main`
7. Tag the merge commit (`vX.Y.Z`)
8. Push `main` + tag → **triggers `release.yml` on GitHub Actions**
9. Create a GitHub release via `gh`

### `scripts/dev.sh` — Start next dev cycle

```bash
./scripts/dev.sh              # patch: 1.1.4 → 1.1.5-dev.0
./scripts/dev.sh minor        # minor: 1.1.4 → 1.2.0-dev.0
./scripts/dev.sh --dry-run    # preview
```

Run this after `release.sh` to bump to the next `-dev` version and continue developing.

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
./scripts/release.sh            # bumps, merges, tags, pushes

# 4. Start next dev cycle
./scripts/dev.sh                # bumps to next -dev version

# 5. Keep developing
# ...
```

## GitHub Actions

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push to `main`, `working` | Build, lint, test |
| `release.yml` | Push `v*` tag | Verify versions, build, test, publish all packages to npm |
| `deploy-docs.yml` | Manual (`workflow_dispatch`) | Build and deploy docs to GitHub Pages |

The release workflow validates that:
- The tag version matches all `package.json` versions
- The version is stable semver (no `-dev` suffix)
- All 9 packages have the same version

Then it publishes in dependency order with OIDC provenance — no `NPM_TOKEN` secret needed.

## Package Publish Order

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
