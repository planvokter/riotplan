import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";

vi.mock("../../../src/mcp/tools/project-binding-shared.js", () => ({
    readProjectBinding: vi.fn(async () => ({ project: undefined })),
    resolveProjectContext: vi.fn(async () => ({ resolved: false })),
}));

import { buildPlan } from "../../../src/mcp/tools/build.js";

describe("buildPlan artifact loading", () => {
    let testRoot: string;

    beforeEach(async () => {
        testRoot = join(tmpdir(), `riotplan-build-test-${Date.now()}`);
        await mkdir(testRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    it("returns caller-side instructions for SQLite plan without writing artifacts", async () => {
        const sqlitePath = join(testRoot, "sqlite-plan.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(sqlitePath);
        await provider.initialize({
            id: "sqlite-plan",
            uuid: "00000000-0000-4000-8000-000000000001",
            name: "SQLite Plan",
            stage: "shaping",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: "idea",
            filename: "IDEA.md",
            content: `# Idea

## Problem

Plan build fails when reading SQLite idea artifacts.

## Constraints

- Must use SQLite

## Questions

- Is idea loaded from DB?
`,
            createdAt: now,
            updatedAt: now,
        });
        await provider.saveFile({
            type: "shaping",
            filename: "SHAPING.md",
            content: `# Shaping

**Selected Approach**: Database-first
**Reasoning**: Keep plan data in one file.

### Approach: Database-first
**Description**: Read and write from SQLite provider.
`,
            createdAt: now,
            updatedAt: now,
        });
        await provider.addEvidence({
            id: "ev-1",
            description: "SQLite reference",
            content: "Evidence content",
            createdAt: now,
        });
        await provider.addTimelineEvent({
            id: "evt-1",
            timestamp: now,
            type: "evidence_added",
            data: { description: "SQLite reference" },
        });
        await provider.close();

        const result = await buildPlan({ planId: sqlitePath }, { workingDirectory: testRoot });
        expect(result.planId).toBe(sqlitePath);
        expect(result.currentStage).toBe("shaping");
        expect(result.generationInstructions.systemPrompt.length).toBeGreaterThan(0);
        expect(result.generationInstructions.userPrompt).toContain("== PLAN NAME ==");
        expect(result.writeProtocol.requiredTools.artifact).toBe("riotplan_build_write_artifact");
        expect(result.writeProtocol.requiredTools.step).toBe("riotplan_build_write_step");
        expect(result.writeProtocol.requiredTools.validate).toBe("riotplan_build_validate_plan");
        expect(result.writeProtocol.requiredTools.transition).toBe("riotplan_transition");
        expect(result.writeProtocol.mode).toBe("sqlite");
        expect(result.contextCoverage.coverageCounts.evidence).toBe(1);
        expect(result.inclusionProof.promptSha256.length).toBe(64);
        expect(result.validationProtocol.preWriteGate.required).toBe(true);

        const verifyProvider = createSqliteProvider(sqlitePath);
        const summary = await verifyProvider.getFile("summary", "SUMMARY.md");
        await verifyProvider.close();
        expect(summary.success).toBe(true);
        expect(summary.data).toBeNull();
    });

    it("returns instructions for directory plans and does not create output files", async () => {
        const planPath = join(testRoot, "dir-plan");
        await mkdir(planPath, { recursive: true });
        await writeFile(
            join(planPath, "IDEA.md"),
            `# Idea

## Problem

Directory-based plan build.
`,
            "utf-8"
        );
        await writeFile(
            join(planPath, "LIFECYCLE.md"),
            `# Lifecycle

## Current Stage

**Stage**: \`idea\`
`,
            "utf-8"
        );

        const result = await buildPlan({ planId: planPath, steps: 6 }, { workingDirectory: testRoot });
        expect(result.currentStage).toBe("idea");
        expect(result.generationInstructions.expectedStepCount).toBe(6);
        expect(result.generationInstructions.userPrompt).toContain("Directory-based plan build.");
        expect(result.writeProtocol.mode).toBe("directory");
        expect(result.contextCoverage.includedArtifacts.some((item) => item.id === "idea" && item.present)).toBe(true);

        await expect(readFile(join(planPath, "SUMMARY.md"), "utf-8")).rejects.toThrow();
        await expect(readFile(join(planPath, "EXECUTION_PLAN.md"), "utf-8")).rejects.toThrow();
        await expect(readFile(join(planPath, "STATUS.md"), "utf-8")).rejects.toThrow();
    });

    it("returns diagnostic error when no idea artifact exists and no description provided", async () => {
        const sqlitePath = join(testRoot, "missing-idea.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(sqlitePath);
        await provider.initialize({
            id: "missing-idea",
            uuid: "00000000-0000-4000-8000-000000000002",
            name: "Missing Idea",
            stage: "shaping",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.close();

        await expect(
            buildPlan(
                { planId: sqlitePath },
                { workingDirectory: testRoot }
            )
        ).rejects.toThrow(/Idea artifact not found and no description provided\..*planId=.*missing-idea\.plan.*ideaArtifactFound=false.*detectedArtifacts=none/);
    });
});
