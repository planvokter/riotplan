/**
 * MCP tools for Idea stage management
 */

import { z } from "zod";
import { join } from "node:path";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { formatTimestamp, resolveDirectory } from "./shared.js";
import { logEvent } from "./history.js";

// Tool schemas
export const IdeaCreateSchema = z.object({
    code: z.string().describe("Plan identifier (kebab-case)"),
    description: z.string().describe("Initial idea description"),
    directory: z.string().optional().describe("Parent directory for the idea"),
});

export const IdeaAddNoteSchema = z.object({
    path: z.string().optional().describe("Path to idea directory"),
    note: z.string().describe("Note to add to the idea"),
});

export const IdeaAddConstraintSchema = z.object({
    path: z.string().optional().describe("Path to idea directory"),
    constraint: z.string().describe("Constraint to add"),
});

export const IdeaAddQuestionSchema = z.object({
    path: z.string().optional().describe("Path to idea directory"),
    question: z.string().describe("Question to add"),
});

export const IdeaAddEvidenceSchema = z.object({
    path: z.string().optional().describe("Path to idea directory"),
    evidencePath: z.string().optional().describe("Path to evidence file, or 'inline' for pasted text"),
    description: z.string().describe("Description of the evidence and its relevance"),
    content: z.string().optional().describe("Inline content if evidencePath is 'inline' (for pasted text/transcripts)"),
    source: z.string().optional().describe("Where evidence came from (e.g., 'web search', 'user paste', 'file analysis')"),
    gatheringMethod: z.enum(["manual", "model-assisted"]).optional().describe("How evidence was gathered"),
    relevanceScore: z.number().min(0).max(1).optional().describe("Relevance score (0-1) from model if model-assisted"),
    summary: z.string().optional().describe("Model-generated summary of the evidence"),
});

export const IdeaAddNarrativeSchema = z.object({
    path: z.string().optional().describe("Path to idea directory"),
    content: z.string().describe("Raw narrative content (thoughts, observations, context)"),
    source: z.enum(["typing", "voice", "paste", "import"]).optional().describe("Source of the narrative"),
    context: z.string().optional().describe("Context about what prompted this narrative"),
    speaker: z.string().optional().describe("Who is speaking (user, assistant, or name)"),
});

export const IdeaKillSchema = z.object({
    path: z.string().optional().describe("Path to idea directory"),
    reason: z.string().describe("Reason for killing the idea"),
});

// Tool implementations

export async function ideaCreate(args: z.infer<typeof IdeaCreateSchema>): Promise<string> {
    const { code, description, directory } = args;
    const basePath = directory || process.cwd();
    const ideaPath = join(basePath, code);
  
    // Create directory
    await mkdir(ideaPath, { recursive: true });
  
    // Create IDEA.md
    const ideaContent = `# Idea: ${code}

## Core Concept

${description}

## Why This Matters

_Why pursue this idea?_

## Initial Thoughts

- _Add your thoughts..._

## Constraints

- _Add constraints..._

## Questions

- _Add questions..._

## Evidence

_Attach relevant documents, images, or files_

## Related Ideas

- _Link to related ideas..._

## Status

**Stage**: idea
**Created**: ${formatTimestamp()}
**Next**: Decide if worth shaping

## Notes

_Add notes as you think about this..._
`;

    await writeFile(join(ideaPath, "IDEA.md"), ideaContent, "utf-8");
  
    // Create LIFECYCLE.md
    const lifecycleContent = `# Lifecycle

## Current Stage

**Stage**: \`idea\`
**Since**: ${formatTimestamp()}

## State History

| From | To | When | Reason |
|------|-----|------|--------|
| - | idea | ${formatTimestamp()} | Initial creation |

## Stage-Specific Data

### Idea
- Core concept: ${description}
- Notes: []
- Constraints: []
- Questions: []
- Evidence: []
`;

    await writeFile(join(ideaPath, "LIFECYCLE.md"), lifecycleContent, "utf-8");
  
    // Log event to history
    await logEvent(ideaPath, {
        timestamp: formatTimestamp(),
        type: 'idea_created',
        data: { code, description },
    });
  
    return `✅ Idea created: ${ideaPath}\n\nNext steps:\n- Add notes: riotplan_idea_add_note\n- Add constraints: riotplan_idea_add_constraint\n- Add questions: riotplan_idea_add_question\n- Add evidence: riotplan_idea_add_evidence\n- When ready: riotplan_transition to 'shaping'`;
}

export async function ideaAddNote(args: z.infer<typeof IdeaAddNoteSchema>): Promise<string> {
    const ideaPath = args.path || process.cwd();
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
    const ideaPath = args.path || process.cwd();
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
    const ideaPath = args.path || process.cwd();
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
    const ideaPath = args.path || process.cwd();
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
    
        // Generate unique ID for evidence
        evidenceId = `evidence-${Date.now()}`;
        const evidenceFilePath = join(evidenceDir, `${evidenceId}.md`);
    
        // Write evidence content
        const evidenceContent = `# Evidence: ${args.description}\n\n` +
            `**Source**: ${args.source || 'user paste'}\n` +
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
            gatheringMethod: args.gatheringMethod,
            relevanceScore: args.relevanceScore,
            summary: args.summary,
            evidenceId,
        },
    });
  
    return `✅ Evidence added: ${args.description}${evidenceId ? ` (ID: ${evidenceId})` : ''}`;
}

export async function ideaAddNarrative(args: z.infer<typeof IdeaAddNarrativeSchema>): Promise<string> {
    const ideaPath = args.path || process.cwd();
    const timestamp = formatTimestamp();
  
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
    const ideaPath = args.path || process.cwd();
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

// Tool executors for MCP
import type { ToolResult, ToolExecutionContext } from '../types.js';

export async function executeIdeaCreate(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaCreateSchema.parse(args);
        // Use directory resolution logic when no explicit directory is provided
        // This matches the behavior of executeCreate and uses the four-tier resolution strategy
        const resolvedDirectory = validated.directory || resolveDirectory(args, context);
        const result = await ideaCreate({ ...validated, directory: resolvedDirectory });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddNote(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddNoteSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await ideaAddNote({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddConstraint(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddConstraintSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await ideaAddConstraint({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddQuestion(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddQuestionSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await ideaAddQuestion({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddEvidence(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddEvidenceSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await ideaAddEvidence({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaAddNarrative(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaAddNarrativeSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await ideaAddNarrative({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeIdeaKill(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = IdeaKillSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await ideaKill({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Tool definitions for MCP
import type { McpTool } from '../types.js';

export const ideaCreateTool: McpTool = {
    name: "riotplan_idea_create",
    description: "Create a new idea (lightweight, no commitment). Use this when you have an initial concept that needs exploration before becoming a full plan.",
    inputSchema: IdeaCreateSchema.shape as any,
};

export const ideaAddNoteTool: McpTool = {
    name: "riotplan_idea_add_note",
    description: "Add a note or thought to an existing idea. Use this to capture thinking as it evolves.",
    inputSchema: IdeaAddNoteSchema.shape as any,
};

export const ideaAddConstraintTool: McpTool = {
    name: "riotplan_idea_add_constraint",
    description: "Add a constraint to an idea (e.g., 'Must work on mobile', 'No external dependencies')",
    inputSchema: IdeaAddConstraintSchema.shape as any,
};

export const ideaAddQuestionTool: McpTool = {
    name: "riotplan_idea_add_question",
    description: "Add a question that needs answering before the idea can progress",
    inputSchema: IdeaAddQuestionSchema.shape as any,
};

export const ideaAddEvidenceTool: McpTool = {
    name: "riotplan_idea_add_evidence",
    description: "Attach evidence to an idea. YOU (the model) should gather evidence using your own capabilities (web search, file reading, analysis), then use this tool to capture and organize it. Supports both file references and inline content (for pasted text, transcripts, web research findings, etc.).",
    inputSchema: IdeaAddEvidenceSchema.shape as any,
};

export const ideaAddNarrativeTool: McpTool = {
    name: "riotplan_idea_add_narrative",
    description: "Add raw narrative content to the timeline. Use this to capture conversational context, thinking-out-loud, or any free-form input that doesn't fit structured categories. Narrative chunks preserve full-fidelity context.",
    inputSchema: IdeaAddNarrativeSchema.shape as any,
};

export const ideaKillTool: McpTool = {
    name: "riotplan_idea_kill",
    description: "Kill an idea with a reason. Use when deciding not to pursue it.",
    inputSchema: IdeaKillSchema.shape as any,
};
