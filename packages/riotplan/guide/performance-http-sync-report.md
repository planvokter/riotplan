# RiotPlan HTTP Sync Performance Report

## Scope

- Compared repeated `riotplan_list_plans` calls in cloud mode.
- Baseline behavior: full download-heavy sync on every read.
- Optimized behavior: manifest diff + coalescing + freshness TTL.

## Results (Observed Logs)

- Baseline repeated calls:
  - Typical request latency: ~16s-18s (p50 range from observed runs)
  - Download count per call: ~105 plan files
- Optimized repeated calls:
  - Typical request latency: ~0.4s-0.7s
  - Download count per call: 0 when remote unchanged

## Interpretation

- Repeated-read latency improvement is substantial (>90% in observed runs).
- Bandwidth usage drops to near-zero for unchanged-plan polling.
- Mutating operations still force refresh to preserve correctness.

## Reproduce

- Generate summaries from logs:
  - `RIOTPLAN_BENCH_LOG=/path/to/log node ./scripts/benchmark-http-sync.mjs`
- Compare before/after:
  - `RIOTPLAN_BENCH_BASELINE_LOG=/path/baseline.log RIOTPLAN_BENCH_OPTIMIZED_LOG=/path/optimized.log node ./scripts/benchmark-http-sync-compare.mjs`
