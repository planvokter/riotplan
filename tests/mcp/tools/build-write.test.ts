import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
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

    it("writes top-level artifacts for sqlite plans", async () => {
        const planPath = join(testRoot, "sqlite-artifacts.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: "sqlite-artifacts",
            uuid: "00000000-0000-4000-8000-000000000100",
            name: "SQLite Artifacts",
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
        const verify = createSqliteProvider(planPath);
        const summary = await verify.getFile("summary", "SUMMARY.md");
        await verify.close();
        expect(summary.success).toBe(true);
        expect(summary.data?.content).toContain("Caller generated.");
    });

    it("writes steps and clears existing sqlite steps when requested", async () => {
        const planPath = join(testRoot, "sqlite-steps.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: "sqlite-steps",
            uuid: "00000000-0000-4000-8000-000000000102",
            name: "SQLite Steps",
            stage: "idea",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: "evidence",
            filename: "ref.md",
            content: "# ref\n",
            createdAt: now,
            updatedAt: now,
        });
        await provider.close();

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

        const verify = createSqliteProvider(planPath);
        const step1 = await verify.getStep(1);
        const step2 = await verify.getStep(2);
        await verify.close();
        expect(step1.success).toBe(true);
        expect(step1.data?.title).toContain("Fresh Step");
        expect(step2.success).toBe(true);
        expect(step2.data?.title).toContain("Second Step");
    });

    it("replaces an existing sqlite step when writing the same step number", async () => {
        const planPath = join(testRoot, "sqlite-step-replace.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: "sqlite-step-replace",
            uuid: "00000000-0000-4000-8000-000000000104",
            name: "SQLite Step Replace",
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
            steps: [{ number: 1, title: "Editable Step", provenance: { constraintsAddressed: [], evidenceUsed: [] } }],
        };
        const validation = await buildValidatePlanTool.execute({ planId: planPath, generatedPlan: validatedPlan }, context);
        expect(validation.success).toBe(true);
        const stamp = String(validation.data?.validationStamp);

        const firstWrite = await buildWriteStepTool.execute(
            {
                planId: planPath,
                step: 1,
                title: "Editable Step",
                content: "# Step 01: Editable Step\n\nv1",
                validationStamp: stamp,
                clearExisting: true,
            },
            context,
        );
        expect(firstWrite.success).toBe(true);

        const secondWrite = await buildWriteStepTool.execute(
            {
                planId: planPath,
                step: 1,
                title: "Editable Step Updated",
                content: "# Step 01: Editable Step Updated\n\nv2",
                validationStamp: stamp,
            },
            context,
        );
        expect(secondWrite.success).toBe(true);

        const verify = createSqliteProvider(planPath);
        const allSteps = await verify.getSteps();
        const step1 = await verify.getStep(1);
        await verify.close();

        expect(allSteps.success).toBe(true);
        expect(allSteps.data).toHaveLength(1);
        expect(step1.success).toBe(true);
        expect(step1.data?.title).toBe("Editable Step Updated");
        expect(step1.data?.content).toContain("v2");
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
        const planPath = join(testRoot, "no-stamp.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: "no-stamp",
            uuid: "00000000-0000-4000-8000-000000000103",
            name: "No Stamp",
            stage: "idea",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.close();

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

