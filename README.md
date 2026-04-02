# RiotPlan monorepo

This repository is an **npm workspaces** root for the `@planvokter/*` RiotPlan packages. Library source for `@planvokter/riotplan` lives under `packages/riotplan/`.

## Layout

- `packages/riotplan` — main framework (`@planvokter/riotplan`)
- `packages/riotplan-verify`, `riotplan-format`, `riotplan-catalyst`, `riotplan-cloud`, `riotplan-templates` — leaf packages
- `packages/riotplan-core`, `riotplan-ai` — mid tier
- `packages/riotplan-mcp-http` — HTTP MCP server (top of build graph)

## Commands (from repo root)

```bash
npm ci
npm run build    # dependency-ordered: leaves → mid → upper → top
npm run lint
npm run test
npm run precommit
```

Sibling repos (`riotplan-vscode`, `riotplan-osx`, `riotplan-e2e`) stay outside this tree under `planvokter/`.
