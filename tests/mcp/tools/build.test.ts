import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";

vi.mock("../../../src/mcp/tools/project-binding-shared.js", () => ({
    readProjectBinding: vi.fn(async () => ({ project: undefined })),
    resolveProjectContext: vi.fn(async () => ({ resolved: false })),
}));

import { buildPlan } from "../../../src/mcp/tools/build.js";
import { buildApplyTool } from "../../../src/mcp/tools/build-write.js";

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

    it("rejects directory plans for build", async () => {
        const planPath = join(testRoot, "dir-plan");
        await mkdir(planPath, { recursive: true });
        await expect(
            buildPlan({ planId: planPath, steps: 6 }, { workingDirectory: testRoot })
        ).rejects.toThrow(/Plan not found|Directory-based plans are no longer supported/);
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

describe("riotplan_build_apply", () => {
    let testRoot: string;

    beforeEach(async () => {
        testRoot = join(tmpdir(), `riotplan-build-apply-test-${Date.now()}`);
        await mkdir(testRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    async function createIdeaPlan(planPath: string): Promise<void> {
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: "apply-plan",
            uuid: "00000000-0000-4000-8000-000000000003",
            name: "Apply Plan",
            stage: "idea",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: "idea",
            filename: "IDEA.md",
            content: `# Idea

## Problem

Build should persist steps and artifacts when asked to build a plan.

## Constraints

- The build flow must prevent silent non-persistence: users must not reasonably conclude a plan was built when no artifacts/steps were written.
`,
            createdAt: now,
            updatedAt: now,
        });
        await provider.close();
    }

    function makeGeneratedPlan() {
        const constraint =
            "The build flow must prevent silent non-persistence: users must not reasonably conclude a plan was built when no artifacts/steps were written.";
        return {
            analysis: {
                constraintAnalysis: [
                    {
                        constraint,
                        understanding: "Build intent should produce persisted output.",
                        plannedApproach: "Use one-shot apply flow.",
                    },
                ],
            },
            summary: "Apply generated plan in one call.",
            approach: "Validate, write all artifacts/steps, transition to built.",
            successCriteria: "All artifacts and steps persist in one operation.",
            steps: [
                {
                    number: 1,
                    title: "Implement apply orchestration",
                    objective: "Create a one-shot apply path.",
                    background: "Split flow is error-prone.",
                    tasks: [{ id: "01.1", description: "Implement orchestration." }],
                    acceptanceCriteria: ["Validation is executed before writes."],
                    testing: "Unit tests for happy path.",
                    filesChanged: ["src/mcp/tools/build-write.ts"],
                    notes: "Single-call persistence.",
                    provenance: {
                        constraintsAddressed: [constraint],
                        evidenceUsed: [],
                        rationale: "Prevents silent non-persistence.",
                    },
                },
            ],
        };
    }

    it("applies generated plan by validating, writing outputs, and transitioning to built", async () => {
        const sqlitePath = join(testRoot, "apply-plan.plan");
        await createIdeaPlan(sqlitePath);

        const result = await buildApplyTool.execute(
            {
                planId: sqlitePath,
                generatedPlan: makeGeneratedPlan(),
            },
            { workingDirectory: testRoot }
        );
        expect(result.success).toBe(true);
        expect(result.data.applied).toBe(true);
        expect(result.data.stepsWritten).toBe(1);

        const provider = createSqliteProvider(sqlitePath);
        const summary = await provider.getFile("summary", "SUMMARY.md");
        const executionPlan = await provider.getFile("execution_plan", "EXECUTION_PLAN.md");
        const status = await provider.getFile("status", "STATUS.md");
        const provenance = await provider.getFile("provenance", "PROVENANCE.md");
        const steps = await provider.getSteps();
        const metadata = await provider.getMetadata();
        await provider.close();

        expect(summary.success).toBe(true);
        expect(summary.data?.content).toContain("Apply generated plan in one call.");
        expect(executionPlan.success).toBe(true);
        expect(status.success).toBe(true);
        expect(provenance.success).toBe(true);
        expect(steps.success).toBe(true);
        expect(steps.data?.length).toBe(1);
        expect(metadata.success).toBe(true);
        expect(metadata.data?.stage).toBe("built");
    });

    it("does not write outputs when validation fails", async () => {
        const sqlitePath = join(testRoot, "apply-fail.plan");
        await createIdeaPlan(sqlitePath);

        const result = await buildApplyTool.execute(
            {
                planId: sqlitePath,
                generatedPlan: {
                    summary: "missing required top-level fields",
                    steps: [],
                },
            },
            { workingDirectory: testRoot }
        );

        expect(result.success).toBe(false);

        const provider = createSqliteProvider(sqlitePath);
        const summary = await provider.getFile("summary", "SUMMARY.md");
        const metadata = await provider.getMetadata();
        await provider.close();

        expect(summary.success).toBe(true);
        expect(summary.data).toBeNull();
        expect(metadata.success).toBe(true);
        expect(metadata.data?.stage).toBe("idea");
    });
});
