/**
 * MCP tools for structured evidence records
 */

import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { z } from "zod";
import { createSqliteProvider } from "@planvokter/riotplan-format";
import type { McpTool, ToolExecutionContext, ToolResult } from "../types.js";
import { formatTimestamp, resolveDirectory } from "./shared.js";
import { logEvent } from "./history.js";

const EVIDENCE_META_MARKER = "<!-- riotplan-evidence-record";

const ReferenceSourceTypeSchema = z.enum(["filepath", "url", "other"]);

const ReferenceSourceMetadataSchema = z.record(z.string(), z.unknown()).optional();

const ReferenceSourceSchema = z
    .object({
        id: z.string().min(1).optional().describe("Stable reference identifier"),
        type: ReferenceSourceTypeSchema.describe("Reference source type"),
        value: z.string().min(1).describe("Source value"),
        label: z.string().min(1).optional().describe("Human-readable source label"),
        metadata: ReferenceSourceMetadataSchema.describe("Optional source metadata"),
    })
    .strict()
    .superRefine((value, ctx) => {
        const rawValue = value.value.trim();
        if (!rawValue) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "referenceSources[].value must be non-empty",
                path: ["value"],
            });
            return;
        }

        if (value.type === "url") {
            let parsed: URL;
            try {
                parsed = new URL(rawValue);
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "referenceSources[].value must be a valid URL for type=url",
                    path: ["value"],
                });
                return;
            }
            if (!["http:", "https:"].includes(parsed.protocol)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "referenceSources[].value must use http or https for type=url",
                    path: ["value"],
                });
            }
            return;
        }

        if (value.type === "filepath" && /^https?:\/\//i.test(rawValue)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "referenceSources[].value cannot be a URL for type=filepath",
                path: ["value"],
            });
        }
    });

const AddEvidenceSchema = z.object({
    planId: z.string().min(1).describe("Plan identifier (required)"),
    title: z.string().min(1).describe("Short human-readable evidence title"),
    summary: z
        .string()
        .min(1)
        .describe("1-4 sentence summary of what was found"),
    content: z.string().min(1).describe("Full evidence note in markdown"),
    sources: z.array(z.string().min(1)).optional().describe("Paths/URLs/references used"),
    referenceSources: z.array(ReferenceSourceSchema).optional().describe("Structured evidence source references"),
    tags: z.array(z.string().min(1)).optional().describe("Evidence tags"),
    createdBy: z.string().optional().describe("Agent/user label"),
    idempotencyKey: z.string().optional().describe("Prevent duplicates on retries"),
});

const EvidenceRefByIdSchema = z
    .object({
        evidenceId: z.string().min(1).describe("Evidence identifier (ev_...)"),
    })
    .strict();

const EvidenceRefByFileSchema = z
    .object({
        file: z.string().min(1).describe("Evidence file path or filename"),
    })
    .strict();

const EvidenceRefSchema = z.union([EvidenceRefByIdSchema, EvidenceRefByFileSchema], {
    error: "evidenceRef must include exactly one of evidenceId or file",
});

function evidenceRefHasFile(
    evidenceRef: z.infer<typeof EvidenceRefSchema>
): evidenceRef is z.infer<typeof EvidenceRefByFileSchema> {
    return "file" in evidenceRef;
}

function evidenceRefHasId(
    evidenceRef: z.infer<typeof EvidenceRefSchema>
): evidenceRef is z.infer<typeof EvidenceRefByIdSchema> {
    return "evidenceId" in evidenceRef;
}

const EditEvidencePatchSchema = z
    .object({
        title: z.string().min(1).optional(),
        summary: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        tags: z.array(z.string().min(1)).optional(),
        sources: z.array(z.string().min(1)).optional(),
        referenceSources: z.array(ReferenceSourceSchema).optional(),
        referenceSourcesMode: z.enum(["replace", "append", "removeById"]).optional(),
        idempotencyKey: z.string().min(1).optional(),
    })
    .strict()
    .describe("Partial evidence patch payload");

const EditEvidenceSchema = z.object({
    planId: z.string().min(1).describe("Plan identifier (required)"),
    evidenceRef: EvidenceRefSchema.describe("Evidence selector"),
    patch: EditEvidencePatchSchema.describe("Evidence fields to update"),
});

const DeleteEvidenceSchema = z.object({
    planId: z.string().min(1).describe("Plan identifier (required)"),
    evidenceRef: EvidenceRefSchema.describe("Evidence selector"),
    confirm: z.literal(true).describe("Must be true to confirm destructive delete"),
});

const EvidenceActionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("add") }).extend(AddEvidenceSchema.shape),
    z.object({ action: z.literal("edit") }).extend(EditEvidenceSchema.shape),
    z.object({ action: z.literal("delete") }).extend(DeleteEvidenceSchema.shape),
]);

const EvidenceToolSchema = {
    action: z
        .enum(["add", "edit", "delete"])
        .describe("Evidence action to run: add, edit, or delete"),
    planId: z.string().min(1).optional().describe("Plan identifier (required for every action)"),
    title: z.string().min(1).optional().describe("Required for action=add"),
    summary: z.string().min(1).optional().describe("Required for action=add"),
    content: z.string().min(1).optional().describe("Required for action=add"),
    sources: z.array(z.string().min(1)).optional().describe("Optional sources for action=add"),
    referenceSources: z.array(ReferenceSourceSchema).optional().describe("Structured references"),
    tags: z.array(z.string().min(1)).optional().describe("Optional tags"),
    createdBy: z.string().optional().describe("Optional creator label for action=add"),
    idempotencyKey: z.string().optional().describe("Optional idempotency key"),
    evidenceRef: EvidenceRefSchema.optional().describe("Required for actions edit/delete"),
    patch: EditEvidencePatchSchema.optional().describe("Required for action=edit"),
    confirm: z.literal(true).optional().describe("Required for action=delete"),
} satisfies z.ZodRawShape;

interface NormalizedEvidenceRecord {
    format: "riotplan-evidence-v1";
    planId: string;
    evidenceId: string;
    file: string;
    title: string;
    summary: string;
    content: string;
    sources: string[];
    referenceSources: ReferenceSource[];
    tags: string[];
    createdBy?: string;
    idempotencyKey?: string;
    createdAt: string;
    updatedAt?: string;
}

interface ReferenceSource {
    id: string;
    type: "filepath" | "url" | "other";
    value: string;
    label?: string;
    metadata?: Record<string, unknown>;
}

interface FilepathReferenceDiagnostic {
    referenceId: string;
    value: string;
    resolvedPath: string;
    exists: boolean;
    isDirectory: boolean;
    git: {
        isGitRepo: boolean;
        repoRoot?: string;
    };
}

interface BetterSqliteDatabase {
    prepare: (sql: string) => {
        get: (...params: unknown[]) => unknown;
        run: (...params: unknown[]) => { changes: number };
    };
    close: () => void;
}

interface AddEvidenceSuccess {
    ok: true;
    planId: string;
    evidenceId: string;
    file: string;
    createdAt: string;
    created?: boolean;
    referenceSources?: ReferenceSource[];
    filepathDiagnostics?: FilepathReferenceDiagnostic[];
    warnings?: string[];
}

interface EditEvidenceSuccess {
    success: true;
    planId: string;
    evidenceId: string;
    file: string;
    updatedAt: string;
    referenceSources?: ReferenceSource[];
    filepathDiagnostics?: FilepathReferenceDiagnostic[];
    warnings?: string[];
}

interface DeleteEvidenceSuccess {
    success: true;
    planId: string;
    evidenceId: string;
    file: string;
    deletedAt: string;
}

type ErrorCode = "validation_error" | "not_found" | "forbidden";

class EvidenceToolError extends Error {
    constructor(
        public readonly code: ErrorCode,
        message: string
    ) {
        super(message);
        this.name = "EvidenceToolError";
    }
}

function ensureObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function looksLikeUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return ["http:", "https:"].includes(parsed.protocol);
    } catch {
        return false;
    }
}

function looksLikeFilePath(value: string): boolean {
    if (!value) return false;
    if (isAbsolute(value)) return true;
    if (value.startsWith("./") || value.startsWith("../") || value.startsWith("~/")) return true;
    if (value.includes("/") || value.includes("\\")) return true;
    if (/^[a-zA-Z]:[\\/]/.test(value)) return true;
    if (value.startsWith("evidence/")) return true;
    return false;
}

function stableReferenceSourceId(type: string, value: string): string {
    const digest = createHash("sha1").update(`${type}:${value}`).digest("hex").slice(0, 12);
    return `ref_${digest}`;
}

function inferReferenceSourceType(value: string): "filepath" | "url" | "other" {
    if (looksLikeUrl(value)) return "url";
    if (looksLikeFilePath(value)) return "filepath";
    return "other";
}

function normalizeReferenceSources(
    referenceSources: unknown,
    sources: string[]
): { referenceSources: ReferenceSource[]; warnings: string[] } {
    const warnings: string[] = [];
    const inputSources = Array.isArray(sources) ? sources.map((v) => String(v).trim()).filter(Boolean) : [];

    const parsed = referenceSources
        ? z.array(ReferenceSourceSchema).safeParse(referenceSources)
        : { success: false as const };
    if (parsed.success) {
        const normalized = parsed.data.map((source) => {
            const value = source.value.trim();
            const id = source.id?.trim() || stableReferenceSourceId(source.type, value);
            return {
                id,
                type: source.type,
                value,
                label: source.label?.trim() || undefined,
                metadata: source.metadata,
            } satisfies ReferenceSource;
        });
        return { referenceSources: normalized, warnings };
    }

    if (referenceSources !== undefined) {
        warnings.push("Invalid referenceSources detected; falling back to sources[] best-effort derivation.");
    }

    const derived = inputSources.map((value) => {
        const type = inferReferenceSourceType(value);
        return {
            id: stableReferenceSourceId(type, value),
            type,
            value,
        } satisfies ReferenceSource;
    });
    return { referenceSources: derived, warnings };
}

function mirrorSourcesFromReferences(referenceSources: ReferenceSource[]): string[] {
    return referenceSources.map((source) => source.value);
}

async function findGitRepoRoot(startPath: string): Promise<string | null> {
    let current = resolve(startPath);
    while (true) {
        const gitPath = join(current, ".git");
        try {
            await access(gitPath);
            return current;
        } catch {
            // keep walking up
        }
        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

export async function inspectFilepathReference(
    source: ReferenceSource,
    baseDirectory: string
): Promise<FilepathReferenceDiagnostic> {
    const resolvedPath = isAbsolute(source.value) ? source.value : resolve(baseDirectory, source.value);
    try {
        const stats = await stat(resolvedPath);
        const repoRoot = await findGitRepoRoot(stats.isDirectory() ? resolvedPath : dirname(resolvedPath));
        return {
            referenceId: source.id,
            value: source.value,
            resolvedPath,
            exists: true,
            isDirectory: stats.isDirectory(),
            git: repoRoot
                ? { isGitRepo: true, repoRoot }
                : { isGitRepo: false },
        };
    } catch {
        const repoRoot = await findGitRepoRoot(dirname(resolvedPath));
        return {
            referenceId: source.id,
            value: source.value,
            resolvedPath,
            exists: false,
            isDirectory: false,
            git: repoRoot
                ? { isGitRepo: true, repoRoot }
                : { isGitRepo: false },
        };
    }
}

async function buildFilepathDiagnostics(
    referenceSources: ReferenceSource[],
    baseDirectory: string
): Promise<FilepathReferenceDiagnostic[]> {
    const filepathSources = referenceSources.filter((source) => source.type === "filepath");
    const diagnostics: FilepathReferenceDiagnostic[] = [];
    for (const source of filepathSources) {
        try {
            diagnostics.push(await inspectFilepathReference(source, baseDirectory));
        } catch {
            diagnostics.push({
                referenceId: source.id,
                value: source.value,
                resolvedPath: isAbsolute(source.value) ? source.value : resolve(baseDirectory, source.value),
                exists: false,
                isDirectory: false,
                git: { isGitRepo: false },
            });
        }
    }
    return diagnostics;
}

async function openSqliteDatabase(planPath: string): Promise<BetterSqliteDatabase> {
    const module = await import("better-sqlite3");
    const DatabaseCtor = module.default as unknown as new (
        path: string,
        options?: { fileMustExist?: boolean }
    ) => BetterSqliteDatabase;
    return new DatabaseCtor(planPath, { fileMustExist: true });
}

function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "evidence";
}

function firstUrl(sources: string[]): string | undefined {
    return sources.find((source) => /^https?:\/\//i.test(source));
}

function buildEvidenceId(): string {
    return `ev_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function buildEvidenceFile(createdAt: string, title: string, evidenceId: string): string {
    const datePart = createdAt.slice(0, 10);
    const shortId = evidenceId.replace(/^ev_/, "").slice(0, 8);
    return `evidence/${datePart}-${slugify(title)}-${shortId}.json`;
}

function buildMarkdown(record: NormalizedEvidenceRecord): string {
    const lines: string[] = [
        `${EVIDENCE_META_MARKER}`,
        JSON.stringify(record, null, 2),
        "-->",
        `# ${record.title}`,
        "",
        `**Evidence ID**: \`${record.evidenceId}\``,
        `**Created At**: ${record.createdAt}`,
    ];

    if (record.createdBy) {
        lines.push(`**Created By**: ${record.createdBy}`);
    }
    if (record.tags.length > 0) {
        lines.push(`**Tags**: ${record.tags.join(", ")}`);
    }
    if (record.idempotencyKey) {
        lines.push(`**Idempotency Key**: \`${record.idempotencyKey}\``);
    }
    if (record.updatedAt) {
        lines.push(`**Updated At**: ${record.updatedAt}`);
    }

    lines.push("", "## Summary", "", record.summary, "", "## Evidence", "", record.content);

    if (record.sources.length > 0) {
        lines.push("", "## Sources", "", ...record.sources.map((source) => `- ${source}`));
    }

    return `${lines.join("\n")}\n`;
}

function parseEmbeddedRecord(content: string): Partial<NormalizedEvidenceRecord> | null {
    const markerIndex = content.indexOf(EVIDENCE_META_MARKER);
    if (markerIndex === -1) {
        return null;
    }
    const afterMarker = content.slice(markerIndex + EVIDENCE_META_MARKER.length);
    const endIndex = afterMarker.indexOf("-->");
    if (endIndex === -1) {
        return null;
    }
    const raw = afterMarker.slice(0, endIndex).trim();
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as Partial<NormalizedEvidenceRecord>;
    } catch {
        return null;
    }
}

function parseMarkdownSections(content: string): {
    title?: string;
    summary?: string;
    evidence?: string;
    sources?: string[];
} {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const summaryMatch = content.match(/^##\s+Summary\s*\n+([\s\S]*?)\n+##\s+Evidence/m);
    const evidenceMatch = content.match(/^##\s+Evidence\s*\n+([\s\S]*?)(?:\n+##\s+Sources|\s*$)/m);
    const sourcesMatch = content.match(/^##\s+Sources\s*\n+([\s\S]*)$/m);

    let sources: string[] | undefined;
    if (sourcesMatch?.[1]) {
        sources = sourcesMatch[1]
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("- "))
            .map((line) => line.slice(2).trim())
            .filter(Boolean);
    }

    return {
        title: titleMatch?.[1]?.trim(),
        summary: summaryMatch?.[1]?.trim(),
        evidence: evidenceMatch?.[1]?.trim(),
        sources,
    };
}

function normalizeRecord(
    input: Partial<NormalizedEvidenceRecord> & Record<string, unknown>,
    fallback: {
        planId: string;
        file: string;
        evidenceId?: string;
        createdAt?: string;
    }
): (NormalizedEvidenceRecord & { warnings?: string[] }) | null {
    const evidenceId = String(input.evidenceId || input.id || fallback.evidenceId || "").trim();
    const title = String(input.title || input.description || "").trim();
    const summary = String(input.summary || "").trim();
    const content = String(input.content || "").trim();

    if (!evidenceId || !title || !summary || !content) {
        return null;
    }

    const sources = Array.isArray(input.sources)
        ? input.sources.map((value) => String(value).trim()).filter(Boolean)
        : typeof input.source === "string"
            ? input.source
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : [];
    const normalizedReferences = normalizeReferenceSources(input.referenceSources, sources);
    const mirroredSources = mirrorSourcesFromReferences(normalizedReferences.referenceSources);

    const tags = Array.isArray(input.tags)
        ? input.tags.map((value) => String(value).trim()).filter(Boolean)
        : [];

    const createdBy =
        typeof input.createdBy === "string" && input.createdBy.trim() ? input.createdBy.trim() : undefined;
    const idempotencyKey =
        typeof input.idempotencyKey === "string" && input.idempotencyKey.trim()
            ? input.idempotencyKey.trim()
            : undefined;
    const createdAt = String(input.createdAt || fallback.createdAt || "").trim();
    if (!createdAt) {
        return null;
    }

    const updatedAt =
        typeof input.updatedAt === "string" && input.updatedAt.trim() ? input.updatedAt.trim() : undefined;

    return {
        format: "riotplan-evidence-v1",
        planId: String(input.planId || fallback.planId),
        evidenceId,
        file: String(input.file || fallback.file),
        title,
        summary,
        content,
        sources: mirroredSources,
        referenceSources: normalizedReferences.referenceSources,
        tags,
        createdBy,
        idempotencyKey,
        createdAt,
        updatedAt,
        warnings: normalizedReferences.warnings,
    };
}

function parseDirectoryEvidenceRecord(
    rawContent: string,
    fallback: { planId: string; file: string }
): NormalizedEvidenceRecord | null {
    try {
        const parsed = JSON.parse(rawContent) as Record<string, unknown>;
        if (ensureObject(parsed)) {
            return normalizeRecord(parsed, fallback);
        }
    } catch {
        // Legacy markdown evidence format is handled below.
    }

    const embedded = parseEmbeddedRecord(rawContent);
    const markdownSections = parseMarkdownSections(rawContent);
    return normalizeRecord(
        {
            ...(embedded || {}),
            title: embedded?.title || markdownSections.title,
            summary: embedded?.summary || markdownSections.summary,
            content: embedded?.content || markdownSections.evidence,
            sources: embedded?.sources || markdownSections.sources,
        },
        fallback
    );
}

function normalizeEvidenceRefFile(file: string): string {
    const normalized = file.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
    if (!normalized) {
        throw new EvidenceToolError("validation_error", "evidenceRef.file cannot be empty");
    }
    if (normalized.startsWith("/") || normalized.startsWith("../") || normalized.includes("/../")) {
        throw new EvidenceToolError("forbidden", "evidenceRef.file cannot escape the evidence root");
    }
    const relative = normalized.startsWith("evidence/") ? normalized.slice("evidence/".length) : normalized;
    if (!relative || relative.startsWith("/") || relative.includes("..")) {
        throw new EvidenceToolError("forbidden", "evidenceRef.file cannot escape the evidence root");
    }
    return relative;
}

function assertInsideEvidenceRoot(evidenceRoot: string, candidatePath: string): void {
    const resolvedRoot = resolve(evidenceRoot);
    const resolvedCandidate = resolve(candidatePath);
    if (
        resolvedCandidate !== resolvedRoot &&
        !resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)
    ) {
        throw new EvidenceToolError("forbidden", "Evidence file path is outside evidence root");
    }
}

async function writeFileAtomic(targetFile: string, content: string): Promise<void> {
    await mkdir(dirname(targetFile), { recursive: true });
    const tempFile = `${targetFile}.${randomUUID()}.tmp`;
    await writeFile(tempFile, content, "utf-8");
    await rename(tempFile, targetFile);
}

async function listEvidenceFiles(planPath: string): Promise<string[]> {
    const evidenceDir = join(planPath, "evidence");
    try {
        const entries = await readdir(evidenceDir, { withFileTypes: true });
        return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}

async function resolveDirectoryEvidenceRecord(
    planPath: string,
    planId: string,
    evidenceRef: z.infer<typeof EvidenceRefSchema>
): Promise<{
    record: NormalizedEvidenceRecord;
    absolutePath: string;
    rawContent: string;
    serialize: (next: NormalizedEvidenceRecord) => string;
}> {
    const evidenceRoot = join(planPath, "evidence");
    const files = await listEvidenceFiles(planPath);

    if (evidenceRefHasFile(evidenceRef)) {
        const relativeFile = normalizeEvidenceRefFile(evidenceRef.file);
        const absolutePath = join(evidenceRoot, relativeFile);
        assertInsideEvidenceRoot(evidenceRoot, absolutePath);

        let rawContent: string;
        try {
            rawContent = await readFile(absolutePath, "utf-8");
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err.code === "ENOENT") {
                throw new EvidenceToolError("not_found", `Evidence file not found: ${evidenceRef.file}`);
            }
            throw error;
        }

        const fileWithinPlan = `evidence/${relativeFile}`;
        const parsed = parseDirectoryEvidenceRecord(rawContent, { planId, file: fileWithinPlan });
        if (!parsed) {
            throw new EvidenceToolError(
                "validation_error",
                `Evidence file is malformed and cannot be edited safely: ${fileWithinPlan}`
            );
        }
        const canParseAsJson = (() => {
            try {
                JSON.parse(rawContent);
                return true;
            } catch {
                return false;
            }
        })();

        return {
            record: parsed,
            absolutePath,
            rawContent,
            serialize: (next) => (canParseAsJson ? `${JSON.stringify(next, null, 2)}\n` : buildMarkdown(next)),
        };
    }

    const candidates: Array<{
        record: NormalizedEvidenceRecord;
        absolutePath: string;
        rawContent: string;
        serialize: (next: NormalizedEvidenceRecord) => string;
    }> = [];

    for (const file of files) {
        const absolutePath = join(evidenceRoot, file);
        let rawContent: string;
        try {
            rawContent = await readFile(absolutePath, "utf-8");
        } catch {
            continue;
        }

        const fileWithinPlan = `evidence/${file}`;
        const parsed = parseDirectoryEvidenceRecord(rawContent, { planId, file: fileWithinPlan });
        if (!parsed) {
            continue;
        }
        if (!evidenceRefHasId(evidenceRef) || parsed.evidenceId !== evidenceRef.evidenceId) {
            continue;
        }
        const canParseAsJson = (() => {
            try {
                JSON.parse(rawContent);
                return true;
            } catch {
                return false;
            }
        })();

        candidates.push({
            record: parsed,
            absolutePath,
            rawContent,
            serialize: (next) => (canParseAsJson ? `${JSON.stringify(next, null, 2)}\n` : buildMarkdown(next)),
        });
    }

    if (candidates.length === 0) {
        throw new EvidenceToolError(
            "not_found",
            `Evidence not found: ${evidenceRefHasId(evidenceRef) ? evidenceRef.evidenceId : "unknown"}`
        );
    }
    if (candidates.length > 1) {
        throw new EvidenceToolError(
            "validation_error",
            `Multiple evidence records found for ${
                evidenceRefHasId(evidenceRef) ? evidenceRef.evidenceId : "unknown"
            }; use evidenceRef.file`
        );
    }
    return candidates[0];
}

async function readLegacySqliteEvidenceFileContent(
    planPath: string,
    filePathValue: unknown
): Promise<string | undefined> {
    const rawPath = typeof filePathValue === "string" ? filePathValue.trim() : "";
    if (!rawPath) {
        return undefined;
    }

    const candidatePaths = [rawPath];
    if (!isAbsolute(rawPath)) {
        const planParent = dirname(planPath);
        candidatePaths.push(resolve(planParent, rawPath));
        candidatePaths.push(resolve(process.cwd(), rawPath));
    }

    for (const candidate of candidatePaths) {
        try {
            const content = await readFile(candidate, "utf-8");
            if (content.trim()) {
                return content;
            }
        } catch {
            // Best effort: continue through candidate paths.
        }
    }

    return undefined;
}

async function normalizeSqliteEvidenceRecord(
    row: Record<string, unknown>,
    planId: string,
    planPath: string
): Promise<NormalizedEvidenceRecord | null> {
    const filePath = String(row.file_path || row.filePath || row.id || "");
    const rawContent = typeof row.content === "string" ? row.content : "";
    const embedded = parseEmbeddedRecord(rawContent) || {};
    const markdownSections = parseMarkdownSections(rawContent);
    const recoveredFileContent = rawContent.trim()
        ? undefined
        : await readLegacySqliteEvidenceFileContent(planPath, row.file_path || row.filePath);
    const normalizedSummary = String(
        embedded.summary || row.summary || markdownSections.summary || row.description || ""
    );
    const normalizedContent = String(
        embedded.content ||
            markdownSections.evidence ||
            rawContent ||
            recoveredFileContent ||
            row.summary ||
            ""
    );
    return normalizeRecord(
        {
            ...row,
            ...embedded,
            evidenceId: String(embedded.evidenceId || row.id || ""),
            file: String(embedded.file || filePath || ""),
            title: String(embedded.title || row.description || markdownSections.title || ""),
            summary: normalizedSummary,
            content: normalizedContent,
            sources:
                embedded.sources ||
                (typeof row.source === "string"
                    ? row.source
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean)
                    : markdownSections.sources),
            createdAt: String(embedded.createdAt || row.created_at || row.createdAt || ""),
        },
        {
            planId,
            file: filePath,
            evidenceId: String(row.id || ""),
            createdAt: String(row.created_at || row.createdAt || ""),
        }
    );
}

function sourceJoin(values: string[]): string {
    return values.join(", ");
}

function recordsEqual(
    before: NormalizedEvidenceRecord,
    after: NormalizedEvidenceRecord,
    includeUpdatedAt = false
): boolean {
    if (
        before.title !== after.title ||
        before.summary !== after.summary ||
        before.content !== after.content ||
        before.idempotencyKey !== after.idempotencyKey
    ) {
        return false;
    }
    if (before.sources.join("\n") !== after.sources.join("\n")) {
        return false;
    }
    if (before.tags.join("\n") !== after.tags.join("\n")) {
        return false;
    }
    const beforeRefs = before.referenceSources
        .map((source) => `${source.id}|${source.type}|${source.value}|${source.label || ""}|${JSON.stringify(source.metadata || {})}`)
        .join("\n");
    const afterRefs = after.referenceSources
        .map((source) => `${source.id}|${source.type}|${source.value}|${source.label || ""}|${JSON.stringify(source.metadata || {})}`)
        .join("\n");
    if (beforeRefs !== afterRefs) {
        return false;
    }
    if (includeUpdatedAt && before.updatedAt !== after.updatedAt) {
        return false;
    }
    return true;
}

function applyPatch(
    record: NormalizedEvidenceRecord,
    patch: z.infer<typeof EditEvidencePatchSchema>
): NormalizedEvidenceRecord {
    let referenceSources = record.referenceSources;
    if (patch.referenceSources) {
        const parsedPatchRefs = patch.referenceSources.map((source) => ({
            id: source.id?.trim() || stableReferenceSourceId(source.type, source.value.trim()),
            type: source.type,
            value: source.value.trim(),
            label: source.label?.trim() || undefined,
            metadata: source.metadata,
        })) satisfies ReferenceSource[];
        const mode = patch.referenceSourcesMode || "replace";
        if (mode === "replace") {
            referenceSources = parsedPatchRefs;
        } else if (mode === "append") {
            const existingById = new Map(referenceSources.map((item) => [item.id, item]));
            for (const item of parsedPatchRefs) {
                existingById.set(item.id, item);
            }
            referenceSources = Array.from(existingById.values());
        } else {
            const removeIds = new Set(parsedPatchRefs.map((item) => item.id).filter(Boolean));
            referenceSources = referenceSources.filter((item) => !removeIds.has(item.id));
        }
    }

    return {
        ...record,
        title: patch.title ?? record.title,
        summary: patch.summary ?? record.summary,
        content: patch.content ?? record.content,
        tags: patch.tags ? patch.tags.map((value) => value.trim()).filter(Boolean) : record.tags,
        referenceSources,
        sources: patch.sources
            ? patch.sources.map((value) => value.trim()).filter(Boolean)
            : mirrorSourcesFromReferences(referenceSources),
        idempotencyKey: patch.idempotencyKey ?? record.idempotencyKey,
    };
}

function toSuccess(record: Partial<NormalizedEvidenceRecord> & {
    evidenceId?: string;
    file?: string;
    createdAt?: string;
    created?: boolean;
    warnings?: string[];
    filepathDiagnostics?: FilepathReferenceDiagnostic[];
}): AddEvidenceSuccess {
    return {
        ok: true,
        planId: String(record.planId || ""),
        evidenceId: String(record.evidenceId || ""),
        file: String(record.file || ""),
        createdAt: String(record.createdAt || ""),
        created: Boolean(record.created),
        referenceSources: Array.isArray(record.referenceSources)
            ? (record.referenceSources as ReferenceSource[])
            : [],
        warnings: record.warnings,
        filepathDiagnostics: record.filepathDiagnostics,
    };
}

function validatePatchSemantics(patch: z.infer<typeof EditEvidencePatchSchema>): void {
    if (patch.referenceSourcesMode === "removeById" && patch.referenceSources) {
        for (const source of patch.referenceSources) {
            if (!source.id || !source.id.trim()) {
                throw new EvidenceToolError(
                    "validation_error",
                    "referenceSourcesMode=removeById requires every reference source patch entry to include id"
                );
            }
        }
    }
}

async function addEvidenceDirectoryPlan(
    planPath: string,
    validated: z.infer<typeof AddEvidenceSchema>
): Promise<AddEvidenceSuccess> {
    const ideaFile = join(planPath, "IDEA.md");
    try {
        await access(ideaFile);
    } catch {
        throw new Error(`Plan not found: ${validated.planId}`);
    }

    const evidenceDir = join(planPath, "evidence");
    await mkdir(evidenceDir, { recursive: true });

    if (validated.idempotencyKey) {
        const files = await readdir(evidenceDir).catch(() => []);
        for (const entry of files) {
            if (!entry.endsWith(".json")) {
                continue;
            }
            const content = await readFile(join(evidenceDir, entry), "utf-8").catch(() => "");
            if (!content) {
                continue;
            }
            try {
                const parsed = JSON.parse(content) as Partial<NormalizedEvidenceRecord>;
                if (parsed.idempotencyKey && parsed.idempotencyKey === validated.idempotencyKey) {
                    return toSuccess(parsed);
                }
            } catch {
                // Skip non-conforming legacy files.
            }
        }
    }

    const createdAt = formatTimestamp();
    const evidenceId = buildEvidenceId();
    const file = buildEvidenceFile(createdAt, validated.title, evidenceId);
    const normalizedRefs = normalizeReferenceSources(validated.referenceSources, validated.sources || []);
    const record: NormalizedEvidenceRecord = {
        format: "riotplan-evidence-v1",
        planId: validated.planId,
        evidenceId,
        file,
        title: validated.title,
        summary: validated.summary,
        content: validated.content,
        sources: mirrorSourcesFromReferences(normalizedRefs.referenceSources),
        referenceSources: normalizedRefs.referenceSources,
        tags: validated.tags || [],
        createdBy: validated.createdBy,
        idempotencyKey: validated.idempotencyKey,
        createdAt,
    };

    const targetFile = join(planPath, file);
    await writeFile(targetFile, `${JSON.stringify(record, null, 2)}\n`, "utf-8");

    return toSuccess({ ...record, created: true, warnings: normalizedRefs.warnings });
}

async function addEvidenceSqlitePlan(
    planPath: string,
    validated: z.infer<typeof AddEvidenceSchema>
): Promise<AddEvidenceSuccess> {
    const provider = createSqliteProvider(planPath);

    try {
        const exists = await provider.exists();
        if (!exists) {
            throw new Error(`Plan not found: ${validated.planId}`);
        }

        const existingEvidence = await provider.getEvidence();
        if (!existingEvidence.success) {
            throw new Error(existingEvidence.error || "Failed to read evidence store");
        }

        if (validated.idempotencyKey) {
            for (const evidence of existingEvidence.data || []) {
                const embedded = parseEmbeddedRecord(evidence.content || "");
                if (embedded?.idempotencyKey === validated.idempotencyKey) {
                    return toSuccess({
                        planId: embedded.planId || validated.planId,
                        evidenceId: embedded.evidenceId || evidence.id,
                        file: embedded.file || evidence.filePath || evidence.id,
                        createdAt: embedded.createdAt || evidence.createdAt,
                    });
                }
            }
        }

        const createdAt = formatTimestamp();
        const evidenceId = buildEvidenceId();
        const file = buildEvidenceFile(createdAt, validated.title, evidenceId);
        const normalizedRefs = normalizeReferenceSources(validated.referenceSources, validated.sources || []);
        const record: NormalizedEvidenceRecord = {
            format: "riotplan-evidence-v1",
            planId: validated.planId,
            evidenceId,
            file,
            title: validated.title,
            summary: validated.summary,
            content: validated.content,
            sources: mirrorSourcesFromReferences(normalizedRefs.referenceSources),
            referenceSources: normalizedRefs.referenceSources,
            tags: validated.tags || [],
            createdBy: validated.createdBy,
            idempotencyKey: validated.idempotencyKey,
            createdAt,
        };

        const markdownContent = buildMarkdown(record);
        const addResult = await provider.addEvidence({
            id: evidenceId,
            description: validated.title,
            source: sourceJoin(record.sources),
            sourceUrl: firstUrl(record.sources),
            gatheringMethod: "manual",
            content: markdownContent,
            filePath: file,
            summary: validated.summary,
            createdAt,
        });

        if (!addResult.success) {
            throw new Error(addResult.error || "Failed to persist evidence");
        }

        return toSuccess({ ...record, created: true, warnings: normalizedRefs.warnings });
    } finally {
        await provider.close();
    }
}

async function executeAddEvidence(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = AddEvidenceSchema.parse(args);
        const planPath = resolveDirectory({ planId: validated.planId }, context);
        const result = planPath.endsWith(".plan")
            ? await addEvidenceSqlitePlan(planPath, validated)
            : await addEvidenceDirectoryPlan(planPath, validated);
        const filepathDiagnostics = await buildFilepathDiagnostics(
            result.referenceSources || [],
            context.workingDirectory || planPath
        );
        result.filepathDiagnostics = filepathDiagnostics;

        if (result.created) {
            await logEvent(planPath, {
                timestamp: result.createdAt || formatTimestamp(),
                type: "evidence_added",
                data: {
                    evidencePath: result.file,
                    description: validated.title,
                    summary: validated.summary,
                    source: validated.sources?.[0],
                    sourceUrl: firstUrl(validated.sources || []),
                    sources: validated.sources || [],
                    referenceSources: result.referenceSources || [],
                    tags: validated.tags || [],
                    createdBy: validated.createdBy,
                    evidenceId: result.evidenceId,
                },
            });
        }

        return {
            success: true,
            data: result,
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: `Validation failed: ${error.issues.map((issue) => issue.message).join("; ")}`,
                context: { errorType: "validation_error" },
            };
        }
        if (error instanceof EvidenceToolError) {
            return {
                success: false,
                error: error.message,
                context: { errorType: error.code },
            };
        }
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: message,
        };
    }
}

async function editEvidenceDirectoryPlan(
    planPath: string,
    validated: z.infer<typeof EditEvidenceSchema>
): Promise<EditEvidenceSuccess> {
    const resolved = await resolveDirectoryEvidenceRecord(planPath, validated.planId, validated.evidenceRef);
    const patched = applyPatch(resolved.record, validated.patch);

    if (recordsEqual(resolved.record, patched)) {
        return {
            success: true,
            planId: validated.planId,
            evidenceId: resolved.record.evidenceId,
            file: resolved.record.file,
            updatedAt: resolved.record.updatedAt || resolved.record.createdAt,
            referenceSources: resolved.record.referenceSources,
            warnings: ["Patch produced no content changes; evidence left unchanged."],
        };
    }

    const updatedAt = formatTimestamp();
    const toWrite: NormalizedEvidenceRecord = {
        ...patched,
        createdAt: resolved.record.createdAt,
        createdBy: resolved.record.createdBy,
        evidenceId: resolved.record.evidenceId,
        file: resolved.record.file,
        updatedAt,
    };

    const serialized = resolved.serialize(toWrite);
    await writeFileAtomic(resolved.absolutePath, serialized);

    return {
        success: true,
        planId: validated.planId,
        evidenceId: toWrite.evidenceId,
        file: toWrite.file,
        updatedAt,
        referenceSources: toWrite.referenceSources,
    };
}

async function editEvidenceSqlitePlan(
    planPath: string,
    validated: z.infer<typeof EditEvidenceSchema>
): Promise<EditEvidenceSuccess> {
    const db = await openSqliteDatabase(planPath);
    try {
        const evidenceRef = validated.evidenceRef;
        const normalizedFileRef = evidenceRefHasFile(evidenceRef)
            ? normalizeEvidenceRefFile(evidenceRef.file)
            : undefined;
        const preferredFileRef = normalizedFileRef ? `evidence/${normalizedFileRef}` : undefined;
        const row = evidenceRefHasId(evidenceRef)
            ? (db
                .prepare(
                    `SELECT id, description, source, source_url, content, file_path, summary, created_at
                       FROM evidence_records
                       WHERE id = ?`
                )
                .get(evidenceRef.evidenceId) as Record<string, unknown> | undefined)
            : (db
                .prepare(
                    `SELECT id, description, source, source_url, content, file_path, summary, created_at
                       FROM evidence_records
                       WHERE file_path = ? OR file_path = ?
                       LIMIT 1`
                )
                .get(preferredFileRef, normalizedFileRef) as Record<string, unknown> | undefined);

        if (!row) {
            const target = evidenceRefHasId(evidenceRef)
                ? evidenceRef.evidenceId
                : evidenceRefHasFile(evidenceRef)
                    ? evidenceRef.file
                    : "unknown";
            throw new EvidenceToolError("not_found", `Evidence not found: ${target}`);
        }

        const normalized = await normalizeSqliteEvidenceRecord(row, validated.planId, planPath);
        if (!normalized) {
            const id = String(row.id || "unknown");
            throw new EvidenceToolError(
                "validation_error",
                `Evidence record is malformed and cannot be edited safely: ${id}`
            );
        }

        const patched = applyPatch(normalized, validated.patch);
        if (recordsEqual(normalized, patched)) {
            return {
                success: true,
                planId: validated.planId,
                evidenceId: normalized.evidenceId,
                file: normalized.file,
                updatedAt: normalized.updatedAt || normalized.createdAt,
                referenceSources: normalized.referenceSources,
                warnings: ["Patch produced no content changes; evidence left unchanged."],
            };
        }

        const updatedAt = formatTimestamp();
        const updatedRecord: NormalizedEvidenceRecord = {
            ...patched,
            createdAt: normalized.createdAt,
            createdBy: normalized.createdBy,
            evidenceId: normalized.evidenceId,
            file: normalized.file,
            updatedAt,
        };

        const markdownContent = buildMarkdown(updatedRecord);
        const updateResult = db
            .prepare(
                `UPDATE evidence_records
                 SET description = ?, source = ?, source_url = ?, content = ?, summary = ?
                 WHERE id = ?`
            )
            .run(
                updatedRecord.title,
                sourceJoin(updatedRecord.sources),
                firstUrl(updatedRecord.sources),
                markdownContent,
                updatedRecord.summary,
                updatedRecord.evidenceId
            );
        if (updateResult.changes !== 1) {
            throw new EvidenceToolError("not_found", `Evidence not found: ${updatedRecord.evidenceId}`);
        }

        return {
            success: true,
            planId: validated.planId,
            evidenceId: updatedRecord.evidenceId,
            file: updatedRecord.file,
            updatedAt,
            referenceSources: updatedRecord.referenceSources,
        };
    } finally {
        db.close();
    }
}

async function executeEditEvidence(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = EditEvidenceSchema.parse(args);
        validatePatchSemantics(validated.patch);
        const planPath = resolveDirectory({ planId: validated.planId }, context);
        const result = planPath.endsWith(".plan")
            ? await editEvidenceSqlitePlan(planPath, validated)
            : await editEvidenceDirectoryPlan(planPath, validated);
        result.filepathDiagnostics = await buildFilepathDiagnostics(
            result.referenceSources || [],
            context.workingDirectory || planPath
        );

        await logEvent(planPath, {
            timestamp: result.updatedAt,
            type: "evidence_added",
            data: {
                evidencePath: result.file,
                evidenceId: result.evidenceId,
                action: "edited",
                referenceSources: result.referenceSources || [],
            },
        });

        return { success: true, data: result };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: `Validation failed: ${error.issues.map((issue) => issue.message).join("; ")}`,
                context: { errorType: "validation_error" },
            };
        }
        if (error instanceof EvidenceToolError) {
            return {
                success: false,
                error: error.message,
                context: { errorType: error.code },
            };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}

async function deleteEvidenceDirectoryPlan(
    planPath: string,
    validated: z.infer<typeof DeleteEvidenceSchema>
): Promise<DeleteEvidenceSuccess> {
    const deletedAt = formatTimestamp();

    if (evidenceRefHasFile(validated.evidenceRef)) {
        const relativeFile = normalizeEvidenceRefFile(validated.evidenceRef.file);
        const evidenceRoot = join(planPath, "evidence");
        const absolutePath = join(evidenceRoot, relativeFile);
        assertInsideEvidenceRoot(evidenceRoot, absolutePath);

        let rawContent = "";
        try {
            rawContent = await readFile(absolutePath, "utf-8");
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err.code === "ENOENT") {
                throw new EvidenceToolError("not_found", `Evidence file not found: ${validated.evidenceRef.file}`);
            }
            throw error;
        }
        const parsed = parseDirectoryEvidenceRecord(rawContent, {
            planId: validated.planId,
            file: `evidence/${relativeFile}`,
        });
        const evidenceId = parsed?.evidenceId || relativeFile;
        await unlink(absolutePath);
        return {
            success: true,
            planId: validated.planId,
            evidenceId,
            file: `evidence/${relativeFile}`,
            deletedAt,
        };
    }

    const resolved = await resolveDirectoryEvidenceRecord(planPath, validated.planId, validated.evidenceRef);
    await unlink(resolved.absolutePath);
    return {
        success: true,
        planId: validated.planId,
        evidenceId: resolved.record.evidenceId,
        file: resolved.record.file,
        deletedAt,
    };
}

async function deleteEvidenceSqlitePlan(
    planPath: string,
    validated: z.infer<typeof DeleteEvidenceSchema>
): Promise<DeleteEvidenceSuccess> {
    const db = await openSqliteDatabase(planPath);
    try {
        const evidenceRef = validated.evidenceRef;
        const normalizedFileRef = evidenceRefHasFile(evidenceRef)
            ? normalizeEvidenceRefFile(evidenceRef.file)
            : undefined;
        const preferredFileRef = normalizedFileRef ? `evidence/${normalizedFileRef}` : undefined;
        const row = evidenceRefHasId(evidenceRef)
            ? (db
                .prepare(`SELECT id, file_path FROM evidence_records WHERE id = ?`)
                .get(evidenceRef.evidenceId) as Record<string, unknown> | undefined)
            : (db
                .prepare(
                    `SELECT id, file_path
                       FROM evidence_records
                       WHERE file_path = ? OR file_path = ?
                       LIMIT 1`
                )
                .get(preferredFileRef, normalizedFileRef) as Record<string, unknown> | undefined);

        if (!row) {
            const target = evidenceRefHasId(evidenceRef)
                ? evidenceRef.evidenceId
                : evidenceRefHasFile(evidenceRef)
                    ? evidenceRef.file
                    : "unknown";
            throw new EvidenceToolError("not_found", `Evidence not found: ${target}`);
        }

        const evidenceId = String(row.id);
        const file = String(row.file_path || evidenceId);
        const result = db.prepare(`DELETE FROM evidence_records WHERE id = ?`).run(evidenceId);
        if (result.changes !== 1) {
            throw new EvidenceToolError("not_found", `Evidence not found: ${evidenceId}`);
        }
        return {
            success: true,
            planId: validated.planId,
            evidenceId,
            file,
            deletedAt: formatTimestamp(),
        };
    } finally {
        db.close();
    }
}

async function executeDeleteEvidence(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = DeleteEvidenceSchema.parse(args);
        const planPath = resolveDirectory({ planId: validated.planId }, context);
        const result = planPath.endsWith(".plan")
            ? await deleteEvidenceSqlitePlan(planPath, validated)
            : await deleteEvidenceDirectoryPlan(planPath, validated);

        await logEvent(planPath, {
            timestamp: result.deletedAt,
            type: "evidence_deleted",
            data: {
                evidencePath: result.file,
                evidenceId: result.evidenceId,
                action: "deleted",
            },
        });

        return { success: true, data: result };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: `Validation failed: ${error.issues.map((issue) => issue.message).join("; ")}`,
                context: { errorType: "validation_error" },
            };
        }
        if (error instanceof EvidenceToolError) {
            return {
                success: false,
                error: error.message,
                context: { errorType: error.code },
            };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}

async function executeEvidence(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = EvidenceActionSchema.parse(args);
        switch (validated.action) {
            case "add":
                return await executeAddEvidence(validated, context);
            case "edit":
                return await executeEditEvidence(validated, context);
            case "delete":
                return await executeDeleteEvidence(validated, context);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: `Validation failed: ${error.issues.map((issue) => issue.message).join("; ")}`,
                context: { errorType: "validation_error" },
            };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}

export const evidenceTool: McpTool = {
    name: "riotplan_evidence",
    description:
        "Manage structured evidence records with action-based dispatch. Use action=add, edit, or delete.",
    schema: EvidenceToolSchema,
    execute: executeEvidence,
};
