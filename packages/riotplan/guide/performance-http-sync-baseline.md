# RiotPlan HTTP Sync Baseline

This baseline captures the pre-optimization behavior for repeated cloud-backed MCP calls.

## Reproduction Command Sequence

1. Start server (cloud mode enabled from config):
   - `PORT=3002 node ./dist/mcp-server-http.js --config-directory ~/gitw/tobrien`
2. Capture server logs for a repeated list workload.
3. Run baseline analyzer:
   - `RIOTPLAN_BENCH_LOG=/path/to/riotplan-http.log node ./scripts/benchmark-http-sync.mjs`

## Observed Baseline (From Runtime Logs)

- `riotplan_list_plans` request latency: typically ~16s-18s, with spikes >30s.
- Dominant sync phase:
  - `cloud.plan.sync_down.phase.download` ~15.8s-17.4s
- Typical counters:
  - `remoteListedCount`: ~114
  - `remoteIncludedCount`: ~105
  - `downloadedCount`: ~105
  - `context.remoteListedCount`: ~0

## Why This Baseline Matters

- Confirms bottleneck is sync/downloading unchanged files, not tool execution.
- Provides p50/p95 reference for validating incremental sync and coalescing changes.
