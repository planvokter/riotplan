#!/usr/bin/env node

/**
 * Baseline analyzer for RiotPlan HTTP logs.
 * Parses elapsed call latencies and download stats from log lines.
 */
import { readFile } from "node:fs/promises";

const logFile = process.env.RIOTPLAN_BENCH_LOG;

function percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function main() {
    if (!logFile) {
        throw new Error(
            "Set RIOTPLAN_BENCH_LOG to a RiotPlan HTTP log file. Example: RIOTPLAN_BENCH_LOG=./riotplan-http.log node ./scripts/benchmark-http-sync.mjs"
        );
    }
    const content = await readFile(logFile, "utf8");
    const lines = content.split("\n");

    const latencies = [];
    const downloads = [];

    for (const line of lines) {
        if (line.includes("[tool] call.complete")) {
            const m = line.match(/"elapsedMs":(\d+)/);
            if (m) latencies.push(Number.parseInt(m[1], 10));
        }
        if (line.includes("[tool] cloud.plan.sync_down.complete")) {
            const m = line.match(/"downloadedCount":(\d+)/);
            if (m) downloads.push(Number.parseInt(m[1], 10));
        }
    }

    const totalMs = latencies.reduce((a, b) => a + b, 0);
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const min = latencies.length ? Math.min(...latencies) : 0;
    const max = latencies.length ? Math.max(...latencies) : 0;
    const avg = latencies.length ? totalMs / latencies.length : 0;
    const avgDownloaded = downloads.length
        ? downloads.reduce((a, b) => a + b, 0) / downloads.length
        : 0;

    console.log(JSON.stringify({
        logFile,
        samples: latencies.length,
        avgMs: Number(avg.toFixed(2)),
        p50Ms: Number(p50.toFixed(2)),
        p95Ms: Number(p95.toFixed(2)),
        minMs: Number(min.toFixed(2)),
        maxMs: Number(max.toFixed(2)),
        avgDownloadedCount: Number(avgDownloaded.toFixed(2)),
    }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});

