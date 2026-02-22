/**
 * RiotPlan Tools for CLI Agent
 * 
 * Wraps existing MCP tool implementations as agentic Tools.
 */

import type { Tool } from '@kjerneverk/agentic';
import { wrapMcpTool } from './wrapper.js';

// Import MCP tool definitions
import {
    ideaCreateTool,
    ideaAddNoteTool,
    ideaAddConstraintTool,
    ideaAddQuestionTool,
    ideaAddEvidenceTool,
    ideaAddNarrativeTool,
    ideaKillTool,
} from '../../../mcp/tools/idea.js';

import {
    shapingStartTool,
    shapingAddApproachTool,
    shapingAddFeedbackTool,
    shapingAddEvidenceTool,
    shapingCompareTool,
    shapingSelectTool,
} from '../../../mcp/tools/shaping.js';

import { buildTool } from '../../../mcp/tools/build.js';
import { statusTool } from '../../../mcp/tools/status.js';
import { stepStartTool, stepCompleteTool, stepAddTool, stepListTool, stepRemoveTool, stepMoveTool } from '../../../mcp/tools/step.js';
import { stepReflectTool } from '../../../mcp/tools/reflect.js';
import { transitionTool } from '../../../mcp/tools/transition.js';
import { readContextTool } from '../../../mcp/tools/context.js';
import { checkpointCreateTool, checkpointListTool, historyShowTool } from '../../../mcp/tools/history.js';
import { validateTool } from '../../../mcp/tools/validate.js';
import { switchPlanTool, listPlansTool } from '../../../mcp/tools/switch.js';
import { bindProjectTool, getProjectBindingTool, resolveProjectContextTool } from '../../../mcp/tools/project.js';

// ===== IDEA TOOLS =====

export const rpIdeaCreate = wrapMcpTool(ideaCreateTool, { category: 'idea' });
export const rpIdeaAddNote = wrapMcpTool(ideaAddNoteTool, { category: 'idea' });
export const rpIdeaAddConstraint = wrapMcpTool(ideaAddConstraintTool, { category: 'idea' });
export const rpIdeaAddQuestion = wrapMcpTool(ideaAddQuestionTool, { category: 'idea' });
export const rpIdeaAddEvidence = wrapMcpTool(ideaAddEvidenceTool, { category: 'idea' });
export const rpIdeaAddNarrative = wrapMcpTool(ideaAddNarrativeTool, { category: 'idea' });
export const rpIdeaKill = wrapMcpTool(ideaKillTool, { category: 'idea' });

export const ideaTools: Tool[] = [
    rpIdeaCreate,
    rpIdeaAddNote,
    rpIdeaAddConstraint,
    rpIdeaAddQuestion,
    rpIdeaAddEvidence,
    rpIdeaAddNarrative,
    rpIdeaKill,
];

// ===== SHAPING TOOLS =====

export const rpShapingStart = wrapMcpTool(shapingStartTool, { category: 'shaping' });
export const rpShapingAddApproach = wrapMcpTool(shapingAddApproachTool, { category: 'shaping' });
export const rpShapingAddFeedback = wrapMcpTool(shapingAddFeedbackTool, { category: 'shaping' });
export const rpShapingAddEvidence = wrapMcpTool(shapingAddEvidenceTool, { category: 'shaping' });
export const rpShapingCompare = wrapMcpTool(shapingCompareTool, { category: 'shaping' });
export const rpShapingSelect = wrapMcpTool(shapingSelectTool, { category: 'shaping' });

export const shapingTools: Tool[] = [
    rpShapingStart,
    rpShapingAddApproach,
    rpShapingAddFeedback,
    rpShapingAddEvidence,
    rpShapingCompare,
    rpShapingSelect,
];

// ===== BUILD/EXECUTION TOOLS =====

export const rpBuild = wrapMcpTool(buildTool, { category: 'build' });
export const rpStatus = wrapMcpTool(statusTool, { category: 'execution' });
export const rpStepStart = wrapMcpTool(stepStartTool, { category: 'execution' });
export const rpStepComplete = wrapMcpTool(stepCompleteTool, { category: 'execution' });
export const rpStepAdd = wrapMcpTool(stepAddTool, { category: 'execution' });
export const rpStepRemove = wrapMcpTool(stepRemoveTool, { category: 'execution' });
export const rpStepMove = wrapMcpTool(stepMoveTool, { category: 'execution' });
export const rpStepList = wrapMcpTool(stepListTool, { category: 'execution' });
export const rpStepReflect = wrapMcpTool(stepReflectTool, { category: 'execution' });
export const rpReadContext = wrapMcpTool(readContextTool, { category: 'execution' });

export const buildTools: Tool[] = [
    rpBuild,
];

export const executionTools: Tool[] = [
    rpStatus,
    rpStepStart,
    rpStepComplete,
    rpStepAdd,
    rpStepRemove,
    rpStepMove,
    rpStepList,
    rpStepReflect,
    rpReadContext,
];

// ===== UTILITY TOOLS =====

export const rpTransition = wrapMcpTool(transitionTool, { category: 'utility' });
export const rpCheckpointCreate = wrapMcpTool(checkpointCreateTool, { category: 'utility' });
export const rpCheckpointList = wrapMcpTool(checkpointListTool, { category: 'utility' });
export const rpHistoryShow = wrapMcpTool(historyShowTool, { category: 'utility' });
export const rpValidate = wrapMcpTool(validateTool, { category: 'utility' });
export const rpSwitchPlan = wrapMcpTool(switchPlanTool, { category: 'utility' });
export const rpListPlans = wrapMcpTool(listPlansTool, { category: 'utility' });
export const rpBindProject = wrapMcpTool(bindProjectTool, { category: 'utility' });
export const rpGetProjectBinding = wrapMcpTool(getProjectBindingTool, { category: 'utility' });
export const rpResolveProjectContext = wrapMcpTool(resolveProjectContextTool, { category: 'utility' });

export const utilityTools: Tool[] = [
    rpTransition,
    rpCheckpointCreate,
    rpCheckpointList,
    rpHistoryShow,
    rpValidate,
    rpSwitchPlan,
    rpListPlans,
    rpBindProject,
    rpGetProjectBinding,
    rpResolveProjectContext,
];

// ===== COMBINED TOOL SETS =====

/**
 * All RiotPlan tools
 */
export const allRiotPlanTools: Tool[] = [
    ...ideaTools,
    ...shapingTools,
    ...buildTools,
    ...executionTools,
    ...utilityTools,
];

/**
 * Tools for idea exploration and shaping (can progress through idea → shaping → build)
 * 
 * Includes:
 * - Idea tools: create, add notes/constraints/questions/evidence
 * - Shaping tools: start shaping, add approaches, compare, select
 * - Build tool: generate detailed plan from shaped idea
 * - Step management tools: add, remove, move, list steps
 * - Utility tools: status, context, history, validation
 */
export const exploreRiotPlanTools: Tool[] = [
    ...ideaTools,
    ...shapingTools,
    ...buildTools,
    rpStatus,
    rpStepAdd,
    rpStepRemove,
    rpStepMove,
    rpStepList,
    rpReadContext,
    rpHistoryShow,
    rpValidate,
    rpTransition,
    rpSwitchPlan,
    rpListPlans,
    rpBindProject,
    rpGetProjectBinding,
    rpResolveProjectContext,
];

/**
 * Tools for building plans
 */
export const buildRiotPlanTools: Tool[] = [
    ...shapingTools,
    ...buildTools,
    rpStatus,
    rpReadContext,
    rpTransition,
    rpCheckpointCreate,
    rpHistoryShow,
];

/**
 * Tools for executing plans
 */
export const executeRiotPlanTools: Tool[] = [
    ...executionTools,
    rpTransition,
    rpCheckpointCreate,
    rpHistoryShow,
];

// Re-export wrapper utilities
export { wrapMcpTool, wrapMcpTools } from './wrapper.js';
