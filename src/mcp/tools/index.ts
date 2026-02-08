/**
 * MCP Tool Definitions and Executors
 *
 * Provides MCP tool interfaces for riotplan commands
 */

import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';

// Import all tools
import { createTool, executeCreate } from './create.js';
import { statusTool, executeStatus } from './status.js';
import {
    stepListTool,
    stepStartTool,
    stepCompleteTool,
    stepAddTool,
    executeStepList,
    executeStepStart,
    executeStepComplete,
    executeStepAdd,
} from './step.js';
import { validateTool, executeValidate } from './validate.js';
import { generateTool, executeGenerate } from './generate.js';
import {
    ideaCreateTool,
    ideaAddNoteTool,
    ideaAddConstraintTool,
    ideaAddQuestionTool,
    ideaAddEvidenceTool,
    ideaAddNarrativeTool,
    ideaKillTool,
    executeIdeaCreate,
    executeIdeaAddNote,
    executeIdeaAddConstraint,
    executeIdeaAddQuestion,
    executeIdeaAddEvidence,
    executeIdeaAddNarrative,
    executeIdeaKill,
} from './idea.js';
import {
    shapingStartTool,
    shapingAddApproachTool,
    shapingAddFeedbackTool,
    shapingAddEvidenceTool,
    shapingCompareTool,
    shapingSelectTool,
    executeShapingStart,
    executeShapingAddApproach,
    executeShapingAddFeedback,
    executeShapingAddEvidence,
    executeShapingCompare,
    executeShapingSelect,
} from './shaping.js';
import {
    checkpointCreateTool,
    checkpointListTool,
    checkpointShowTool,
    checkpointRestoreTool,
    historyShowTool,
    executeCheckpointCreate,
    executeCheckpointList,
    executeCheckpointShow,
    executeCheckpointRestore,
    executeHistoryShow,
} from './history.js';
import {
    transitionTool,
    executeTransition,
} from './transition.js';
import {
    buildTool,
    executeBuild,
} from './build.js';
import {
    generateRuleTool,
    executeGenerateRule,
} from './generate-rule.js';

/**
 * Base tool executor - wraps command logic
 */
export async function executeTool(
    toolName: string,
    args: Record<string, any>,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        // Route to specific tool handler
        switch (toolName) {
            case 'riotplan_create':
                return await executeCreate(args, context);
            case 'riotplan_status':
                return await executeStatus(args, context);
            case 'riotplan_step_list':
                return await executeStepList(args, context);
            case 'riotplan_step_start':
                return await executeStepStart(args, context);
            case 'riotplan_step_complete':
                return await executeStepComplete(args, context);
            case 'riotplan_step_add':
                return await executeStepAdd(args, context);
            case 'riotplan_validate':
                return await executeValidate(args, context);
            case 'riotplan_generate':
                return await executeGenerate(args, context);
            // Idea tools
            case 'riotplan_idea_create':
                return await executeIdeaCreate(args, context);
            case 'riotplan_idea_add_note':
                return await executeIdeaAddNote(args, context);
            case 'riotplan_idea_add_constraint':
                return await executeIdeaAddConstraint(args, context);
            case 'riotplan_idea_add_question':
                return await executeIdeaAddQuestion(args, context);
            case 'riotplan_idea_add_evidence':
                return await executeIdeaAddEvidence(args, context);
            case 'riotplan_idea_add_narrative':
                return await executeIdeaAddNarrative(args, context);
            case 'riotplan_idea_kill':
                return await executeIdeaKill(args, context);
            // Shaping tools
            case 'riotplan_shaping_start':
                return await executeShapingStart(args, context);
            case 'riotplan_shaping_add_approach':
                return await executeShapingAddApproach(args, context);
            case 'riotplan_shaping_add_feedback':
                return await executeShapingAddFeedback(args, context);
            case 'riotplan_shaping_add_evidence':
                return await executeShapingAddEvidence(args, context);
            case 'riotplan_shaping_compare':
                return await executeShapingCompare(args, context);
            case 'riotplan_shaping_select':
                return await executeShapingSelect(args, context);
            // History and checkpoint tools
            case 'riotplan_checkpoint_create':
                return await executeCheckpointCreate(args, context);
            case 'riotplan_checkpoint_list':
                return await executeCheckpointList(args, context);
            case 'riotplan_checkpoint_show':
                return await executeCheckpointShow(args, context);
            case 'riotplan_checkpoint_restore':
                return await executeCheckpointRestore(args, context);
            case 'riotplan_history_show':
                return await executeHistoryShow(args, context);
            // Transition tool
            case 'riotplan_transition':
                return await executeTransition(args, context);
            // Build tool
            case 'riotplan_build':
                return await executeBuild(args, context);
            // Generate rule tool
            case 'riotplan_generate_rule':
                return await executeGenerateRule(args, context);
            default:
                return {
                    success: false,
                    error: `Unknown tool: ${toolName}`,
                };
        }
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
];
