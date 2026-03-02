#!/usr/bin/env node
import { readFile } from "node:fs/promises";

function percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function parseLog(content) {
    const latencies = [];
    const downloads = [];
    const lines = content.split("\n");
    for (const line of lines) {
        if (line.includes('"[tool] call.complete')) {
            const m = line.match(/"elapsedMs":(\d+)/);
            if (m) latencies.push(Number.parseInt(m[1], 10));
        }
        if (line.includes("cloud.plan.sync_down.complete")) {
            const m = line.match(/"downloadedCount":(\d+)/);
            if (m) downloads.push(Number.parseInt(m[1], 10));
        }
    }
    return { latencies, downloads };
}

function summarize(parsed) {
    const avg = parsed.latencies.length
        ? parsed.latencies.reduce((a, b) => a + b, 0) / parsed.latencies.length
        : 0;
    const avgDownloaded = parsed.downloads.length
        ? parsed.downloads.reduce((a, b) => a + b, 0) / parsed.downloads.length
        : 0;
    return {
        samples: parsed.latencies.length,
        avgMs: Number(avg.toFixed(2)),
        p50Ms: Number(percentile(parsed.latencies, 50).toFixed(2)),
        p95Ms: Number(percentile(parsed.latencies, 95).toFixed(2)),
        avgDownloadedCount: Number(avgDownloaded.toFixed(2)),
    };
}

async function main() {
    const baselinePath = process.env.RIOTPLAN_BENCH_BASELINE_LOG;
    const optimizedPath = process.env.RIOTPLAN_BENCH_OPTIMIZED_LOG;
    if (!baselinePath || !optimizedPath) {
        throw new Error(
            "Set RIOTPLAN_BENCH_BASELINE_LOG and RIOTPLAN_BENCH_OPTIMIZED_LOG before running comparison."
        );
    }

    const baseline = summarize(parseLog(await readFile(baselinePath, "utf8")));
    const optimized = summarize(parseLog(await readFile(optimizedPath, "utf8")));

    const latencyImprovementPct = baseline.p50Ms
        ? Number((((baseline.p50Ms - optimized.p50Ms) / baseline.p50Ms) * 100).toFixed(2))
        : 0;
    const downloadReductionPct = baseline.avgDownloadedCount
        ? Number(
              (
                  ((baseline.avgDownloadedCount - optimized.avgDownloadedCount) /
                      baseline.avgDownloadedCount) *
                  100
              ).toFixed(2)
          )
        : 0;

    console.log(
        JSON.stringify(
            {
                baseline,
                optimized,
                delta: {
                    p50LatencyImprovementPct: latencyImprovementPct,
                    avgDownloadReductionPct: downloadReductionPct,
                },
            },
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});

