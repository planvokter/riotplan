/**
 * MCP tool for lifecycle stage transitions
 */

import { z } from "zod";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { formatTimestamp, resolveDirectory, formatError, createSuccess } from "./shared.js";
import { logEvent } from "./history.js";
import type { McpTool, ToolResult, ToolExecutionContext } from "../types.js";

// Tool schema
export const TransitionSchema = z.object({
    path: z.string().optional().describe("Path to plan/idea/shaping directory"),
    stage: z.string().describe("Target stage (idea, shaping, built, executing, completed, cancelled)"),
    reason: z.string().describe("Reason for transitioning"),
});

// Tool implementation
export async function transitionStage(args: z.infer<typeof TransitionSchema>, context: ToolExecutionContext): Promise<string> {
    const planPath = resolveDirectory(args, context);
    const lifecycleFile = join(planPath, "LIFECYCLE.md");
    
    // Read current LIFECYCLE.md
    let lifecycle: string;
    try {
        lifecycle = await readFile(lifecycleFile, "utf-8");
    } catch {
        throw new Error(`Could not read LIFECYCLE.md at ${lifecycleFile}. Is this a valid plan/idea directory?`);
    }
    
    // Extract current stage
    const stageMatch = lifecycle.match(/\*\*Stage\*\*: `(\w+)`/);
    const currentStage = stageMatch ? stageMatch[1] : "unknown";
    
    // Validate target stage (basic validation - just check it's not empty)
    if (!args.stage || args.stage.trim() === "") {
        throw new Error("Target stage cannot be empty");
    }
    
    // Don't transition if already at target stage
    if (currentStage === args.stage) {
        return `Already at stage '${args.stage}'. No transition needed.`;
    }
    
    const timestamp = formatTimestamp();
    
    // Update current stage section
    lifecycle = lifecycle.replace(
        /\*\*Stage\*\*: `\w+`/,
        `**Stage**: \`${args.stage}\``
    );
    lifecycle = lifecycle.replace(
        /\*\*Since\*\*: .+/,
        `**Since**: ${timestamp}`
    );
    
    // Add to state history table
    // Find the state history table and add new row
    const historyTableMatch = lifecycle.match(/(## State History\s+\|[^\n]+\n\|[^\n]+\n(?:\|[^\n]+\n)*)/);
    if (historyTableMatch) {
        const newRow = `| ${currentStage} | ${args.stage} | ${timestamp} | ${args.reason} |\n`;
        const updatedTable = historyTableMatch[0] + newRow;
        lifecycle = lifecycle.replace(historyTableMatch[0], updatedTable);
    }
    
    // Write updated LIFECYCLE.md
    await writeFile(lifecycleFile, lifecycle, "utf-8");
    
    // Log transition event to timeline
    await logEvent(planPath, {
        timestamp,
        type: 'stage_transition',
        data: {
            from: currentStage,
            to: args.stage,
            reason: args.reason,
        },
    });
    
    return `✅ Transitioned from '${currentStage}' to '${args.stage}'\n\nReason: ${args.reason}`;
}

// MCP Tool definition
export const transitionTool: McpTool = {
    name: 'riotplan_transition',
    description: 
        'Move between lifecycle stages (idea → shaping → built → executing → completed, or backwards). ' +
        'Updates LIFECYCLE.md and logs transition to timeline. ' +
        'Allows any transitions without validation.',
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to plan/idea/shaping directory (optional, defaults to current directory)',
            },
            stage: {
                type: 'string',
                description: 'Target stage: idea, shaping, built, executing, completed, cancelled',
            },
            reason: {
                type: 'string',
                description: 'Reason for transitioning',
            },
        },
        required: ['stage', 'reason'],
    },
};

// Tool executor
export async function executeTransition(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const validated = TransitionSchema.parse(args);
        const message = await transitionStage(validated, context);
        return createSuccess({ stage: validated.stage }, message);
    } catch (error) {
        return formatError(error);
    }
}
