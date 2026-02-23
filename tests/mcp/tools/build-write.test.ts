import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";
import {
    buildValidatePlanTool,
    buildWriteArtifactTool,
    buildWriteStepTool,
} from "../../../src/mcp/tools/build-write.js";
import type { ToolExecutionContext } from "../../../src/mcp/types.js";

describe("build write tools", () => {
    let testRoot: string;
    let context: ToolExecutionContext;

    beforeEach(async () => {
        testRoot = join(tmpdir(), `riotplan-build-write-test-${Date.now()}`);
        await mkdir(testRoot, { recursive: true });
        context = { workingDirectory: testRoot };
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    it("writes top-level artifacts for directory plans", async () => {
        const planPath = join(testRoot, "dir-plan");
        await mkdir(planPath, { recursive: true });
        await writeFile(join(planPath, "IDEA.md"), "# Idea\n", "utf-8");
        await writeFile(
            join(planPath, "LIFECYCLE.md"),
            "# Lifecycle\n\n## Current Stage\n\n**Stage**: `idea`\n",
            "utf-8",
        );

        const validatedPlan = {
            analysis: {
                constraintAnalysis: [],
                evidenceAnalysis: [],
                approachAnalysis: { selectedApproach: "", commitments: "", implementationStrategy: "" },
            },
            summary: "Summary",
            approach: "Approach",
            successCriteria: "Done",
            steps: [{ number: 1, title: "Step", provenance: { constraintsAddressed: [], evidenceUsed: [] } }],
        };
        const validation = await buildValidatePlanTool.execute({ planId: planPath, generatedPlan: validatedPlan }, context);
        expect(validation.success).toBe(true);
        const stamp = String(validation.data?.validationStamp);

        const result = await buildWriteArtifactTool.execute(
            {
                planId: planPath,
                type: "summary",
                content: "# Summary\n\nCaller generated.",
                validationStamp: stamp,
            },
            context,
        );

        expect(result.success).toBe(true);
        const summary = await readFile(join(planPath, "SUMMARY.md"), "utf-8");
        expect(summary).toContain("Caller generated.");
    });

    it("writes steps and clears existing directory steps when requested", async () => {
        const planPath = join(testRoot, "dir-steps-plan");
        const planDir = join(planPath, "plan");
        await mkdir(planDir, { recursive: true });
        await writeFile(
            join(planPath, "IDEA.md"),
            "# Idea\n\n## Constraints\n\n- Must keep this\n\n## Questions\n\n- Q?\n",
            "utf-8",
        );
        await writeFile(
            join(planPath, "LIFECYCLE.md"),
            "# Lifecycle\n\n## Current Stage\n\n**Stage**: `idea`\n",
            "utf-8",
        );
        await writeFile(join(planDir, "01-old-step.md"), "old", "utf-8");
        await mkdir(join(planPath, "evidence"), { recursive: true });
        await writeFile(join(planPath, "evidence", "ref.md"), "# ref\n", "utf-8");

        const validatedPlan = {
            analysis: {
                constraintAnalysis: [{ constraint: "Must keep this" }],
                evidenceAnalysis: [{ evidenceFile: "ref.md" }],
                approachAnalysis: { selectedApproach: "", commitments: "", implementationStrategy: "" },
            },
            summary: "Summary",
            approach: "Approach",
            successCriteria: "Done",
            steps: [
                {
                    number: 1,
                    title: "Fresh Step",
                    provenance: { constraintsAddressed: ["Must keep this"], evidenceUsed: ["ref.md"] },
                },
            ],
        };
        const validation = await buildValidatePlanTool.execute({ planId: planPath, generatedPlan: validatedPlan }, context);
        expect(validation.success).toBe(true);
        const stamp = String(validation.data?.validationStamp);

        const first = await buildWriteStepTool.execute(
            {
                planId: planPath,
                step: 1,
                title: "Fresh Step",
                content: "# Step 01: Fresh Step",
                validationStamp: stamp,
                clearExisting: true,
            },
            context,
        );
        expect(first.success).toBe(true);

        const second = await buildWriteStepTool.execute(
            {
                planId: planPath,
                step: 2,
                title: "Second Step",
                content: "# Step 02: Second Step",
                validationStamp: stamp,
            },
            context,
        );
        expect(second.success).toBe(true);

        const step1 = await readFile(join(planDir, "01-fresh-step.md"), "utf-8");
        const step2 = await readFile(join(planDir, "02-second-step.md"), "utf-8");
        expect(step1).toContain("Fresh Step");
        expect(step2).toContain("Second Step");
    });

    it("writes artifacts and steps for sqlite plans", async () => {
        const sqlitePath = join(testRoot, "sqlite-build-write.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(sqlitePath);
        await provider.initialize({
            id: "sqlite-build-write",
            uuid: "00000000-0000-4000-8000-000000000101",
            name: "SQLite Build Write",
            stage: "idea",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.close();

        const validatedPlan = {
            analysis: {
                constraintAnalysis: [],
                evidenceAnalysis: [],
                approachAnalysis: { selectedApproach: "", commitments: "", implementationStrategy: "" },
            },
            summary: "Summary",
            approach: "Approach",
            successCriteria: "Done",
            steps: [{ number: 1, title: "SQLite Step", provenance: { constraintsAddressed: [], evidenceUsed: [] } }],
        };
        const validation = await buildValidatePlanTool.execute({ planId: sqlitePath, generatedPlan: validatedPlan }, context);
        expect(validation.success).toBe(true);
        const stamp = String(validation.data?.validationStamp);

        const artifactResult = await buildWriteArtifactTool.execute(
            {
                planId: sqlitePath,
                type: "status",
                content: "# Status",
                validationStamp: stamp,
            },
            context,
        );
        expect(artifactResult.success).toBe(true);

        const stepResult = await buildWriteStepTool.execute(
            {
                planId: sqlitePath,
                step: 1,
                title: "SQLite Step",
                content: "# Step 01: SQLite Step",
                validationStamp: stamp,
                clearExisting: true,
            },
            context,
        );
        expect(stepResult.success).toBe(true);

        const verify = createSqliteProvider(sqlitePath);
        const statusFile = await verify.getFile("status", "STATUS.md");
        const step = await verify.getStep(1);
        await verify.close();
        expect(statusFile.success).toBe(true);
        expect(statusFile.data?.content).toContain("# Status");
        expect(step.success).toBe(true);
        expect(step.data?.title).toBe("SQLite Step");
    });

    it("fails writes when validationStamp is missing", async () => {
        const planPath = join(testRoot, "no-stamp-plan");
        await mkdir(planPath, { recursive: true });
        await writeFile(join(planPath, "IDEA.md"), "# Idea\n", "utf-8");

        const result = await buildWriteArtifactTool.execute(
            {
                planId: planPath,
                type: "summary",
                content: "# Summary",
                validationStamp: "missing-stamp",
            },
            context,
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain("validationStamp");
    });
});

