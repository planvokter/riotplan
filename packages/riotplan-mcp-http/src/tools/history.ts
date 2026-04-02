/**
 * MCP tools for ideation history and checkpointing
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { formatTimestamp, resolveDirectory } from "./shared.js";
import type { ToolResult, ToolExecutionContext } from '../types.js';
import type { TimelineEvent, CheckpointMetadata } from '@planvokter/riotplan-core';
import { createSqliteProvider } from "@planvokter/riotplan-format";

// Re-export for backward compatibility
export type HistoryEvent = TimelineEvent;
export type { CheckpointMetadata };

// Tool schemas
export const CheckpointCreateSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    name: z.string().describe("Checkpoint name (kebab-case)"),
    message: z.string().describe("Description of why checkpoint created"),
    capturePrompt: z.boolean().optional().default(true).describe("Capture conversation context"),
});

export const CheckpointListSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
});

export const CheckpointShowSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    checkpoint: z.string().describe("Checkpoint name"),
});

export const CheckpointRestoreSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    checkpoint: z.string().describe("Checkpoint name"),
});

export const HistoryShowSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    since: z.string().optional().describe("Show events since this ISO timestamp"),
    eventType: z.string().optional().describe("Filter by event type"),
    limit: z.number().optional().describe("Maximum number of events to show"),
});

// Core history functions

/**
 * Log an event to the timeline
 */
export async function logEvent(planPath: string, event: TimelineEvent): Promise<void> {
    const provider = createSqliteProvider(planPath);
    try {
        await provider.addTimelineEvent({
            id: randomUUID(),
            timestamp: event.timestamp,
            type: event.type as any,
            data: event.data,
        } as any);
    } finally {
        await provider.close();
    }
}

/**
 * Read timeline events
 */
export async function readTimeline(planPath: string): Promise<TimelineEvent[]> {
    const provider = createSqliteProvider(planPath);
    try {
        const eventsResult = await provider.getTimelineEvents();
        if (!eventsResult.success || !eventsResult.data) {
            return [];
        }
        return eventsResult.data.map((event) => ({
            timestamp: event.timestamp,
            type: event.type as any,
            data: event.data,
        }));
    } finally {
        await provider.close();
    }
}

/**
 * Get list of files in plan
 */
async function getChangedFiles(planPath: string): Promise<string[]> {
    const provider = createSqliteProvider(planPath);
    try {
        const [filesResult, stepsResult] = await Promise.all([
            provider.getFiles(),
            provider.getSteps(),
        ]);
        const files = filesResult.success && filesResult.data
            ? filesResult.data.map((f) => f.filename)
            : [];
        const steps = stepsResult.success && stepsResult.data
            ? stepsResult.data.map((s) => `${s.number.toString().padStart(2, '0')}-${s.code}.md`)
            : [];
        return [...files, ...steps];
    } finally {
        await provider.close();
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
    const provider = createSqliteProvider(planPath);
    try {
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
`;
        const now = formatTimestamp();
        await provider.saveFile({
            type: 'prompt',
            filename: `${checkpointName}.md`,
            content: prompt,
            createdAt: now,
            updatedAt: now,
        });
    } finally {
        await provider.close();
    }
}

// Tool implementations

export async function checkpointCreate(args: z.infer<typeof CheckpointCreateSchema>): Promise<string> {
    const planPath = args.planId || process.cwd();
    const { name, message, capturePrompt } = args;

    const provider = createSqliteProvider(planPath);
    try {
        const [metadataResult, stepsResult, filesResult] = await Promise.all([
            provider.getMetadata(),
            provider.getSteps(),
            provider.getFiles(),
        ]);
        if (!metadataResult.success || !metadataResult.data) {
            throw new Error(metadataResult.error || 'Failed to read plan metadata');
        }

        const createdAt = formatTimestamp();
        const createResult = await provider.createCheckpoint({
            name,
            message,
            createdAt,
            snapshot: {
                metadata: metadataResult.data,
                steps: (stepsResult.success ? stepsResult.data : [])?.map((s) => ({
                    number: s.number,
                    status: s.status,
                    startedAt: s.startedAt,
                    completedAt: s.completedAt,
                })) || [],
                files: (filesResult.success ? filesResult.data : [])?.map((f) => ({
                    type: f.type,
                    filename: f.filename,
                    content: f.content,
                })) || [],
            },
        } as any);
        if (!createResult.success) {
            throw new Error(createResult.error || 'Failed to create checkpoint');
        }

        const snapshot = {
            timestamp: createdAt,
            stage: metadataResult.data.stage,
            idea: { exists: true, content: filesResult.success ? filesResult.data?.find((f) => f.type === 'idea')?.content : undefined },
            shaping: { exists: true, content: filesResult.success ? filesResult.data?.find((f) => f.type === 'shaping')?.content : undefined },
        };

        if (capturePrompt) {
            await capturePromptContext(planPath, name, snapshot, message);
        }

        await provider.addTimelineEvent({
            id: randomUUID(),
            timestamp: createdAt,
            type: 'checkpoint_created' as any,
            data: {
                name,
                message,
                snapshotPath: `checkpoint:${name}`,
                promptPath: `${name}.md`,
            },
        } as any);

        return `✅ Checkpoint created: ${name}\n\nStored in SQLite storage.\nPrompt artifact: ${name}.md\n\nYou can restore this checkpoint later with:\n  riotplan_checkpoint({ action: "restore", checkpoint: "${name}" })`;
    } finally {
        await provider.close();
    }
}

export async function checkpointList(args: z.infer<typeof CheckpointListSchema>): Promise<string> {
    const planPath = args.planId || process.cwd();
    const provider = createSqliteProvider(planPath);
    try {
        const checkpointsResult = await provider.getCheckpoints();
        const checkpoints = checkpointsResult.success ? checkpointsResult.data || [] : [];
        if (checkpoints.length === 0) {
            return 'No checkpoints found.';
        }
        let output = `Found ${checkpoints.length} checkpoint(s):\n\n`;
        for (const checkpoint of checkpoints) {
            const time = new Date(checkpoint.createdAt).toLocaleString();
            output += `- **${checkpoint.name}** (${time})\n`;
            output += `  Message: ${checkpoint.message}\n\n`;
        }
        return output;
    } finally {
        await provider.close();
    }
}

export async function checkpointShow(args: z.infer<typeof CheckpointShowSchema>): Promise<string> {
    const planPath = args.planId || process.cwd();
    const provider = createSqliteProvider(planPath);
    try {
        const checkpointResult = await provider.getCheckpoint(args.checkpoint);
        if (!checkpointResult.success || !checkpointResult.data) {
            throw new Error(`Checkpoint not found: ${args.checkpoint}`);
        }
        const checkpoint = checkpointResult.data;
        const time = new Date(checkpoint.createdAt).toLocaleString();
        let output = `# Checkpoint: ${checkpoint.name}\n\n`;
        output += `**Created**: ${time}\n`;
        output += `**Message**: ${checkpoint.message}\n\n`;
        output += `## Snapshot\n\n`;
        output += `- Stage: ${checkpoint.snapshot.metadata.stage}\n`;
        output += `- Files: ${checkpoint.snapshot.files.length}\n`;
        output += `- Steps: ${checkpoint.snapshot.steps.length}\n\n`;
        output += `Restore: riotplan_checkpoint({ action: "restore", checkpoint: "${args.checkpoint}" })`;
        return output;
    } finally {
        await provider.close();
    }
}

export async function checkpointRestore(args: z.infer<typeof CheckpointRestoreSchema>): Promise<string> {
    const planPath = args.planId || process.cwd();
    const provider = createSqliteProvider(planPath);
    try {
        const checkpointResult = await provider.getCheckpoint(args.checkpoint);
        if (!checkpointResult.success || !checkpointResult.data) {
            throw new Error(`Checkpoint not found: ${args.checkpoint}`);
        }
        const restoreResult = await provider.restoreCheckpoint(args.checkpoint);
        if (!restoreResult.success) {
            throw new Error(restoreResult.error || `Failed to restore checkpoint: ${args.checkpoint}`);
        }
        await provider.addTimelineEvent({
            id: randomUUID(),
            timestamp: formatTimestamp(),
            type: 'checkpoint_restored' as any,
            data: {
                checkpoint: args.checkpoint,
                restoredFrom: checkpointResult.data.createdAt,
            },
        } as any);
        return `✅ Restored to checkpoint: ${args.checkpoint}\n\nRestored from: ${checkpointResult.data.createdAt}\nStage: ${checkpointResult.data.snapshot.metadata.stage}`;
    } finally {
        await provider.close();
    }
}

export async function historyShow(args: z.infer<typeof HistoryShowSchema>): Promise<string> {
    const planPath = args.planId || process.cwd();
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
        const resolvedPath = resolveDirectory(args, context);
        const result = await checkpointCreate({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeCheckpointList(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CheckpointListSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await checkpointList({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeCheckpointShow(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CheckpointShowSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await checkpointShow({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeCheckpointRestore(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CheckpointRestoreSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await checkpointRestore({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeHistoryShow(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = HistoryShowSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await historyShow({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Tool definitions for MCP
import type { McpTool } from '../types.js';

const CheckpointActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('create'),
        planId: z.string().optional(),
        name: z.string(),
        message: z.string(),
        capturePrompt: z.boolean().optional(),
    }),
    z.object({
        action: z.literal('list'),
        planId: z.string().optional(),
    }),
    z.object({
        action: z.literal('show'),
        planId: z.string().optional(),
        checkpoint: z.string(),
    }),
    z.object({
        action: z.literal('restore'),
        planId: z.string().optional(),
        checkpoint: z.string(),
    }),
]);

const CheckpointToolSchema = {
    action: z.enum(['create', 'list', 'show', 'restore']).describe('Checkpoint action to perform'),
    planId: z.string().optional().describe('Plan identifier (defaults to current plan context)'),
    name: z.string().optional().describe('Checkpoint name when action=create'),
    message: z.string().optional().describe('Checkpoint message when action=create'),
    capturePrompt: z.boolean().optional().describe('Capture prompt context when action=create'),
    checkpoint: z.string().optional().describe('Checkpoint name when action=show|restore'),
} satisfies z.ZodRawShape;

async function executeCheckpoint(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CheckpointActionSchema.parse(args);
        switch (validated.action) {
            case 'create':
                return executeCheckpointCreate(validated, context);
            case 'list':
                return executeCheckpointList(validated, context);
            case 'show':
                return executeCheckpointShow(validated, context);
            case 'restore':
                return executeCheckpointRestore(validated, context);
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export const checkpointTool: McpTool = {
    name: "riotplan_checkpoint",
    description: "Manage plan checkpoints with action=create|list|show|restore.",
    schema: CheckpointToolSchema,
    execute: executeCheckpoint,
};

export const historyShowTool: McpTool = {
    name: "riotplan_history_show",
    description: "Show ideation history timeline with all events. Can filter by time, event type, or limit results.",
    schema: HistoryShowSchema.shape,
    execute: executeHistoryShow,
};
