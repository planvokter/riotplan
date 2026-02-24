/**
 * MCP tool for lifecycle stage transitions
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { formatTimestamp, resolveDirectory, formatError, createSuccess } from "./shared.js";
import { logEvent } from "./history.js";
import type { McpTool, ToolResult, ToolExecutionContext } from "../types.js";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";

// Tool schema
export const TransitionSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    stage: z.string().describe("Target stage (idea, shaping, built, executing, completed, cancelled)"),
    reason: z.string().describe("Reason for transitioning"),
});

// Tool implementation
export async function transitionStage(args: z.infer<typeof TransitionSchema>, context: ToolExecutionContext): Promise<string> {
    const planPath = resolveDirectory(args, context);
    if (planPath.endsWith(".plan")) {
        const provider = createSqliteProvider(planPath);
        const metadataResult = await provider.getMetadata();
        if (!metadataResult.success || !metadataResult.data) {
            await provider.close();
            throw new Error(metadataResult.error || "Failed to load plan metadata");
        }

        const currentStage = metadataResult.data.stage;
        if (!args.stage || args.stage.trim() === "") {
            await provider.close();
            throw new Error("Target stage cannot be empty");
        }
        if (currentStage === args.stage) {
            await provider.close();
            return `Already at stage '${args.stage}'. No transition needed.`;
        }

        const timestamp = formatTimestamp();
        const updateResult = await provider.updateMetadata({
            stage: args.stage as any,
            updatedAt: timestamp,
        });
        if (!updateResult.success) {
            await provider.close();
            throw new Error(updateResult.error || "Failed to update lifecycle stage");
        }

        await provider.addTimelineEvent({
            id: randomUUID(),
            timestamp,
            type: "stage_transition",
            data: {
                from: currentStage,
                to: args.stage,
                reason: args.reason,
            },
        });
        await provider.close();

        return `✅ Transitioned from '${currentStage}' to '${args.stage}'\n\nReason: ${args.reason}`;
    }

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

// Tool executor
async function executeTransition(
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

// MCP Tool definition
export const transitionTool: McpTool = {
    name: 'riotplan_transition',
    description: 
        'Move between lifecycle stages (idea → shaping → built → executing → completed, or backwards). ' +
        'Updates LIFECYCLE.md and logs transition to timeline. ' +
        'Allows any transitions without validation.',
    schema: {
        planId: z.string().optional().describe('Plan identifier (optional, defaults to current plan context)'),
        stage: z.string().describe('Target stage: idea, shaping, built, executing, completed, cancelled'),
        reason: z.string().describe('Reason for transitioning'),
    },
    execute: executeTransition,
};
