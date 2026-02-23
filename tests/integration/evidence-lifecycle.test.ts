import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
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
        planPath = join(testRoot, planId);
        await mkdir(join(planPath, "evidence"), { recursive: true });
        await writeFile(join(planPath, "IDEA.md"), "# IDEA\n", "utf-8");
        context = { workingDirectory: testRoot };
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    it("create -> edit -> read -> delete -> list reflects changes", async () => {
        const created = await evidenceTool.execute(
            {
                action: "add",
                planId,
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
                planId,
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

        const read = await readEvidenceResource(planPath, basename(createdData.file));
        expect(read.file).toBe(basename(createdData.file));
        const parsed = JSON.parse(read.content) as Record<string, unknown>;
        expect(parsed.summary).toBe("Updated benchmark notes");
        expect(parsed.content).toBe("Updated benchmark content");
        expect(parsed.tags).toEqual(["perf", "benchmark"]);
        expect(read.record.referenceSources).toHaveLength(1);
        expect(read.record.referenceSources[0].type).toBe("url");

        const deleted = await evidenceTool.execute(
            {
                action: "delete",
                planId,
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
