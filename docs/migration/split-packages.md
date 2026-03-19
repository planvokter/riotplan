# RiotPlan Split Migration Guide

This migration keeps `@kjerneverk/riotplan` compatible while introducing split
package boundaries:

- `@kjerneverk/riotplan-core`
- `@kjerneverk/riotplan-mcp-http`
- `@kjerneverk/riotplan-format`

Current extraction stage uses sibling projects:

- `~/gitw/kjerneverk/riotplan-core`
- `~/gitw/kjerneverk/riotplan-mcp-http`

## Import Mapping

| Previous usage | Current compatible usage | Target split usage |
|---|---|---|
| `import {...} from "@kjerneverk/riotplan"` | unchanged | same until extraction complete |
| `import {...} from "@kjerneverk/riotplan/core"` | supported | move to `@kjerneverk/riotplan-core` when published |
| `import {...} from "@kjerneverk/riotplan/mcp-http"` | supported | move to `@kjerneverk/riotplan-mcp-http` when published |

## Binary Mapping

| Legacy binary | Status | Notes |
|---|---|---|
| `riotplan` | retained | compatibility binary remains active |
| `riotplan-mcp-http` | retained | HTTP MCP binary remains active |

## Compatibility Guarantees

- Existing top-level `@kjerneverk/riotplan` imports remain supported during
  split rollout.
- Existing binary command names are preserved.
- SQLite remains the only supported persistence backend in this migration.

## Deprecation Window (Planned)

- **Phase 1 (current):** split boundaries introduced, compatibility defaults on.
- **Phase 2:** publish split packages and add deprecation notices for legacy
  deep imports.
- **Phase 3:** remove deprecated legacy forwarding exports in next major
  release only after parity gates remain green for one full release cycle.
