import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readdir, rm, stat, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";
import {
    ideaTool,
} from "../../../src/mcp/tools/idea.js";
import { statusTool } from "../../../src/mcp/tools/status.js";
import type { ToolExecutionContext } from "../../../src/mcp/types.js";

describe("riotplan_idea_create sqlite enforcement", () => {
    let testRoot: string;
    let context: ToolExecutionContext;

    beforeEach(async () => {
        testRoot = join(tmpdir(), `riotplan-idea-tool-test-${Date.now()}`);
        await mkdir(testRoot, { recursive: true });
        context = { workingDirectory: testRoot };
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    it("creates sqlite-backed idea plans and works with status/add-note", async () => {
        const code = "sqlite-idea-plan";
        const createResult = await ideaTool.execute(
            {
                action: "create",
                code,
                description: "Validate sqlite-native ideation plan creation.",
                ideaContent: "# IDEA\n\nSeed motivation from create payload.",
            },
            context
        );

        expect(createResult.success).toBe(true);
        expect(createResult.data?.storage).toBe("sqlite");
        expect(createResult.data?.planId).toBe(code);
        expect(createResult.data?.planPath).toContain(".plan");

        const planPath = createResult.data?.planPath as string;
        const planStats = await stat(planPath);
        expect(planStats.isFile()).toBe(true);

        const provider = createSqliteProvider(planPath);
        const metaResult = await provider.getMetadata();
        expect(metaResult.success).toBe(true);
        expect(metaResult.data?.id).toBe(code);
        expect(metaResult.data?.stage).toBe("idea");
        const ideaFileResult = await provider.getFile("idea", "IDEA.md");
        expect(ideaFileResult.success).toBe(true);
        expect(ideaFileResult.data?.content).toContain("Seed motivation from create payload.");

        const statusResult = await statusTool.execute({ planId: planPath }, context);
        expect(statusResult.success).toBe(true);
        expect(statusResult.data?.planId).toBe(code);

        const addNoteResult = await ideaTool.execute(
            { action: "add_note", planId: planPath, note: "This should work immediately." },
            context
        );
        expect(addNoteResult.success).toBe(true);

        const filesResult = await provider.getFiles();
        await provider.close();
        expect(filesResult.success).toBe(true);
        const ideaFile = filesResult.data?.find((file) => file.type === "idea");
        expect(ideaFile?.content).toContain("- This should work immediately.");

        await expect(access(join(testRoot, code))).rejects.toBeDefined();
    });

    it("fails with migration hint when a legacy directory with same code exists", async () => {
        const code = "legacy-collision";
        await mkdir(join(testRoot, code), { recursive: true });

        const createResult = await ideaTool.execute(
            {
                action: "create",
                code,
                description: "Should fail because legacy dir exists.",
            },
            context
        );

        expect(createResult.success).toBe(false);
        expect(createResult.error).toContain("Legacy directory plan conflict");
        expect(createResult.error).toContain("migrate");

        const rootFiles = await readdir(testRoot);
        expect(rootFiles.some((entry) => entry.endsWith(".plan"))).toBe(false);
    });
});
