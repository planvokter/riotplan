/**
 * MCP tools for Idea stage management
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { formatTimestamp, resolveDirectory } from "./shared.js";
import { logEvent } from "./history.js";
import type { EvidenceType } from "../../types.js";
import {
    createSqliteProvider,
    formatPlanFilename,
    generatePlanUuid,
    type PlanFile,
    type PlanFileType,
} from "@kjerneverk/riotplan-format";

/**
 * Generate a descriptive filename for evidence based on description and type
 * @param description - Evidence description
 * @param type - Evidence type (optional)
 * @returns Filename without extension
 */
function generateEvidenceFilename(description: string, type?: EvidenceType): string {
    // Convert description to kebab-case slug
    let slug = description
        .toLowerCase()
        .trim()
        // Replace spaces and underscores with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove special characters except hyphens
        .replace(/[^a-z0-9-]/g, '')
        // Remove multiple consecutive hyphens
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '');
    
    // Truncate to reasonable length (50 chars max)
    if (slug.length > 50) {
        slug = slug.substring(0, 50).replace(/-+$/, '');
    }
    
    // Add type prefix based on evidence type
    const typePrefix: Record<EvidenceType, string> = {
        'case-study': 'what-happened-in-',
        'research': 'research-',
        'analysis': 'analysis-',
        'example': 'example-',
        'external-review': 'review-',
        'reference': 'reference-'
    };
    
    const prefix = type ? typePrefix[type] : '';
    return `${prefix}${slug}`;
}

function defaultIdeaContent(code: string, description?: string): string {
    return `# Idea: ${code}

## Core Concept

${description || "_Describe the core concept_"}

## Why This Matters

_Why pursue this idea?_

## Initial Thoughts

## Constraints

## Questions

## Evidence

## Status

**Stage**: idea
**Updated**: ${formatTimestamp()}
`;
}

function appendBulletToSection(content: string, sectionHeading: string, bullet: string): string {
    const sectionIndex = content.indexOf(sectionHeading);
    if (sectionIndex === -1) {
        return `${content.trim()}\n\n${sectionHeading}\n\n- ${bullet}\n`;
    }

    const nextSectionIndex = content.indexOf("\n## ", sectionIndex + sectionHeading.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
    return `${content.slice(0, insertPoint)}- ${bullet}\n${content.slice(insertPoint)}`;
}

async function readTypedFileFromSqlite(planPath: string, fileType: PlanFileType): Promise<PlanFile | null> {
    const provider = createSqliteProvider(planPath);
    const filesResult = await provider.getFiles();
    await provider.close();
    if (!filesResult.success || !filesResult.data) {
        return null;
    }

    const matches = filesResult.data
        .filter((file) => file.type === fileType)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return matches[0] || null;
}

async function saveTypedFileToSqlite(
    planPath: string,
    fileType: PlanFileType,
    filename: string,
    content: string
): Promise<void> {
    const existing = await readTypedFileFromSqlite(planPath, fileType);
    const now = formatTimestamp();
    const provider = createSqliteProvider(planPath);
    const saveResult = await provider.saveFile({
        type: fileType,
        filename: existing?.filename || filename,
        content,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    });
    await provider.close();
    if (!saveResult.success) {
        throw new Error(saveResult.error || `Failed saving ${fileType} file`);
    }
}

async function addTimelineEventToSqlite(
    planPath: string,
    type: string,
    data: Record<string, unknown>
): Promise<void> {
    const provider = createSqliteProvider(planPath);
    const result = await provider.addTimelineEvent({
        id: randomUUID(),
        timestamp: formatTimestamp(),
        type: type as any,
        data,
    });
    await provider.close();
    if (!result.success) {
        throw new Error(result.error || "Failed to add timeline event");
    }
}

/**
 * Check for filename collisions and generate unique filename
 * @param evidenceDir - Evidence directory path
 * @param baseFilename - Base filename without extension
 * @returns Unique filename without extension
 */
async function getUniqueEvidenceFilename(evidenceDir: string, baseFilename: string): Promise<string> {
    try {
        const existingFiles = await readdir(evidenceDir);
        const existingNames = new Set(existingFiles.map(f => f.replace(/\.md$/, '')));
        
        // If no collision, return base filename
        if (!existingNames.has(baseFilename)) {
            return baseFilename;
        }
        
        // Find next available number suffix
        let counter = 2;
        while (existingNames.has(`${baseFilename}-${counter}`)) {
            counter++;
        }
        
        return `${baseFilename}-${counter}`;
    } catch {
        // If directory doesn't exist yet, no collision possible
        return baseFilename;
    }
}

// Tool schemas
export const IdeaCreateSchema = z.object({
    code: z.string().describe("Plan identifier (kebab-case)"),
    description: z.string().describe("Initial idea description"),
    directory: z.string().optional().describe("Parent directory for the idea"),
    ideaContent: z.string().optional().describe("Optional initial idea/motivation content to persist as IDEA.md"),
    idea: z.string().optional().describe("Alias for ideaContent"),
    motivation: z.string().optional().describe("Alias for ideaContent"),
});

export const IdeaAddNoteSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    note: z.string().describe("Note to add to the idea"),
});

export const IdeaAddConstraintSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    constraint: z.string().describe("Constraint to add"),
});

export const IdeaAddQuestionSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    question: z.string().describe("Question to add"),
});

export const IdeaAddEvidenceSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    evidencePath: z.string().optional().describe("PREFERRED: Path to evidence file. The tool will copy/link the file. Use 'inline' ONLY for very short content (<500 chars)"),
    description: z.string().describe("Description of the evidence and its relevance"),
    content: z.string().optional().describe("ONLY use for very short inline content (<500 chars). For files or long content, use evidencePath instead"),
    source: z.string().optional().describe("Where evidence came from (e.g., 'web search', 'user paste', 'file analysis')"),
    sourceUrl: z.string().optional().describe("URL where evidence was retrieved from (if applicable)"),
    originalQuery: z.string().optional().describe("Original question or search query that prompted gathering this evidence"),
    gatheringMethod: z.enum(["manual", "model-assisted"]).optional().describe("How evidence was gathered"),
    relevanceScore: z.number().min(0).max(1).optional().describe("Relevance score (0-1) from model if model-assisted"),
    summary: z.string().optional().describe("Brief summary of the evidence (keep short, <200 chars)"),
});

export const IdeaAddNarrativeSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    content: z.string().describe("Raw narrative content (thoughts, observations, context)"),
    source: z.enum(["typing", "voice", "paste", "import"]).optional().describe("Source of the narrative"),
    context: z.string().optional().describe("Context about what prompted this narrative"),
    speaker: z.string().optional().describe("Who is speaking (user, assistant, or name)"),
});

export const IdeaKillSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    reason: z.string().describe("Reason for killing the idea"),
});

export const IdeaSetContentSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    path: z.string().optional().describe("Plan path (legacy alias for planId)"),
    content: z.string().describe("Full IDEA.md content to persist"),
});

// Tool implementations

type IdeaCreateResult = {
    message: string;
    planId: string;
    planUuid: string;
    planPath: string;
    storage: "sqlite";
    stage: "idea";
};

async function ensureNoLegacyDirectoryConflict(parentDir: string, code: string): Promise<void> {
    const legacyPath = join(parentDir, code);
    try {
        const legacyStats = await stat(legacyPath);
        if (legacyStats.isDirectory()) {
            throw new Error(
                `Legacy directory plan conflict detected at "${legacyPath}". ` +
                `riotplan_idea(action: "create") now only creates SQLite plans (.plan). ` +
                `Please rename or migrate the legacy directory plan first, then retry.`
            );
        }
    } catch (error: any) {
        if (error?.code !== "ENOENT") {
            throw error;
        }
    }
}

export async function ideaCreate(args: z.infer<typeof IdeaCreateSchema>): Promise<IdeaCreateResult> {
    const { code, description, directory } = args;
    const parentDir = directory || process.cwd();
    await ensureNoLegacyDirectoryConflict(parentDir, code);

    const planUuid = generatePlanUuid();
    const planFilename = formatPlanFilename(planUuid, code);
    const planPath = join(parentDir, planFilename);
    const now = formatTimestamp();
    const provider = createSqliteProvider(planPath);

    const initResult = await provider.initialize({
        id: code,
        uuid: planUuid,
        name: code,
        description,
        createdAt: now,
        updatedAt: now,
        stage: "idea",
        schemaVersion: 1,
    });
    if (!initResult.success) {
        await provider.close();
        throw new Error(initResult.error || "Failed to initialize sqlite plan");
    }

    const rawIdeaContent =
        (typeof args.ideaContent === "string" ? args.ideaContent : "") ||
        (typeof args.idea === "string" ? args.idea : "") ||
        (typeof args.motivation === "string" ? args.motivation : "");
    const initialIdeaContent = rawIdeaContent.trim().length > 0
        ? rawIdeaContent
        : defaultIdeaContent(code, description);

    const ideaFileResult = await provider.saveFile({
        type: "idea",
        filename: "IDEA.md",
        content: initialIdeaContent,
        createdAt: now,
        updatedAt: now,
    });
    if (!ideaFileResult.success) {
        await provider.close();
        throw new Error(ideaFileResult.error || "Failed to create IDEA.md in sqlite plan");
    }

    await provider.close();
    await addTimelineEventToSqlite(planPath, "idea_created", {
        code,
        description,
        storage: "sqlite",
        stage: "idea",
    });

    return {
        message:
            `✅ Idea created: ${planPath}\n` +
            `Storage: sqlite\n\n` +
            `Next steps:\n` +
            `- Add notes: riotplan_idea({ action: "add_note", ... })\n` +
            `- Add constraints: riotplan_idea({ action: "add_constraint", ... })\n` +
            `- Add questions: riotplan_idea({ action: "add_question", ... })\n` +
            `- Add evidence: riotplan_idea({ action: "add_evidence", ... })\n` +
            `- When ready: riotplan_transition to 'shaping'`,
        planId: code,
        planUuid,
        planPath,
        storage: "sqlite",
        stage: "idea",
    };
}

export async function ideaAddNote(args: z.infer<typeof IdeaAddNoteSchema>): Promise<string> {
    const ideaPath = args.planId || process.cwd();
    if (ideaPath.endsWith(".plan")) {
        const metaProvider = createSqliteProvider(ideaPath);
        const metadataResult = await metaProvider.getMetadata();
        await metaProvider.close();
        const currentIdea = await readTypedFileFromSqlite(ideaPath, "idea");
        const base = currentIdea?.content || defaultIdeaContent(metadataResult.data?.id || "idea");
        const updated = appendBulletToSection(base, "## Initial Thoughts", args.note);
        await saveTypedFileToSqlite(ideaPath, "idea", "IDEA.md", updated);
        await addTimelineEventToSqlite(ideaPath, "note_added", { note: args.note });
        return `✅ Note added to idea`;
    }
    const ideaFile = join(ideaPath, "IDEA.md");
  
    let content = await readFile(ideaFile, "utf-8");
  
    // Find the Initial Thoughts section and add the note
    const thoughtsSection = "## Initial Thoughts";
    const thoughtsIndex = content.indexOf(thoughtsSection);
  
    if (thoughtsIndex === -1) {
        throw new Error("Could not find Initial Thoughts section in IDEA.md");
    }
  
    // Find the next section
    const nextSectionIndex = content.indexOf("\n## ", thoughtsIndex + thoughtsSection.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
  
    // Insert the note
    const note = `- ${args.note}\n`;
    content = content.slice(0, insertPoint) + note + content.slice(insertPoint);
  
    await writeFile(ideaFile, content, "utf-8");
  
    // Log event
    await logEvent(ideaPath, {
        timestamp: formatTimestamp(),
        type: 'note_added',
        data: { note: args.note },
    });
  
    return `✅ Note added to idea`;
}

export async function ideaAddConstraint(args: z.infer<typeof IdeaAddConstraintSchema>): Promise<string> {
    const ideaPath = args.planId || process.cwd();
    if (ideaPath.endsWith(".plan")) {
        const metaProvider = createSqliteProvider(ideaPath);
        const metadataResult = await metaProvider.getMetadata();
        await metaProvider.close();
        const currentIdea = await readTypedFileFromSqlite(ideaPath, "idea");
        const base = currentIdea?.content || defaultIdeaContent(metadataResult.data?.id || "idea");
        const updated = appendBulletToSection(base, "## Constraints", args.constraint);
        await saveTypedFileToSqlite(ideaPath, "idea", "IDEA.md", updated);
        await addTimelineEventToSqlite(ideaPath, "constraint_added", { constraint: args.constraint });
        return `✅ Constraint added to idea`;
    }
    const ideaFile = join(ideaPath, "IDEA.md");
  
    let content = await readFile(ideaFile, "utf-8");
  
    const constraintsSection = "## Constraints";
    const constraintsIndex = content.indexOf(constraintsSection);
  
    if (constraintsIndex === -1) {
        throw new Error("Could not find Constraints section in IDEA.md");
    }
  
    const nextSectionIndex = content.indexOf("\n## ", constraintsIndex + constraintsSection.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
  
    const constraint = `- ${args.constraint}\n`;
    content = content.slice(0, insertPoint) + constraint + content.slice(insertPoint);
  
    await writeFile(ideaFile, content, "utf-8");
  
    // Log event
    await logEvent(ideaPath, {
        timestamp: formatTimestamp(),
        type: 'constraint_added',
        data: { constraint: args.constraint },
    });
  
    return `✅ Constraint added to idea`;
}

export async function ideaAddQuestion(args: z.infer<typeof IdeaAddQuestionSchema>): Promise<string> {
    const ideaPath = args.planId || process.cwd();
    if (ideaPath.endsWith(".plan")) {
        const metaProvider = createSqliteProvider(ideaPath);
        const metadataResult = await metaProvider.getMetadata();
        await metaProvider.close();
        const currentIdea = await readTypedFileFromSqlite(ideaPath, "idea");
        const base = currentIdea?.content || defaultIdeaContent(metadataResult.data?.id || "idea");
        const updated = appendBulletToSection(base, "## Questions", args.question);
        await saveTypedFileToSqlite(ideaPath, "idea", "IDEA.md", updated);
        await addTimelineEventToSqlite(ideaPath, "question_added", { question: args.question });
        return `✅ Question added to idea`;
    }
    const ideaFile = join(ideaPath, "IDEA.md");
  
    let content = await readFile(ideaFile, "utf-8");
  
    const questionsSection = "## Questions";
    const questionsIndex = content.indexOf(questionsSection);
  
    if (questionsIndex === -1) {
        throw new Error("Could not find Questions section in IDEA.md");
    }
  
    const nextSectionIndex = content.indexOf("\n## ", questionsIndex + questionsSection.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
  
    const question = `- ${args.question}\n`;
    content = content.slice(0, insertPoint) + question + content.slice(insertPoint);
  
    await writeFile(ideaFile, content, "utf-8");
  
    // Log event
    await logEvent(ideaPath, {
        timestamp: formatTimestamp(),
        type: 'question_added',
        data: { question: args.question },
    });
  
    return `✅ Question added to idea`;
}

export async function ideaAddEvidence(args: z.infer<typeof IdeaAddEvidenceSchema>): Promise<string> {
    const ideaPath = args.planId || process.cwd();
    if (ideaPath.endsWith(".plan")) {
        const provider = createSqliteProvider(ideaPath);
        const evidenceId = generateEvidenceFilename(args.description);
        const now = formatTimestamp();
        const evidenceResult = await provider.addEvidence({
            id: evidenceId,
            description: args.description,
            source: args.source,
            sourceUrl: args.sourceUrl,
            gatheringMethod: args.gatheringMethod,
            content: args.content,
            filePath: args.evidencePath,
            relevanceScore: args.relevanceScore,
            originalQuery: args.originalQuery,
            summary: args.summary,
            createdAt: now,
        });
        if (!evidenceResult.success) {
            await provider.close();
            throw new Error(evidenceResult.error || "Failed to add evidence");
        }

        const currentIdea = await readTypedFileFromSqlite(ideaPath, "idea");
        if (currentIdea) {
            const link = `${args.description}${args.source ? ` (${args.source})` : ""}`;
            const updated = appendBulletToSection(currentIdea.content, "## Evidence", link);
            await provider.saveFile({
                type: "idea",
                filename: currentIdea.filename || "IDEA.md",
                content: updated,
                createdAt: currentIdea.createdAt || now,
                updatedAt: now,
            });
        }

        await provider.addTimelineEvent({
            id: randomUUID(),
            timestamp: now,
            type: "evidence_added",
            data: {
                description: args.description,
                source: args.source,
                sourceUrl: args.sourceUrl,
                originalQuery: args.originalQuery,
            },
        });
        await provider.close();
        return `✅ Evidence added: ${args.description}`;
    }
    const ideaFile = join(ideaPath, "IDEA.md");
  
    let evidencePath = args.evidencePath;
    let evidenceId: string | undefined;
  
    // Handle inline evidence (pasted text)
    if (evidencePath === "inline" || args.content) {
        if (!args.content) {
            throw new Error("Content is required when evidencePath is 'inline'");
        }
    
        // Create evidence directory at top level
        const evidenceDir = join(ideaPath, "evidence");
        await mkdir(evidenceDir, { recursive: true });
    
        // Generate descriptive filename from description
        const baseFilename = generateEvidenceFilename(args.description);
        evidenceId = await getUniqueEvidenceFilename(evidenceDir, baseFilename);
        const evidenceFilePath = join(evidenceDir, `${evidenceId}.md`);
    
        // Write evidence content
        const evidenceContent = `# Evidence: ${args.description}\n\n` +
            `**Source**: ${args.source || 'user paste'}\n` +
            (args.sourceUrl ? `**Source URL**: ${args.sourceUrl}\n` : '') +
            (args.originalQuery ? `**Original Query**: ${args.originalQuery}\n` : '') +
            `**Added**: ${formatTimestamp()}\n` +
            (args.gatheringMethod ? `**Gathering Method**: ${args.gatheringMethod}\n` : '') +
            (args.relevanceScore !== undefined ? `**Relevance Score**: ${args.relevanceScore}\n` : '') +
            `\n---\n\n${args.content}`;
    
        await writeFile(evidenceFilePath, evidenceContent);
        evidencePath = `evidence/${evidenceId}.md`;
    }
  
    // Update IDEA.md
    let content = await readFile(ideaFile, "utf-8");
  
    const evidenceSection = "## Evidence";
    const evidenceIndex = content.indexOf(evidenceSection);
  
    if (evidenceIndex === -1) {
        throw new Error("Could not find Evidence section in IDEA.md");
    }
  
    const nextSectionIndex = content.indexOf("\n## ", evidenceIndex + evidenceSection.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
  
    const evidence = `- [${args.description}](${evidencePath})${args.source ? ` (${args.source})` : ''}\n`;
    content = content.slice(0, insertPoint) + evidence + content.slice(insertPoint);
  
    await writeFile(ideaFile, content, "utf-8");
  
    // Log event
    await logEvent(ideaPath, {
        timestamp: formatTimestamp(),
        type: 'evidence_added',
        data: { 
            evidencePath: evidencePath,
            description: args.description,
            source: args.source,
            sourceUrl: args.sourceUrl,
            originalQuery: args.originalQuery,
            gatheringMethod: args.gatheringMethod,
            relevanceScore: args.relevanceScore,
            summary: args.summary,
            evidenceId,
        },
    });
  
    return `✅ Evidence added: ${args.description}${evidenceId ? ` (ID: ${evidenceId})` : ''}`;
}

export async function ideaAddNarrative(args: z.infer<typeof IdeaAddNarrativeSchema>): Promise<string> {
    const ideaPath = args.planId || process.cwd();
    const timestamp = formatTimestamp();
    if (ideaPath.endsWith(".plan")) {
        const provider = createSqliteProvider(ideaPath);
        const timelineResult = await provider.addTimelineEvent({
            id: randomUUID(),
            timestamp,
            type: "narrative_added",
            data: {
                content: args.content,
                source: args.source,
                context: args.context,
                speaker: args.speaker || "user",
            },
        });
        if (!timelineResult.success) {
            await provider.close();
            throw new Error(timelineResult.error || "Failed to add narrative event");
        }

        const filesResult = await provider.getFiles();
        const promptFiles = (filesResult.success ? filesResult.data || [] : [])
            .filter((f) => f.type === "prompt" && /^\d{3}-.*\.md$/.test(f.filename))
            .sort((a, b) => a.filename.localeCompare(b.filename));
        const nextNum = promptFiles.length > 0
            ? parseInt(promptFiles[promptFiles.length - 1].filename.substring(0, 3), 10) + 1
            : 1;

        const baseFilename = args.context
            ? args.context.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)
            : 'narrative';
        const filename = `${String(nextNum).padStart(3, '0')}-${baseFilename}.md`;
        const promptContent = `# Narrative: ${args.context || 'User Input'}

**Date**: ${timestamp}
**Source**: ${args.source || 'unknown'}
**Speaker**: ${args.speaker || 'user'}

---

${args.content}
`;
        const fileResult = await provider.saveFile({
            type: "prompt",
            filename,
            content: promptContent,
            createdAt: timestamp,
            updatedAt: timestamp,
        });
        await provider.close();
        if (!fileResult.success) {
            throw new Error(fileResult.error || "Failed to save narrative prompt file");
        }
        return `✅ Narrative saved to timeline and ${filename} (${args.content.length} characters)`;
    }
  
    // Log narrative chunk to timeline (not to IDEA.md)
    // Narrative chunks are kept in the timeline for full-fidelity context
    await logEvent(ideaPath, {
        timestamp,
        type: 'narrative_chunk',
        data: { 
            content: args.content,
            source: args.source,
            context: args.context,
            speaker: args.speaker || 'user',
        },
    });
  
    // ALSO save to .history/prompts/ directory as a numbered file
    // This makes narratives reusable as prompts for regenerating/updating plans
    const historyDir = join(ideaPath, ".history");
    const promptsDir = join(historyDir, "prompts");
    await mkdir(promptsDir, { recursive: true });
  
    // Find next available number
    let files: string[] = [];
    try {
        files = await readdir(promptsDir);
    } catch {
        // Directory doesn't exist yet or is empty
        files = [];
    }
  
    const promptFiles = files
        .filter(f => /^\d{3}-.*\.md$/.test(f))
        .sort();
    
    const nextNum = promptFiles.length > 0
        ? parseInt(promptFiles[promptFiles.length - 1].substring(0, 3)) + 1
        : 1;
  
    // Generate filename from context or use generic name
    const baseFilename = args.context
        ? args.context.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)
        : 'narrative';
    const filename = `${String(nextNum).padStart(3, '0')}-${baseFilename}.md`;
    const promptPath = join(promptsDir, filename);
  
    // Create prompt file
    const promptContent = `# Narrative: ${args.context || 'User Input'}

**Date**: ${timestamp}
**Source**: ${args.source || 'unknown'}
**Speaker**: ${args.speaker || 'user'}

---

${args.content}
`;
  
    await writeFile(promptPath, promptContent, "utf-8");
  
    return `✅ Narrative saved to timeline and ${filename} (${args.content.length} characters)`;
}

export async function ideaKill(args: z.infer<typeof IdeaKillSchema>): Promise<string> {
    const ideaPath = args.planId || process.cwd();
    const ideaFile = join(ideaPath, "IDEA.md");
  
    let content = await readFile(ideaFile, "utf-8");
  
    // Add killed status
    const statusSection = "## Status";
    const statusIndex = content.indexOf(statusSection);
  
    if (statusIndex !== -1) {
        const nextSectionIndex = content.indexOf("\n## ", statusIndex + statusSection.length);
        const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
    
        const killedNote = `\n**Killed**: ${formatTimestamp()}\n**Reason**: ${args.reason}\n`;
        content = content.slice(0, insertPoint) + killedNote + content.slice(insertPoint);
    
        await writeFile(ideaFile, content, "utf-8");
    }
  
    // Log event
    await logEvent(ideaPath, {
        timestamp: formatTimestamp(),
        type: 'idea_killed',
        data: { reason: args.reason },
    });
  
    return `✅ Idea killed: ${args.reason}`;
}

export async function ideaSetContent(args: z.infer<typeof IdeaSetContentSchema>): Promise<string> {
    const ideaPath = args.planId || process.cwd();
    if (ideaPath.endsWith(".plan")) {
        await saveTypedFileToSqlite(ideaPath, "idea", "IDEA.md", args.content);
        await addTimelineEventToSqlite(ideaPath, "note_added", { action: "idea_content_set", length: args.content.length });
        return "✅ IDEA.md updated";
    }
    const ideaFile = join(ideaPath, "IDEA.md");

    await writeFile(ideaFile, args.content, "utf-8");

    await logEvent(ideaPath, {
        timestamp: formatTimestamp(),
        type: 'idea_content_set',
        data: { length: args.content.length },
    });

    return "✅ IDEA.md updated";
}

// Tool executors for MCP
import type { ToolResult, ToolExecutionContext } from '../types.js';

export async function executeIdeaCreate(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaCreateSchema.parse(args);
        // Use directory resolution logic when no explicit directory is provided
        // This matches the behavior of executeCreate and uses the four-tier resolution strategy
        const resolvedDirectory = validated.directory || resolveDirectory(args, context);
        const result = await ideaCreate({ ...validated, directory: resolvedDirectory });
        
        // Automatically switch context to the newly created plan
        // This ensures subsequent tool calls operate on the new plan
        if (context.updateContext) {
            context.updateContext({ workingDirectory: result.planPath });
        }
        
        return {
            success: true,
            data: {
                message: result.message,
                planId: result.planId,
                planUuid: result.planUuid,
                planPath: result.planPath,
                storage: result.storage,
                stage: result.stage,
            },
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddNote(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddNoteSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await ideaAddNote({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddConstraint(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddConstraintSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await ideaAddConstraint({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddQuestion(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddQuestionSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await ideaAddQuestion({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddEvidence(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddEvidenceSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await ideaAddEvidence({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddNarrative(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddNarrativeSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await ideaAddNarrative({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaKill(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaKillSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await ideaKill({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaSetContent(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaSetContentSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await ideaSetContent({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Tool definitions for MCP
import type { McpTool } from '../types.js';

const IdeaActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("create"),
        code: z.string(),
        description: z.string(),
        directory: z.string().optional(),
        ideaContent: z.string().optional(),
        idea: z.string().optional(),
        motivation: z.string().optional(),
    }),
    z.object({
        action: z.literal("add_note"),
        planId: z.string().optional(),
        note: z.string(),
    }),
    z.object({
        action: z.literal("add_constraint"),
        planId: z.string().optional(),
        constraint: z.string(),
    }),
    z.object({
        action: z.literal("add_question"),
        planId: z.string().optional(),
        question: z.string(),
    }),
    z.object({
        action: z.literal("add_evidence"),
        planId: z.string().optional(),
        evidencePath: z.string().optional(),
        description: z.string(),
        content: z.string().optional(),
        source: z.string().optional(),
        sourceUrl: z.string().optional(),
        originalQuery: z.string().optional(),
        gatheringMethod: z.enum(["manual", "model-assisted"]).optional(),
        relevanceScore: z.number().min(0).max(1).optional(),
        summary: z.string().optional(),
    }),
    z.object({
        action: z.literal("add_narrative"),
        planId: z.string().optional(),
        content: z.string(),
        source: z.enum(["typing", "voice", "paste", "import"]).optional(),
        context: z.string().optional(),
        speaker: z.string().optional(),
    }),
    z.object({
        action: z.literal("set_content"),
        planId: z.string().optional(),
        path: z.string().optional(),
        content: z.string(),
    }),
    z.object({
        action: z.literal("kill"),
        planId: z.string().optional(),
        reason: z.string(),
    }),
]);

const IdeaToolSchema = {
    action: z
        .enum([
            "create",
            "add_note",
            "add_constraint",
            "add_question",
            "add_evidence",
            "add_narrative",
            "set_content",
            "kill",
        ])
        .describe("Idea action to perform"),
    code: z.string().optional().describe("Plan identifier when action=create"),
    description: z.string().optional().describe("Description when action=create|add_evidence"),
    directory: z.string().optional().describe("Parent directory for action=create"),
    ideaContent: z.string().optional().describe("Optional initial idea/motivation content for action=create"),
    idea: z.string().optional().describe("Alias for ideaContent"),
    motivation: z.string().optional().describe("Alias for ideaContent"),
    planId: z.string().optional().describe("Plan identifier"),
    note: z.string().optional().describe("Note when action=add_note"),
    constraint: z.string().optional().describe("Constraint when action=add_constraint"),
    question: z.string().optional().describe("Question when action=add_question"),
    evidencePath: z.string().optional().describe("Evidence path when action=add_evidence"),
    content: z.string().optional().describe("Content when action=add_narrative|set_content|add_evidence(inline)"),
    source: z.string().optional().describe("Source metadata for action=add_evidence|add_narrative"),
    sourceUrl: z.string().optional().describe("Source URL for action=add_evidence"),
    originalQuery: z.string().optional().describe("Original query for action=add_evidence"),
    gatheringMethod: z.enum(["manual", "model-assisted"]).optional().describe("Gathering method for action=add_evidence"),
    relevanceScore: z.number().min(0).max(1).optional().describe("Relevance score for action=add_evidence"),
    summary: z.string().optional().describe("Short summary for action=add_evidence"),
    context: z.string().optional().describe("Narrative context when action=add_narrative"),
    speaker: z.string().optional().describe("Speaker when action=add_narrative"),
    reason: z.string().optional().describe("Reason when action=kill"),
    path: z.string().optional().describe("Legacy alias for planId when action=set_content"),
} satisfies z.ZodRawShape;

async function executeIdea(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaActionSchema.parse(args);
        switch (validated.action) {
            case "create":
                return executeIdeaCreate(validated, context);
            case "add_note":
                return executeIdeaAddNote(validated, context);
            case "add_constraint":
                return executeIdeaAddConstraint(validated, context);
            case "add_question":
                return executeIdeaAddQuestion(validated, context);
            case "add_evidence":
                return executeIdeaAddEvidence(validated, context);
            case "add_narrative":
                return executeIdeaAddNarrative(validated, context);
            case "set_content":
                return executeIdeaSetContent(validated, context);
            case "kill":
                return executeIdeaKill(validated, context);
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export const ideaTool: McpTool = {
    name: "riotplan_idea",
    description:
        "Manage idea-stage operations with action=create|add_note|add_constraint|add_question|add_evidence|add_narrative|set_content|kill.",
    schema: IdeaToolSchema,
    execute: executeIdea,
};
