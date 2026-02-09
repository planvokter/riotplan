/**
 * MCP Tool Definitions and Executors
 *
 * Provides MCP tool interfaces for riotplan commands
 */

import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';

// Import all tool definitions (no execute functions needed - they're on the tool objects)
import { createTool } from './create.js';
import { statusTool } from './status.js';
import {
    stepListTool,
    stepStartTool,
    stepCompleteTool,
    stepAddTool,
} from './step.js';
import { validateTool } from './validate.js';
import { generateTool } from './generate.js';
import {
    ideaCreateTool,
    ideaAddNoteTool,
    ideaAddConstraintTool,
    ideaAddQuestionTool,
    ideaAddEvidenceTool,
    ideaAddNarrativeTool,
    ideaKillTool,
} from './idea.js';
import {
    shapingStartTool,
    shapingAddApproachTool,
    shapingAddFeedbackTool,
    shapingAddEvidenceTool,
    shapingCompareTool,
    shapingSelectTool,
} from './shaping.js';
import {
    checkpointCreateTool,
    checkpointListTool,
    checkpointShowTool,
    checkpointRestoreTool,
    historyShowTool,
} from './history.js';
import { transitionTool } from './transition.js';
import { buildTool } from './build.js';
import { generateRuleTool } from './generate-rule.js';
import { readContextTool } from './context.js';
import {
    catalystListTool,
    catalystShowTool,
    catalystAssociateTool,
} from './catalyst.js';
import { stepReflectTool } from './reflect.js';
import { generateRetrospectiveTool } from './retrospective.js';
import { backfillManifestsTool } from './backfill-manifests.js';

/**
 * Tool definitions array
 */
export const tools: McpTool[] = [
    createTool,
    statusTool,
    stepListTool,
    stepStartTool,
    stepCompleteTool,
    stepAddTool,
    validateTool,
    generateTool,
    // Idea tools
    ideaCreateTool,
    ideaAddNoteTool,
    ideaAddConstraintTool,
    ideaAddQuestionTool,
    ideaAddEvidenceTool,
    ideaAddNarrativeTool,
    ideaKillTool,
    // Shaping tools
    shapingStartTool,
    shapingAddApproachTool,
    shapingAddFeedbackTool,
    shapingAddEvidenceTool,
    shapingCompareTool,
    shapingSelectTool,
    // History and checkpoint tools
    checkpointCreateTool,
    checkpointListTool,
    checkpointShowTool,
    checkpointRestoreTool,
    historyShowTool,
    // Transition tool
    transitionTool,
    // Build tool
    buildTool,
    // Generate rule tool
    generateRuleTool,
    // Context tool
    readContextTool,
    // Catalyst tools
    catalystListTool,
    catalystShowTool,
    catalystAssociateTool,
    // Reflection tool
    stepReflectTool,
    // Retrospective tool
    generateRetrospectiveTool,
    // Backfill tool
    backfillManifestsTool,
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
