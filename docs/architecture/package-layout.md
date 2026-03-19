# RiotPlan Split Package Layout (Step 6)

## Sibling Projects

- `../riotplan-core`: sibling project shell for `@kjerneverk/riotplan-core`
- `../riotplan-mcp-http`: sibling project shell for `@kjerneverk/riotplan-mcp-http`

Both projects currently define package boundaries while we
finish extraction.

## Build Wiring

- `vite.config.ts` now emits additional entry points:
  - `dist/core.js` + `dist/core.d.ts`
  - `dist/mcp-http.js` + `dist/mcp-http.d.ts`
- root `package.json` exports include:
  - `@kjerneverk/riotplan/core`
  - `@kjerneverk/riotplan/mcp-http`
- root package now models split packages as peer relationships:
  - `@kjerneverk/riotplan-core`
  - `@kjerneverk/riotplan-mcp-http`

## Dependency Direction

Expected direction is represented in package manifests:

- `@kjerneverk/riotplan-mcp-http` -> `@kjerneverk/riotplan-core`
- `@kjerneverk/riotplan-core` -> `@kjerneverk/riotplan-format`

No reverse dependency is declared.

## Compatibility

Legacy binaries remain unchanged:

- `riotplan`
- `riotplan-mcp-http`

The compatibility package (`@kjerneverk/riotplan`) remains the published entry
point until extraction is complete.
