/**
 * MCP tools for ideation history and checkpointing
 */

import { z } from "zod";
import { join } from "node:path";
import { readFile, writeFile, mkdir, appendFile, readdir } from "node:fs/promises";
import { formatTimestamp, resolveDirectory } from "./shared.js";
import type { ToolResult, ToolExecutionContext } from '../types.js';
import type { TimelineEvent, CheckpointMetadata } from '../../types.js';

// Re-export for backward compatibility
export type HistoryEvent = TimelineEvent;
export type { CheckpointMetadata };

// Tool schemas
export const CheckpointCreateSchema = z.object({
    path: z.string().optional().describe("Path to plan directory"),
    name: z.string().describe("Checkpoint name (kebab-case)"),
    message: z.string().describe("Description of why checkpoint created"),
    capturePrompt: z.boolean().optional().default(true).describe("Capture conversation context"),
});

export const CheckpointListSchema = z.object({
    path: z.string().optional().describe("Path to plan directory"),
});

export const CheckpointShowSchema = z.object({
    path: z.string().optional().describe("Path to plan directory"),
    checkpoint: z.string().describe("Checkpoint name"),
});

export const CheckpointRestoreSchema = z.object({
    path: z.string().optional().describe("Path to plan directory"),
    checkpoint: z.string().describe("Checkpoint name"),
});

export const HistoryShowSchema = z.object({
    path: z.string().optional().describe("Path to plan directory"),
    since: z.string().optional().describe("Show events since this ISO timestamp"),
    eventType: z.string().optional().describe("Filter by event type"),
    limit: z.number().optional().describe("Maximum number of events to show"),
});

// Core history functions

/**
 * Log an event to the timeline
 */
export async function logEvent(planPath: string, event: TimelineEvent): Promise<void> {
    const historyDir = join(planPath, '.history');
    await mkdir(historyDir, { recursive: true });
  
    const timelinePath = join(historyDir, 'timeline.jsonl');
    const line = JSON.stringify(event) + '\n';
  
    await appendFile(timelinePath, line);
}

/**
 * Read timeline events
 */
export async function readTimeline(planPath: string): Promise<TimelineEvent[]> {
    const timelinePath = join(planPath, '.history', 'timeline.jsonl');
  
    try {
        const content = await readFile(timelinePath, 'utf-8');
        return content
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/**
 * Capture current state snapshot
 */
async function captureCurrentState(planPath: string): Promise<{
    timestamp: string;
    stage: string;
    idea?: { exists: boolean; content?: string };
    shaping?: { exists: boolean; content?: string };
    lifecycle?: { exists: boolean; content?: string };
}> {
    const snapshot = {
        timestamp: formatTimestamp(),
        stage: 'unknown',
        idea: undefined as { exists: boolean; content?: string } | undefined,
        shaping: undefined as { exists: boolean; content?: string } | undefined,
        lifecycle: undefined as { exists: boolean; content?: string } | undefined,
    };
  
    // Try to read IDEA.md
    try {
        const ideaContent = await readFile(join(planPath, 'IDEA.md'), 'utf-8');
        snapshot.idea = {
            content: ideaContent,
            exists: true,
        };
    } catch {
        snapshot.idea = { exists: false };
    }
  
    // Try to read SHAPING.md
    try {
        const shapingContent = await readFile(join(planPath, 'SHAPING.md'), 'utf-8');
        snapshot.shaping = {
            content: shapingContent,
            exists: true,
        };
    } catch {
        snapshot.shaping = { exists: false };
    }
  
    // Try to read LIFECYCLE.md
    try {
        const lifecycleContent = await readFile(join(planPath, 'LIFECYCLE.md'), 'utf-8');
        snapshot.lifecycle = {
            content: lifecycleContent,
            exists: true,
        };
    
        // Extract current stage
        const stageMatch = lifecycleContent.match(/\*\*Stage\*\*:\s*`(\w+)`/);
        if (stageMatch) {
            snapshot.stage = stageMatch[1];
        }
    } catch {
        snapshot.lifecycle = { exists: false };
    }
  
    return snapshot;
}

/**
 * Count events since last checkpoint
 */
async function countEventsSinceLastCheckpoint(planPath: string): Promise<number> {
    const events = await readTimeline(planPath);
  
    // Find last checkpoint
    let lastCheckpointIndex = -1;
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].type === 'checkpoint_created') {
            lastCheckpointIndex = i;
            break;
        }
    }
  
    if (lastCheckpointIndex === -1) {
        return events.length;
    }
  
    return events.length - lastCheckpointIndex - 1;
}

/**
 * Get list of files in plan directory
 */
async function getChangedFiles(planPath: string): Promise<string[]> {
    try {
        const files = await readdir(planPath);
        return files.filter(f => f.endsWith('.md'));
    } catch {
        return [];
    }
}

/**
 * Format recent events for prompt capture
 */
async function formatRecentEvents(planPath: string, limit: number): Promise<string> {
    const events = await readTimeline(planPath);
    const recent = events.slice(-limit);
  
    return recent.map(event => {
        const time = new Date(event.timestamp).toLocaleString();
        return `- ${time}: ${event.type} - ${JSON.stringify(event.data)}`;
    }).join('\n');
}

/**
 * Format snapshot for prompt capture
 */
function formatSnapshot(snapshot: any): string {
    let output = '';
  
    if (snapshot.stage) {
        output += `**Current Stage**: ${snapshot.stage}\n\n`;
    }
  
    if (snapshot.idea?.exists) {
        output += `### IDEA.md\n\n${snapshot.idea.content}\n\n`;
    }
  
    if (snapshot.shaping?.exists) {
        output += `### SHAPING.md\n\n${snapshot.shaping.content}\n\n`;
    }
  
    return output;
}

/**
 * Capture prompt context at checkpoint
 */
async function capturePromptContext(
    planPath: string,
    checkpointName: string,
    snapshot: any,
    message: string
): Promise<void> {
    const promptDir = join(planPath, '.history', 'prompts');
    await mkdir(promptDir, { recursive: true });
  
    const prompt = `# Checkpoint: ${checkpointName}

**Timestamp**: ${snapshot.timestamp}
**Stage**: ${snapshot.stage || 'unknown'}
**Message**: ${message}

## Current State

${formatSnapshot(snapshot)}

## Files at This Point

${(await getChangedFiles(planPath)).map(f => `- ${f}`).join('\n')}

## Recent Timeline

${await formatRecentEvents(planPath, 10)}

---

This checkpoint captures the state of the plan at this moment in time.
You can restore to this checkpoint using: \`riotplan_checkpoint_restore({ checkpoint: "${checkpointName}" })\`
`;
  
    await writeFile(
        join(promptDir, `${checkpointName}.md`),
        prompt
    );
}

// Tool implementations

export async function checkpointCreate(args: z.infer<typeof CheckpointCreateSchema>): Promise<string> {
    const planPath = args.path || process.cwd();
    const { name, message, capturePrompt } = args;
  
    // 1. Create checkpoint directory
    const checkpointDir = join(planPath, '.history', 'checkpoints');
    await mkdir(checkpointDir, { recursive: true });
  
    // 2. Snapshot current state
    const snapshot = await captureCurrentState(planPath);
  
    // 3. Save checkpoint metadata
    const checkpoint: CheckpointMetadata = {
        name,
        timestamp: snapshot.timestamp,
        message,
        stage: snapshot.stage,
        snapshot: {
            timestamp: snapshot.timestamp,
            idea: snapshot.idea,
            shaping: snapshot.shaping,
            lifecycle: snapshot.lifecycle,
        },
        context: {
            filesChanged: await getChangedFiles(planPath),
            eventsSinceLastCheckpoint: await countEventsSinceLastCheckpoint(planPath),
        },
    };
  
    await writeFile(
        join(checkpointDir, `${name}.json`),
        JSON.stringify(checkpoint, null, 2)
    );
  
    // 4. Capture prompt if requested
    if (capturePrompt) {
        await capturePromptContext(planPath, name, snapshot, message);
    }
  
    // 5. Log checkpoint event
    const checkpointEvent: TimelineEvent = {
        timestamp: snapshot.timestamp,
        type: 'checkpoint_created',
        data: { 
            name, 
            message,
            snapshotPath: `.history/checkpoints/${name}.json`,
            promptPath: `.history/prompts/${name}.md`,
        },
    };
    await logEvent(planPath, checkpointEvent);
  
    return `✅ Checkpoint created: ${name}\n\nLocation: ${planPath}/.history/checkpoints/${name}.json\nPrompt: ${planPath}/.history/prompts/${name}.md\n\nYou can restore this checkpoint later with:\n  riotplan_checkpoint_restore({ checkpoint: "${name}" })`;
}

export async function checkpointList(args: z.infer<typeof CheckpointListSchema>): Promise<string> {
    const planPath = args.path || process.cwd();
    const checkpointDir = join(planPath, '.history', 'checkpoints');
  
    try {
        const files = await readdir(checkpointDir);
        const checkpoints = files.filter(f => f.endsWith('.json'));
    
        if (checkpoints.length === 0) {
            return 'No checkpoints found.';
        }
    
        let output = `Found ${checkpoints.length} checkpoint(s):\n\n`;
    
        for (const file of checkpoints) {
            const content = await readFile(join(checkpointDir, file), 'utf-8');
            const checkpoint: CheckpointMetadata = JSON.parse(content);
            const time = new Date(checkpoint.timestamp).toLocaleString();
            output += `- **${checkpoint.name}** (${time})\n`;
            output += `  Stage: ${checkpoint.stage}\n`;
            output += `  Message: ${checkpoint.message}\n`;
            output += `  Events since last: ${checkpoint.context.eventsSinceLastCheckpoint}\n\n`;
        }
    
        return output;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return 'No checkpoints found.';
        }
        throw error;
    }
}

export async function checkpointShow(args: z.infer<typeof CheckpointShowSchema>): Promise<string> {
    const planPath = args.path || process.cwd();
    const checkpointPath = join(planPath, '.history', 'checkpoints', `${args.checkpoint}.json`);
  
    const content = await readFile(checkpointPath, 'utf-8');
    const checkpoint: CheckpointMetadata = JSON.parse(content);
  
    const time = new Date(checkpoint.timestamp).toLocaleString();
  
    let output = `# Checkpoint: ${checkpoint.name}\n\n`;
    output += `**Created**: ${time}\n`;
    output += `**Stage**: ${checkpoint.stage}\n`;
    output += `**Message**: ${checkpoint.message}\n\n`;
    output += `## Context\n\n`;
    output += `- Files changed: ${checkpoint.context.filesChanged.join(', ')}\n`;
    output += `- Events since last checkpoint: ${checkpoint.context.eventsSinceLastCheckpoint}\n\n`;
    output += `## Snapshot\n\n`;
    output += `${formatSnapshot(checkpoint.snapshot)}\n`;
    output += `\n---\n\n`;
    output += `View full prompt context: ${planPath}/.history/prompts/${args.checkpoint}.md\n`;
    output += `Restore: riotplan_checkpoint_restore({ checkpoint: "${args.checkpoint}" })`;
  
    return output;
}

export async function checkpointRestore(args: z.infer<typeof CheckpointRestoreSchema>): Promise<string> {
    const planPath = args.path || process.cwd();
    const checkpointPath = join(planPath, '.history', 'checkpoints', `${args.checkpoint}.json`);
  
    const content = await readFile(checkpointPath, 'utf-8');
    const checkpoint: CheckpointMetadata = JSON.parse(content);
  
    // Restore files from snapshot
    if (checkpoint.snapshot.idea?.exists && checkpoint.snapshot.idea.content) {
        await writeFile(join(planPath, 'IDEA.md'), checkpoint.snapshot.idea.content);
    }
  
    if (checkpoint.snapshot.shaping?.exists && checkpoint.snapshot.shaping.content) {
        await writeFile(join(planPath, 'SHAPING.md'), checkpoint.snapshot.shaping.content);
    }
  
    if (checkpoint.snapshot.lifecycle?.exists && checkpoint.snapshot.lifecycle.content) {
        await writeFile(join(planPath, 'LIFECYCLE.md'), checkpoint.snapshot.lifecycle.content);
    }
  
    // Log restoration event
    const restoreEvent: TimelineEvent = {
        timestamp: formatTimestamp(),
        type: 'checkpoint_restored',
        data: { 
            checkpoint: args.checkpoint,
            restoredFrom: checkpoint.timestamp,
        },
    };
    await logEvent(planPath, restoreEvent);
  
    return `✅ Restored to checkpoint: ${args.checkpoint}\n\nRestored from: ${checkpoint.timestamp}\nStage: ${checkpoint.stage}\n\nFiles restored:\n${checkpoint.context.filesChanged.map((f: string) => `  - ${f}`).join('\n')}`;
}

export async function historyShow(args: z.infer<typeof HistoryShowSchema>): Promise<string> {
    const planPath = args.path || process.cwd();
    let events = await readTimeline(planPath);
  
    if (events.length === 0) {
        return 'No history events found.';
    }
  
    // Filter by timestamp if provided
    if (args.since) {
        const sinceTime = new Date(args.since).getTime();
        events = events.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }
  
    // Filter by event type if provided
    if (args.eventType) {
        events = events.filter(e => e.type === args.eventType);
    }
  
    // Limit if provided
    if (args.limit) {
        events = events.slice(-args.limit);
    }
  
    let output = `# Ideation History\n\n`;
    output += `Total events: ${events.length}\n\n`;
  
    for (const event of events) {
        const time = new Date(event.timestamp).toLocaleString();
        output += `## ${time} - ${event.type}\n\n`;
        output += `\`\`\`json\n${JSON.stringify(event.data, null, 2)}\n\`\`\`\n\n`;
    }
  
    return output;
}

// Tool executors for MCP

export async function executeCheckpointCreate(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CheckpointCreateSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await checkpointCreate({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeCheckpointList(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CheckpointListSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await checkpointList({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeCheckpointShow(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CheckpointShowSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await checkpointShow({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeCheckpointRestore(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CheckpointRestoreSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await checkpointRestore({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeHistoryShow(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = HistoryShowSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await historyShow({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Tool definitions for MCP
import type { McpTool } from '../types.js';

export const checkpointCreateTool: McpTool = {
    name: "riotplan_checkpoint_create",
    description: "Create a named checkpoint of current ideation state with prompt capture. Use this at key decision points to save your progress.",
    inputSchema: CheckpointCreateSchema.shape as any,
};

export const checkpointListTool: McpTool = {
    name: "riotplan_checkpoint_list",
    description: "List all checkpoints for a plan with timestamps and messages.",
    inputSchema: CheckpointListSchema.shape as any,
};

export const checkpointShowTool: McpTool = {
    name: "riotplan_checkpoint_show",
    description: "Show detailed information about a specific checkpoint including full snapshot.",
    inputSchema: CheckpointShowSchema.shape as any,
};

export const checkpointRestoreTool: McpTool = {
    name: "riotplan_checkpoint_restore",
    description: "Restore plan to a previous checkpoint state. This will overwrite current files with checkpoint snapshot.",
    inputSchema: CheckpointRestoreSchema.shape as any,
};

export const historyShowTool: McpTool = {
    name: "riotplan_history_show",
    description: "Show ideation history timeline with all events. Can filter by time, event type, or limit results.",
    inputSchema: HistoryShowSchema.shape as any,
};
