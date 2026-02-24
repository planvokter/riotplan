import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";
import { evidenceTool } from "../../src/mcp/tools/evidence.js";
import { readEvidenceListResource, readEvidenceResource } from "../../src/mcp/resources/evidence.js";
import type { ToolExecutionContext } from "../../src/mcp/types.js";

describe("evidence lifecycle integration", () => {
    let testRoot: string;
    let planId: string;
    let planPath: string;
    let context: ToolExecutionContext;

    beforeEach(async () => {
        testRoot = join(tmpdir(), `riotplan-evidence-integration-${Date.now()}`);
        planId = "evidence-integration-plan";
        planPath = join(testRoot, `${planId}.plan`);
        await mkdir(testRoot, { recursive: true });
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: planId,
            uuid: "00000000-0000-4000-8000-000000000501",
            name: planId,
            stage: "idea",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.close();
        context = { workingDirectory: testRoot };
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    it("create -> edit -> read -> delete -> list reflects changes", async () => {
        const created = await evidenceTool.execute(
            {
                action: "add",
                planId: planPath,
                title: "Runtime benchmark",
                summary: "Initial benchmark notes",
                content: "Initial benchmark content",
                referenceSources: [{ type: "url", value: "https://example.com/bench" }],
            },
            context
        );
        expect(created.success).toBe(true);

        const createdData = created.data as { evidenceId: string; file: string };
        const edited = await evidenceTool.execute(
            {
                action: "edit",
                planId: planPath,
                evidenceRef: { evidenceId: createdData.evidenceId },
                patch: {
                    summary: "Updated benchmark notes",
                    content: "Updated benchmark content",
                    tags: ["perf", "benchmark"],
                },
            },
            context
        );
        expect(edited.success).toBe(true);

        const read = await readEvidenceResource(planPath, createdData.file);
        expect(read.file).toBe(createdData.file);
        const parsed = read.record as Record<string, unknown>;
        expect(parsed.summary).toBe("Updated benchmark notes");
        expect(parsed.content).toBe("Updated benchmark content");
        expect(parsed.tags).toEqual(["perf", "benchmark"]);
        expect(read.record.referenceSources).toHaveLength(1);
        expect(read.record.referenceSources[0].type).toBe("url");

        const deleted = await evidenceTool.execute(
            {
                action: "delete",
                planId: planPath,
                evidenceRef: { file: createdData.file },
                confirm: true,
            },
            context
        );
        expect(deleted.success).toBe(true);

        const listing = await readEvidenceListResource(planPath);
        expect(listing.count).toBe(0);
        expect(listing.evidence).toEqual([]);
    });
});
