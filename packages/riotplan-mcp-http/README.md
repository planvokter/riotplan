# @planvokter/riotplan-mcp-http

HTTP MCP server for RiotPlan.

This package is the network-facing surface of RiotPlan. It exposes every plan
operation as an MCP tool, resource, or prompt over HTTP using Hono and the
MCP SDK's `StreamableHTTPTransport`. Clients like Cursor, VS Code extensions,
and any MCP-compatible agent connect here.

## What lives here

### Server (`src/server-hono.ts`)

The Hono application that wires up MCP transport, session management, cloud
sync, RBAC authentication, plan download/upload routes, and the `/health`
endpoint. This is the main runtime entry point.

### Tools (`src/tools/`)

Every `riotplan_*` MCP tool definition. Each file exports a tool object with
a name, Zod schema, description, and execute function. Tools cover the full
plan lifecycle:

- **idea** -- create plans, add notes/constraints/questions/evidence/narrative
- **shaping** -- start shaping, add approaches, compare, select
- **build** -- prepare caller-side generation instructions from plan artifacts
- **build-write** -- validate and persist generated plan artifacts and steps
- **step** -- start, complete, add, remove, move steps
- **status** -- read plan status
- **transition** -- move between lifecycle stages
- **history** -- checkpoints and timeline
- **catalyst** -- manage catalyst associations
- **evidence** -- structured evidence writer
- **reflect** -- step reflections
- **retrospective** -- generate plan retrospectives
- **context** -- read plan context for LLM consumption
- **project** -- bind plans to projects, resolve project context
- **switch** -- list plans, switch active plan, rename, delete
- **generate** -- server-side AI plan generation (legacy)
- **validate** -- plan validation

### Resources (`src/resources/`)

MCP resource handlers for read-only access to plan data (plan metadata,
status, steps, individual step content, idea, shaping, evidence, timeline,
checkpoints, artifacts, prompts).

### Prompts (`src/prompts/`)

MCP prompt templates for guided workflows (create plan, explore idea, shape
approach, develop plan, execute step, execute plan, track progress, generate
retrospective).

### Session (`src/session/`)

Session management for multi-connection MCP server operation.

### Other

- **`rbac.ts`** -- role-based access control engine (API key auth, user/role
  lookup, route-level enforcement).
- **`bin-http.ts`** -- CLI entry point for starting the HTTP server.
- **`heartbeat.ts`** -- health/liveness utilities.
- **`types.ts`** -- MCP-specific type definitions (McpTool, ToolResult,
  ToolExecutionContext, resource types, prompt types).
- **`uri.ts`** -- `riotplan://` URI parser.

## Dependencies

| Package | Role |
|---|---|
| `@planvokter/riotplan` | Plan operations, types, AI artifact loading, config, status generation, step mutations, reflection writer, plan loader, plan categories |
| `@planvokter/riotplan-core` | Core service composition (lifecycle, status, idea, build helpers) -- used by a subset of tools |
| `@planvokter/riotplan-format` | SQLite provider for direct plan file/step/timeline access |

`@planvokter/riotplan` is a **runtime dependency** of this package (not a peer):
installing `@planvokter/riotplan-mcp-http` pulls the framework in automatically.
That dependency is currently broad — tools import from subpaths like
`@planvokter/riotplan/ai/artifacts` and `@planvokter/riotplan/config`. A future
goal is to narrow this so the MCP server depends only on well-defined service
interfaces rather than reaching into riotplan internals.

## Development

During development, use `npm link` to resolve sibling packages:

```bash
cd ../riotplan && npm link
cd ../riotplan-core && npm link
cd ../riotplan-mcp-http && npm link @planvokter/riotplan @planvokter/riotplan-core @planvokter/riotplan-format
```

## Status

Extraction in progress. Source code is real (copied from `riotplan/src/mcp/`
with imports rewritten to use package paths). The identical source still
exists in `riotplan/src/mcp/` and is tested through the `riotplan` test
suite. Standalone build, tests, and npm publishing are not yet configured.
