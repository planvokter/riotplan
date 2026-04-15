# RiotPlan monorepo

This repository is an **npm workspaces** monorepo for the `@planvokter/*` RiotPlan packages — a framework for long-lived, stateful AI workflows (plans). All 9 packages share a single version and are built, tested, and released together.

## Requirements

- **Node.js 24+** (required by Vite 7+)
- **npm 10+** (bundled with Node 24)
- **gh CLI** (for release workflow — creating PRs and GitHub releases)

## Layout

```
riotplan/
├── packages/
│   ├── riotplan-verify/      # Step verification and coverage checking
│   ├── riotplan-format/      # SQLite-based storage format (dual format support)
│   ├── riotplan-catalyst/    # Composable guidance packages for plan creation
│   ├── riotplan-cloud/       # Cloud runtime and GCS sync
│   ├── riotplan-templates/   # Starter templates for common plan types
│   ├── riotplan-core/        # Core domain services
│   ├── riotplan-ai/          # AI plan generation engine
│   ├── riotplan/             # CLI framework (main package)
│   └── riotplan-mcp-http/    # HTTP MCP server (top of dependency graph)
├── scripts/                  # Build and release scripts
│   ├── build.sh              # Build, lint, test
│   ├── release.sh            # Cut a release (working → main → tag → publish)
│   ├── dev.sh                # Start next dev cycle (bump to -dev version)
│   ├── switch.sh             # Switch between main and working branches
│   └── sync-internal-deps.mjs # Sync @planvokter/* dependency ranges
├── .github/workflows/
│   ├── ci.yml                # CI: build, lint, test + token measurement
│   ├── release.yml           # Publish to npm on v* tag push
│   └── deploy-docs.yml       # Manual deploy of docs to GitHub Pages
├── RELEASE.md                # Detailed release workflow documentation
└── package.json              # Root workspace config
```

## Quick Start

```bash
# Install dependencies (all workspaces)
npm ci

# Build all packages in dependency order
npm run build

# Run linting
npm run lint

# Run tests
npm run test

# Or do all three at once
npm run precommit
```

## Build System

### Build Order

Packages are built in four layers, respecting the dependency graph:

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

| Tool | Purpose |
|------|---------|
| **Vite 7+** | Builds each package (requires Node 24+) |
| **vite-plugin-dts** | Generates `.d.ts` TypeScript declaration files |
| **Vitest** | Test runner with v8 coverage |
| **ESLint** | Linting (per-package, not all packages have it) |

### Per-Package Structure

```
packages/riotplan-<name>/
├── src/           # TypeScript source
├── dist/          # Built output (gitignored)
├── tests/         # Vitest test files
├── package.json   # npm package config
├── tsconfig.json  # TypeScript config
└── vite.config.ts # Vite build config (most packages)
```

### Packages Without Vite

- **riotplan-core** — no `vite.config.ts`, no tests (pure TypeScript library)
- **riotplan-mcp-http** — no `vite.config.ts`, no tests (HTTP server entry point)

## Scripts

All workflow scripts live in `scripts/`. They have zero dependencies beyond standard CLI tools (bash, git, npm, node, gh).

### `scripts/build.sh` — Build, lint, test

```bash
./scripts/build.sh          # full: build + lint + test
./scripts/build.sh --quick  # build only (skip lint and test)
```

### `scripts/release.sh` — Cut a release

```bash
./scripts/release.sh              # patch: 1.1.4-dev.0 → 1.1.4
./scripts/release.sh minor        # minor: 1.1.4-dev.0 → 1.2.0
./scripts/release.sh major        # major: 1.1.4-dev.0 → 2.0.0
./scripts/release.sh 3.0.0        # explicit version
./scripts/release.sh --dry-run    # preview without making changes
```

Creates a PR to `main` (protected branch), merges it, tags, and pushes. GitHub Actions publishes to npm.

### `scripts/dev.sh` — Start next dev cycle

```bash
./scripts/dev.sh              # patch: 1.1.4 → 1.1.5-dev.0
./scripts/dev.sh minor        # minor: 1.1.4 → 1.2.0-dev.0
./scripts/dev.sh --dry-run    # preview
```

### `scripts/switch.sh` — Switch branches

```bash
./scripts/switch.sh main      # switch to main
./scripts/switch.sh working   # switch to working
./scripts/switch.sh           # toggle between main and working
```

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

- **`working`** — All development happens here. Dev versions (`X.Y.Z-dev.N`).
- **`main`** — Protected. Only receives changes via PR. Stable versions (`X.Y.Z`).

## Version Management

All 9 packages + the root `package.json` share the **same version number**. After any version bump, `sync-internal-deps.mjs` updates all `@planvokter/*` dependency ranges to match.

**Important:** `npm version -ws` only bumps workspace packages, NOT the root `package.json`. Both `release.sh` and `dev.sh` include an explicit step to bump the root version.

## GitHub Actions

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push to `main`/`working`; PRs to `main` | Build, lint, test + MCP token measurement |
| `release.yml` | Push `v*` tag | Verify versions, build, test, publish all 9 packages to npm with OIDC provenance |
| `deploy-docs.yml` | Manual (`workflow_dispatch`) | Build and deploy docs to GitHub Pages |

### npm Publishing

Publishing is handled entirely by GitHub Actions. No local `npm publish` needed.

1. Each `@planvokter/*` package on npmjs.com must have this repo configured as a **trusted publisher** (OIDC)
2. The `release.yml` workflow has `id-token: write` permission for OIDC
3. Packages are published in dependency order with `--provenance`
4. No `NPM_TOKEN` secret is required

### MCP Token Report

Every build generates `packages/riotplan-mcp-http/dist/mcp-token-report.json` — a measurement of the MCP server's token footprint. CI uploads this as an artifact (90-day retention on CI, 365-day on release).

## Typical Release Workflow

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

# 5. Start next dev cycle
./scripts/dev.sh                # bumps to next -dev version

# 6. Keep developing
```

## Full Documentation

- **[RELEASE.md](RELEASE.md)** — Detailed release workflow, troubleshooting, version management, npm setup, and migration notes from KodrDriv

## Sibling Repos

These repos live outside this monorepo under the `planvokter/` org:

- `riotplan-vscode` — VS Code extension
- `riotplan-osx` — Native macOS integration
- `riotplan-e2e` — End-to-end tests

## License

Apache-2.0
