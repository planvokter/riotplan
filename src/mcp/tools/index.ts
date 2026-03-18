/**
 * MCP Tool Definitions and Executors
 *
 * Provides MCP tool interfaces for riotplan commands
 */

import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';

// Import all tool definitions (no execute functions needed - they're on the tool objects)
import { statusTool } from './status.js';
import {
    stepTool,
} from './step.js';
import { validateTool } from './validate.js';
import { generateTool } from './generate.js';
import {
    ideaTool,
} from './idea.js';
import {
    shapingTool,
} from './shaping.js';
import {
    checkpointTool,
    historyShowTool,
} from './history.js';
import { transitionTool } from './transition.js';
import { buildTool } from './build.js';
import { buildApplyTool, buildValidatePlanTool, buildWriteArtifactTool, buildWriteStepTool } from './build-write.js';
import { generateRuleTool } from './generate-rule.js';
import { readContextTool } from './context.js';
import { contextEntityTool } from './context-entity.js';
import { evidenceTool } from './evidence.js';
import {
    catalystTool,
} from './catalyst.js';
import { stepReflectTool } from './reflect.js';
import { generateRetrospectiveTool } from './retrospective.js';
import { backfillManifestsTool } from './backfill-manifests.js';
import { planTool, listPlansTool, deletePlanTool } from './switch.js';
import { bindProjectTool, getProjectBindingTool, resolveProjectContextTool } from './project.js';

/**
 * Tool definitions array
 */
export const tools: McpTool[] = [
    statusTool,
    stepTool,
    validateTool,
    generateTool,
    // Idea tools
    ideaTool,
    // Shaping tools
    shapingTool,
    // History and checkpoint tools
    checkpointTool,
    historyShowTool,
    // Transition tool
    transitionTool,
    // Build tool
    buildTool,
    buildApplyTool,
    buildValidatePlanTool,
    buildWriteArtifactTool,
    buildWriteStepTool,
    // Generate rule tool
    generateRuleTool,
    // Context tool
    readContextTool,
    contextEntityTool,
    // Structured evidence writer
    evidenceTool,
    // Catalyst tools
    catalystTool,
    // Reflection tool
    stepReflectTool,
    // Retrospective tool
    generateRetrospectiveTool,
    // Backfill tool
    backfillManifestsTool,
    // Plan switching tools
    planTool,
    listPlansTool,
    deletePlanTool,
    // Project binding tools
    bindProjectTool,
    getProjectBindingTool,
    resolveProjectContextTool,
];

/**
 * Tool map for fast lookup by name
 */
const toolMap = new Map<string, McpTool>(
    tools.map(tool => [tool.name, tool])
);

/**
 * Base tool executor - wraps command logic
 * Uses Map-based lookup instead of switch statement
 */
export async function executeTool(
    toolName: string,
    args: Record<string, any>,
    context: ToolExecutionContext
): Promise<ToolResult> {
    const tool = toolMap.get(toolName);
    if (!tool) {
        return {
            success: false,
            error: `Unknown tool: ${toolName}`,
        };
    }
    
    try {
        return await tool.execute(args, context);
    } catch (error: any) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            context: {
                errorType: error?.constructor?.name || 'Error',
            },
        };
    }
}
