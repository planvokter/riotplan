import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";
import { stepReflectTool } from "../../../src/mcp/tools/reflect.js";
import { readTimelineResource } from "../../../src/mcp/resources/timeline.js";
import type { ToolExecutionContext } from "../../../src/mcp/types.js";

describe("riotplan_step_reflect tool", () => {
    let testRoot: string;
    let context: ToolExecutionContext;

    beforeEach(async () => {
        testRoot = join(tmpdir(), `riotplan-reflect-tool-test-${Date.now()}`);
        await mkdir(testRoot, { recursive: true });
        context = { workingDirectory: testRoot };
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    it("writes reflection file and timeline event for directory plans", async () => {
        const planId = "dir-reflect-plan";
        const planPath = join(testRoot, planId);
        await mkdir(join(planPath, "plan"), { recursive: true });
        await writeFile(
            join(planPath, "plan", "01-first-step.md"),
            "# Step 01: First Step\n",
            "utf-8"
        );
        await writeFile(
            join(planPath, "STATUS.md"),
            `# Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | 🔄 IN PROGRESS |

## Step Progress

| Step | Name | Status | Started | Completed |
|------|------|--------|---------|-----------|
| 01 | First Step | ✅ | - | - |
`,
            "utf-8"
        );

        const result = await stepReflectTool.execute(
            {
                planId,
                step: 1,
                reflection: "Reflection for directory-backed plan.",
            },
            context
        );

        expect(result.success).toBe(true);
        const reflectionPath = join(planPath, "reflections", "01-reflection.md");
        const reflectionContent = await readFile(reflectionPath, "utf-8");
        expect(reflectionContent).toBe("Reflection for directory-backed plan.");

        const timeline = await readTimelineResource(planPath);
        const event = timeline.events.find((entry: any) => entry.type === "step_reflected");
        expect(event).toBeDefined();
        expect(event.data.step).toBe(1);
        expect(event.data.storage).toBe("directory");
        expect(event.data.reflection).toContain("directory-backed plan");
        expect(typeof event.data.timestamp).toBe("string");
    });

    it("persists reflections for SQLite plans and emits timeline events", async () => {
        const sqlitePath = join(testRoot, "sqlite-reflect.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(sqlitePath);
        await provider.initialize({
            id: "sqlite-reflect",
            uuid: "00000000-0000-4000-8000-000000000201",
            name: "SQLite Reflect",
            stage: "executing",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.addStep({
            number: 1,
            code: "first-step",
            title: "First Step",
            description: "First step",
            status: "completed",
            content: "# Step 01: First Step",
            startedAt: now,
            completedAt: now,
        });
        await provider.close();

        const result = await stepReflectTool.execute(
            {
                planId: sqlitePath,
                step: 1,
                reflection: "Reflection for SQLite-backed plan.",
            },
            context
        );

        expect(result.success).toBe(true);
        expect(result.data?.reflectionFile).toBe("reflections/01-reflection.md");

        const verify = createSqliteProvider(sqlitePath);
        const files = await verify.getFiles();
        await verify.close();
        expect(files.success).toBe(true);
        const reflectionArtifact = files.data?.find(
            (file) => file.filename === "reflections/01-reflection.md"
        );
        expect(reflectionArtifact).toBeDefined();
        expect(reflectionArtifact?.content).toBe("Reflection for SQLite-backed plan.");

        const timeline = await readTimelineResource(sqlitePath);
        const event = timeline.events.find((entry: any) => entry.type === "step_reflected");
        expect(event).toBeDefined();
        expect(event.data.step).toBe(1);
        expect(event.data.storage).toBe("sqlite");
        expect(event.data.reflection).toContain("SQLite-backed plan");
        expect(typeof event.data.timestamp).toBe("string");
    });

    it("does not return directory-only errors for SQLite plans", async () => {
        const sqlitePath = join(testRoot, "sqlite-not-complete.plan");
        const now = new Date().toISOString();
        const provider = createSqliteProvider(sqlitePath);
        await provider.initialize({
            id: "sqlite-not-complete",
            uuid: "00000000-0000-4000-8000-000000000202",
            name: "SQLite Not Complete",
            stage: "executing",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
        });
        await provider.addStep({
            number: 1,
            code: "first-step",
            title: "First Step",
            description: "First step",
            status: "in_progress",
            content: "# Step 01: First Step",
            startedAt: now,
        });
        await provider.close();

        const result = await stepReflectTool.execute(
            {
                planId: sqlitePath,
                step: 1,
                reflection: "Should not be accepted yet.",
            },
            context
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("step must be completed first");
        expect(result.error).not.toContain("not a directory");
    });
});
