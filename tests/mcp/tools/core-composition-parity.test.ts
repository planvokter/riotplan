import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ToolExecutionContext } from "../../../src/mcp/types.js";
import { ideaTool } from "../../../src/mcp/tools/idea.js";
import { shapingTool } from "../../../src/mcp/tools/shaping.js";
import { stepTool } from "../../../src/mcp/tools/step.js";
import { statusTool } from "../../../src/mcp/tools/status.js";
import { transitionTool } from "../../../src/mcp/tools/transition.js";
import { buildTool } from "../../../src/mcp/tools/build.js";

describe("MCP core-composition parity", () => {
    let testRoot: string;
    let context: ToolExecutionContext;

    beforeEach(async () => {
        testRoot = join(tmpdir(), `riotplan-core-composition-test-${Date.now()}`);
        await mkdir(testRoot, { recursive: true });
        context = { workingDirectory: testRoot };
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    it("retains tool contracts while using core service composition", async () => {
        expect(ideaTool.name).toBe("riotplan_idea");
        expect(shapingTool.name).toBe("riotplan_shaping");
        expect(stepTool.name).toBe("riotplan_step");
        expect(statusTool.name).toBe("riotplan_status");
        expect(transitionTool.name).toBe("riotplan_transition");
        expect(buildTool.name).toBe("riotplan_build");
        expect(Object.keys(stepTool.schema)).toContain("action");
        expect(Object.keys(statusTool.schema)).toContain("planId");

        const created = await ideaTool.execute(
            {
                action: "create",
                code: "core-composition",
                description: "Smoke test for MCP composition parity",
            },
            context
        );
        expect(created.success).toBe(true);
        const planPath = created.data?.planPath as string;

        const transition1 = await transitionTool.execute(
            { planId: planPath, stage: "shaping", reason: "begin shaping" },
            context
        );
        expect(transition1.success).toBe(true);

        const build = await buildTool.execute(
            { planId: planPath, steps: 3 },
            context
        );
        expect(build.success).toBe(true);
        expect(build.data?.generationInstructions?.systemPrompt).toBeTruthy();

        const addStep = await stepTool.execute(
            { action: "add", planId: planPath, title: "Wire parity check step" },
            context
        );
        expect(addStep.success).toBe(true);

        const startStep = await stepTool.execute(
            { action: "start", planId: planPath, step: 1 },
            context
        );
        expect(startStep.success).toBe(true);

        const status = await statusTool.execute(
            { planId: planPath, verbose: true },
            context
        );
        expect(status.success).toBe(true);
        expect(status.data?.planId).toBe("core-composition");
        expect(Array.isArray(status.data?.steps)).toBe(true);

        const transition2 = await transitionTool.execute(
            { planId: planPath, stage: "executing", reason: "parity transition check" },
            context
        );
        expect(transition2.success).toBe(true);
    });
});
