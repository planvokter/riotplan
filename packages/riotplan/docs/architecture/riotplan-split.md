# RiotPlan Split Architecture (Step 1)

## Goal

Define clear boundaries for a staged split into:

1. `@planvokter/riotplan-core`
2. `@planvokter/riotplan-mcp-http`
3. `@planvokter/riotplan-format`

This is a contract-first architecture record used to guide extraction.

## Boundary Definition

### Core (`@planvokter/riotplan-core`)

- Owns plan domain services (lifecycle, steps, status, shaping orchestration)
- Defines service contracts and persistence interfaces
- Must not depend on MCP transport/runtime modules
- Uses a persistence adapter interface implemented by format package bindings

### MCP HTTP (`@planvokter/riotplan-mcp-http`)

- Owns HTTP transport, MCP tool/resource/prompt registration, auth/session routing
- Delegates domain mutations and reads to core services
- Must not define domain behavior that belongs to core
- HTTP-only transport (no stdio reintroduction)

### Format (`@planvokter/riotplan-format`)

- Owns SQLite schema, provider lifecycle, and schema evolution
- Implements persistence responsibilities consumed through core interfaces
- Remains the only production persistence path for this split

## Dependency Direction

Allowed dependency direction:

`mcp-http` -> `core` -> `format`

Disallowed directions:

- `core` -> `mcp-http`
- `format` -> `core` or `mcp-http`
- direct `cli` -> `mcp/tools/*` coupling (to be removed in later steps)

## Compatibility Strategy

The current `@planvokter/riotplan` package remains as a compatibility layer during migration:

- preserve existing bin names (`riotplan`, `riotplan-mcp-http`)
- preserve major top-level exports while gradually forwarding to new package barrels
- add deprecation notes only after parity verification gates are green

## Legacy Compatibility Export List (Initial)

The following export groups are considered compatibility-critical:

- plan operations (`loadPlan`, `createPlan`, `validatePlan`)
- step/status operations (`startStep`, `completeStep`, `parseStatus`, `generateStatus`)
- CLI entry (`createProgram`)
- MCP server entry (`startServer` via MCP-facing barrel)
- verification APIs (`parseCriteria`, `checkCoverage`, `checkCompletion`)

This list is intentionally conservative and will be refined after parity tests.
