/**
 * RiotPlan Tools for CLI Agent
 * 
 * Wraps existing MCP tool implementations as agentic Tools.
 */

import type { Tool } from '@kjerneverk/agentic';
import { wrapMcpTool } from './wrapper.js';

// Import MCP tool definitions
import {
    ideaTool,
} from '../../../mcp/tools/idea.js';

import {
    shapingTool,
} from '../../../mcp/tools/shaping.js';

import { buildTool } from '../../../mcp/tools/build.js';
import { statusTool } from '../../../mcp/tools/status.js';
import { stepTool } from '../../../mcp/tools/step.js';
import { stepReflectTool } from '../../../mcp/tools/reflect.js';
import { transitionTool } from '../../../mcp/tools/transition.js';
import { readContextTool } from '../../../mcp/tools/context.js';
import { checkpointTool, historyShowTool } from '../../../mcp/tools/history.js';
import { validateTool } from '../../../mcp/tools/validate.js';
import { planTool, listPlansTool } from '../../../mcp/tools/switch.js';
import { bindProjectTool, getProjectBindingTool, resolveProjectContextTool } from '../../../mcp/tools/project.js';

// ===== IDEA TOOLS =====

export const rpIdea = wrapMcpTool(ideaTool, { category: 'idea' });

export const ideaTools: Tool[] = [
    rpIdea,
];

// ===== SHAPING TOOLS =====

export const rpShaping = wrapMcpTool(shapingTool, { category: 'shaping' });

export const shapingTools: Tool[] = [
    rpShaping,
];

// ===== BUILD/EXECUTION TOOLS =====

export const rpBuild = wrapMcpTool(buildTool, { category: 'build' });
export const rpStatus = wrapMcpTool(statusTool, { category: 'execution' });
export const rpStep = wrapMcpTool(stepTool, { category: 'execution' });
export const rpStepReflect = wrapMcpTool(stepReflectTool, { category: 'execution' });
export const rpReadContext = wrapMcpTool(readContextTool, { category: 'execution' });

export const buildTools: Tool[] = [
    rpBuild,
];

export const executionTools: Tool[] = [
    rpStatus,
    rpStep,
    rpStepReflect,
    rpReadContext,
];

// ===== UTILITY TOOLS =====

export const rpTransition = wrapMcpTool(transitionTool, { category: 'utility' });
export const rpCheckpoint = wrapMcpTool(checkpointTool, { category: 'utility' });
export const rpHistoryShow = wrapMcpTool(historyShowTool, { category: 'utility' });
export const rpValidate = wrapMcpTool(validateTool, { category: 'utility' });
export const rpPlan = wrapMcpTool(planTool, { category: 'utility' });
export const rpListPlans = wrapMcpTool(listPlansTool, { category: 'utility' });
export const rpBindProject = wrapMcpTool(bindProjectTool, { category: 'utility' });
export const rpGetProjectBinding = wrapMcpTool(getProjectBindingTool, { category: 'utility' });
export const rpResolveProjectContext = wrapMcpTool(resolveProjectContextTool, { category: 'utility' });

export const utilityTools: Tool[] = [
    rpTransition,
    rpCheckpoint,
    rpHistoryShow,
    rpValidate,
    rpPlan,
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
 * - Step management tool: action-based start/complete/add/remove/move
 * - Utility tools: status, context, history, validation
 */
export const exploreRiotPlanTools: Tool[] = [
    ...ideaTools,
    ...shapingTools,
    ...buildTools,
    rpStatus,
    rpStep,
    rpReadContext,
    rpHistoryShow,
    rpValidate,
    rpTransition,
    rpPlan,
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
    rpCheckpoint,
    rpHistoryShow,
];

/**
 * Tools for executing plans
 */
export const executeRiotPlanTools: Tool[] = [
    ...executionTools,
    rpTransition,
    rpCheckpoint,
    rpHistoryShow,
];

// Re-export wrapper utilities
export { wrapMcpTool, wrapMcpTools } from './wrapper.js';
