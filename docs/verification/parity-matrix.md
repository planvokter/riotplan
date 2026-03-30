# RiotPlan Split Parity Matrix

This matrix tracks parity checks for the core/mcp-http split while preserving
`@planvokter/riotplan` compatibility.

## Matrix

| Area | Path | Verification | Result |
|---|---|---|---|
| Plan creation | CLI + MCP idea create | `riotplan_idea(action=create)` and status follow-up | Pass |
| Idea lifecycle | MCP idea actions | `add_note`, `add_constraint`, `add_question`, `add_evidence` | Pass |
| Shaping lifecycle | MCP shaping actions | `start`, `add_approach`, `compare`, `select` | Pass |
| Build workflow | MCP build tools | `riotplan_build` + build-write flow tests | Pass |
| Step execution | MCP + CLI | start/complete/add/remove/move parity tests | Pass |
| Status queries | MCP status tool | sqlite status snapshot via core composition service | Pass |
| SQLite compatibility | Existing `.plan` flows | read/write metadata/files/steps via provider-backed adapters | Pass |
| Legacy command names | binaries | `riotplan`, `riotplan-mcp-http` still exported | Pass |

## Validation Runs

- `npm run build` (riotplan) - pass
- `npm run test` (riotplan) - pass (latest run)
- `npx tsc --noEmit` (riotplan) - pass

## Notes

- One intermittent local test run failed with temporary-directory collision
  semantics (`ENOENT`/`ENOTEMPTY`) but a clean rerun passed without code
  changes, indicating a non-deterministic test harness issue rather than split
  behavior regression.
