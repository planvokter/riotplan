import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile, access, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import {
    evidenceTool,
    inspectFilepathReference,
} from "../../../src/mcp/tools/evidence.js";
import { readEvidenceResource } from "../../../src/mcp/resources/evidence.js";
import type { ToolExecutionContext } from "../../../src/mcp/types.js";

describe("evidence MCP tools", () => {
    let testRoot: string;
    let planId: string;
    let planPath: string;
    let context: ToolExecutionContext;

    beforeEach(async () => {
        testRoot = join(tmpdir(), `riotplan-evidence-tools-test-${Date.now()}`);
        planId = "evidence-tools-plan";
        planPath = join(testRoot, planId);
        await mkdir(join(planPath, "evidence"), { recursive: true });
        await mkdir(join(planPath, ".history"), { recursive: true });
        await writeFile(join(planPath, "IDEA.md"), "# IDEA\n", "utf-8");

        context = { workingDirectory: testRoot };
    });

    afterEach(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    async function createEvidence() {
        const result = await evidenceTool.execute(
            {
                action: "add",
                planId,
                title: "Auth note",
                summary: "Initial auth findings",
                content: "Details about auth behavior.",
                tags: ["auth"],
                referenceSources: [{ type: "url", value: "https://example.com/auth" }],
            },
            context
        );
        expect(result.success).toBe(true);
        return result.data as { evidenceId: string; file: string };
    }

    it("creates evidence with filepath reference", async () => {
        const result = await evidenceTool.execute(
            {
                action: "add",
                planId,
                title: "Path evidence",
                summary: "Filepath reference summary",
                content: "Path evidence content.",
                referenceSources: [{ type: "filepath", value: "./src/index.ts" }],
            },
            context
        );
        expect(result.success).toBe(true);
        expect(result.data?.referenceSources?.[0].type).toBe("filepath");
        expect(result.data?.filepathDiagnostics?.[0].resolvedPath).toContain("src/index.ts");
    });

    it("creates evidence with url reference", async () => {
        const result = await evidenceTool.execute(
            {
                action: "add",
                planId,
                title: "URL evidence",
                summary: "URL reference summary",
                content: "URL evidence content.",
                referenceSources: [{ type: "url", value: "https://example.com/doc" }],
            },
            context
        );
        expect(result.success).toBe(true);
        expect(result.data?.referenceSources?.[0].type).toBe("url");
        expect(result.data?.referenceSources?.[0].value).toBe("https://example.com/doc");
    });

    it("creates evidence with mixed reference types", async () => {
        const result = await evidenceTool.execute(
            {
                action: "add",
                planId,
                title: "Mixed evidence",
                summary: "Mixed summary",
                content: "Mixed evidence content.",
                referenceSources: [
                    { type: "url", value: "https://example.com/a" },
                    { type: "filepath", value: "../other-repo/README.md" },
                    { type: "other", value: "call-notes-2026-02-23" },
                ],
            },
            context
        );
        expect(result.success).toBe(true);
        expect(result.data?.referenceSources).toHaveLength(3);
        expect(result.data?.referenceSources?.map((s: { type: string }) => s.type)).toEqual([
            "url",
            "filepath",
            "other",
        ]);
    });

    it("fails validation on invalid url reference", async () => {
        const result = await evidenceTool.execute(
            {
                action: "add",
                planId,
                title: "Invalid URL evidence",
                summary: "Invalid URL summary",
                content: "Invalid URL content.",
                referenceSources: [{ type: "url", value: "example.com/no-protocol" }],
            },
            context
        );
        expect(result.success).toBe(false);
    });

    it("edits evidence by evidenceId", async () => {
        const created = await createEvidence();

        const edited = await evidenceTool.execute(
            {
                action: "edit",
                planId,
                evidenceRef: { evidenceId: created.evidenceId },
                patch: { summary: "Updated summary", content: "Updated details." },
            },
            context
        );

        expect(edited.success).toBe(true);
        expect(edited.data?.evidenceId).toBe(created.evidenceId);

        const fileContent = await readFile(join(planPath, created.file), "utf-8");
        const parsed = JSON.parse(fileContent) as Record<string, unknown>;
        expect(parsed.summary).toBe("Updated summary");
        expect(parsed.content).toBe("Updated details.");
        expect(parsed.evidenceId).toBe(created.evidenceId);
        expect(parsed.createdAt).toBeTypeOf("string");
        expect(parsed.updatedAt).toBeTypeOf("string");
    });

    it("edits evidence by file", async () => {
        const created = await createEvidence();

        const edited = await evidenceTool.execute(
            {
                action: "edit",
                planId,
                evidenceRef: { file: created.file },
                patch: { summary: "Updated summary", title: "Auth note revised", tags: ["auth", "security"] },
            },
            context
        );

        expect(edited.success).toBe(true);

        const fileContent = await readFile(join(planPath, created.file), "utf-8");
        const parsed = JSON.parse(fileContent) as Record<string, unknown>;
        expect(parsed.summary).toBe("Updated summary");
        expect(parsed.title).toBe("Auth note revised");
        expect(parsed.tags).toEqual(["auth", "security"]);
    });

    it("supports partial patch updates for content/sources/referenceSources/tags", async () => {
        const created = await createEvidence();
        const edited = await evidenceTool.execute(
            {
                action: "edit",
                planId,
                evidenceRef: { evidenceId: created.evidenceId },
                patch: {
                    content: "Updated body content",
                    sources: ["https://example.com/new-source", "./docs/new-source.md"],
                    referenceSources: [
                        { type: "url", value: "https://example.com/new-source" },
                        { type: "filepath", value: "./docs/new-source.md" },
                    ],
                    tags: ["auth", "updated"],
                },
            },
            context
        );

        expect(edited.success).toBe(true);
        expect(edited.data?.referenceSources).toHaveLength(2);

        const fileContent = await readFile(join(planPath, created.file), "utf-8");
        const parsed = JSON.parse(fileContent) as Record<string, unknown>;
        expect(parsed.content).toBe("Updated body content");
        expect(parsed.sources).toEqual(["https://example.com/new-source", "./docs/new-source.md"]);
        expect(parsed.tags).toEqual(["auth", "updated"]);
    });

    it("returns structured validation error for invalid evidenceRef", async () => {
        const created = await createEvidence();
        const edited = await evidenceTool.execute(
            {
                action: "edit",
                planId,
                evidenceRef: { evidenceId: created.evidenceId, file: created.file },
                patch: { summary: "should fail" },
            },
            context
        );
        expect(edited.success).toBe(false);
        expect(edited.context?.errorType).toBe("validation_error");
        expect(edited.error).toContain("evidenceRef must include exactly one of evidenceId or file");
    });

    it("edits evidence replace referenceSources", async () => {
        const created = await createEvidence();
        const edited = await evidenceTool.execute(
            {
                action: "edit",
                planId,
                evidenceRef: { evidenceId: created.evidenceId },
                patch: {
                    referenceSources: [{ type: "filepath", value: "/tmp/input.md" }],
                },
            },
            context
        );
        expect(edited.success).toBe(true);
        expect(edited.data?.referenceSources).toHaveLength(1);
        expect(edited.data?.referenceSources?.[0].type).toBe("filepath");
    });

    it("edits evidence with append/removeById referenceSources modes", async () => {
        const created = await createEvidence();
        const initial = await readFile(join(planPath, created.file), "utf-8");
        const initialParsed = JSON.parse(initial) as { referenceSources: Array<{ id: string }> };
        const existingId = initialParsed.referenceSources[0].id;

        const appended = await evidenceTool.execute(
            {
                action: "edit",
                planId,
                evidenceRef: { evidenceId: created.evidenceId },
                patch: {
                    referenceSourcesMode: "append",
                    referenceSources: [{ type: "filepath", value: "./docs/guide.md" }],
                },
            },
            context
        );
        expect(appended.success).toBe(true);
        expect(appended.data?.referenceSources).toHaveLength(2);

        const removed = await evidenceTool.execute(
            {
                action: "edit",
                planId,
                evidenceRef: { evidenceId: created.evidenceId },
                patch: {
                    referenceSourcesMode: "removeById",
                    referenceSources: [{ id: existingId, type: "other", value: "placeholder" }],
                },
            },
            context
        );
        expect(removed.success).toBe(true);
        expect(removed.data?.referenceSources?.some((s: { id: string }) => s.id === existingId)).toBe(false);
    });

    it("rejects invalid edit patch", async () => {
        const created = await createEvidence();

        const edited = await evidenceTool.execute(
            {
                action: "edit",
                planId,
                evidenceRef: { evidenceId: created.evidenceId },
                patch: { tags: [""] },
            },
            context
        );

        expect(edited.success).toBe(false);
        expect(edited.context?.errorType).toBe("validation_error");
    });

    it("deletes evidence by evidenceId", async () => {
        const created = await createEvidence();

        const deleted = await evidenceTool.execute(
            {
                action: "delete",
                planId,
                evidenceRef: { evidenceId: created.evidenceId },
                confirm: true,
            },
            context
        );

        expect(deleted.success).toBe(true);
        await expect(access(join(planPath, created.file))).rejects.toBeDefined();
    });

    it("deletes evidence by file", async () => {
        const created = await createEvidence();

        const deleted = await evidenceTool.execute(
            {
                action: "delete",
                planId,
                evidenceRef: { file: basename(created.file) },
                confirm: true,
            },
            context
        );

        expect(deleted.success).toBe(true);
        await expect(access(join(planPath, created.file))).rejects.toBeDefined();
    });

    it("rejects delete when confirm=false", async () => {
        const created = await createEvidence();
        const deleted = await evidenceTool.execute(
            {
                action: "delete",
                planId,
                evidenceRef: { evidenceId: created.evidenceId },
                confirm: false,
            },
            context
        );

        expect(deleted.success).toBe(false);
        expect(deleted.context?.errorType).toBe("validation_error");
    });

    it("returns not_found for missing evidence delete", async () => {
        const deleted = await evidenceTool.execute(
            {
                action: "delete",
                planId,
                evidenceRef: { evidenceId: "ev_missing" },
                confirm: true,
            },
            context
        );

        expect(deleted.success).toBe(false);
        expect(deleted.context?.errorType).toBe("not_found");
    });

    it("reads legacy evidence with only sources and derives referenceSources", async () => {
        const legacyFile = join(planPath, "evidence", "legacy.json");
        await writeFile(
            legacyFile,
            JSON.stringify(
                {
                    format: "riotplan-evidence-v1",
                    planId,
                    evidenceId: "ev_legacy",
                    file: "evidence/legacy.json",
                    title: "Legacy",
                    summary: "Legacy summary",
                    content: "Legacy content",
                    sources: ["https://example.com/legacy", "./legacy/path.txt", "note: verbal source"],
                    tags: [],
                    createdAt: new Date().toISOString(),
                },
                null,
                2
            ),
            "utf-8"
        );

        const read = await readEvidenceResource(planPath, "legacy.json");
        expect(read.record.referenceSources).toHaveLength(3);
        expect(read.record.referenceSources[0].type).toBe("url");
        expect(read.record.referenceSources[1].type).toBe("filepath");
        expect(read.record.referenceSources[2].type).toBe("other");
    });

    it("filepath git detection helper handles inside/outside/missing", async () => {
        const repoRoot = join(testRoot, "mini-repo");
        await mkdir(join(repoRoot, ".git"), { recursive: true });
        await writeFile(join(repoRoot, "README.md"), "x", "utf-8");
        const inside = await inspectFilepathReference(
            { id: "ref_inside", type: "filepath", value: join(repoRoot, "README.md") },
            testRoot
        );
        expect(inside.exists).toBe(true);
        expect(inside.git.isGitRepo).toBe(true);
        expect(inside.git.repoRoot).toBe(repoRoot);

        const outsidePath = join(testRoot, "outside.txt");
        await writeFile(outsidePath, "x", "utf-8");
        const outside = await inspectFilepathReference(
            { id: "ref_outside", type: "filepath", value: outsidePath },
            testRoot
        );
        expect(outside.exists).toBe(true);
        expect(outside.git.isGitRepo).toBe(false);

        const missing = await inspectFilepathReference(
            { id: "ref_missing", type: "filepath", value: join(testRoot, "missing.txt") },
            testRoot
        );
        expect(missing.exists).toBe(false);
        expect(missing.git.isGitRepo).toBe(false);
    });

    it("rejects unsupported evidence action", async () => {
        const result = await evidenceTool.execute(
            {
                action: "archive",
                planId,
            },
            context
        );
        expect(result.success).toBe(false);
        expect(result.context?.errorType).toBe("validation_error");
    });
});
