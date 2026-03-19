# RiotPlan Format Ownership (SQLite-Only)

## Decision

`@kjerneverk/riotplan-format` is the authoritative owner of:

- SQLite schema shape and migrations
- provider lifecycle (`createSqliteProvider`)
- persisted plan file and step serialization rules

`@kjerneverk/riotplan-core` consumes this through `PlanStore` contracts and `SqlitePlanStore`.

## Non-Goals

- Introducing alternate storage engines during the split
- Supporting new persistence backends in this migration phase

## Integration Contract

- Core calls persistence through `PlanStore` interface.
- `SqlitePlanStore` is the only production adapter wired during this split.
- MCP and CLI layers must delegate persistence needs through core services/adapters.

## Enforcement Notes

- Keep `resolveSqlitePlanPath()` and existing SQLite guards in place for MCP paths.
- Any future persistence extension requires an explicit architecture decision and parity test plan.
