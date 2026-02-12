/**
 * CLI Tools Index
 * 
 * Defines tool sets for each CLI command.
 */

import type { Tool } from '@kjerneverk/agentic';

// Environment tools
export {
    readFileTool,
    listFilesTool,
    grepTool,
    runCommandTool,
    writeFileTool,
    editFileTool,
    renameFileTool,
    copyFileTool,
    deleteFileTool,
    environmentTools,
    readOnlyEnvironmentTools,
    writeEnvironmentTools,
} from './environment/index.js';

// RiotPlan tools
export {
    ideaTools,
    shapingTools,
    buildTools,
    executionTools,
    utilityTools,
    allRiotPlanTools,
    exploreRiotPlanTools,
    buildRiotPlanTools,
    executeRiotPlanTools,
    wrapMcpTool,
    wrapMcpTools,
} from './riotplan/index.js';

// Import for tool set composition
import { readOnlyEnvironmentTools, environmentTools } from './environment/index.js';
import { 
    exploreRiotPlanTools, 
    buildRiotPlanTools, 
    executeRiotPlanTools,
    allRiotPlanTools,
} from './riotplan/index.js';

// ===== COMMAND-SPECIFIC TOOL SETS =====

/**
 * Tool set for `riotplan explore` command
 * 
 * Full environment access + idea exploration and step management tools.
 * Includes file write, rename, copy, delete, and shell commands so the
 * agent can create/reorganize plan files, step files, and project structure.
 */
export const exploreToolSet: Tool[] = [
    ...environmentTools,
    ...exploreRiotPlanTools,
];

/**
 * Tool set for `riotplan build` command
 * 
 * Read-only file access + shaping and build tools.
 * Can create plan files but not arbitrary file writes.
 */
export const buildToolSet: Tool[] = [
    ...readOnlyEnvironmentTools,
    ...buildRiotPlanTools,
];

/**
 * Tool set for `riotplan execute` command
 * 
 * Full file access + execution tools + shell commands.
 * Can modify files as needed during plan execution.
 */
export const executeToolSet: Tool[] = [
    ...environmentTools,
    ...executeRiotPlanTools,
];

/**
 * Tool set for `riotplan chat` command
 * 
 * Everything - full environment access + all RiotPlan tools.
 * Maximum flexibility for general conversation.
 */
export const chatToolSet: Tool[] = [
    ...environmentTools,
    ...allRiotPlanTools,
];

/**
 * Get tool set by command name
 */
export function getToolSetForCommand(command: 'explore' | 'build' | 'execute' | 'chat'): Tool[] {
    switch (command) {
        case 'explore':
            return exploreToolSet;
        case 'build':
            return buildToolSet;
        case 'execute':
            return executeToolSet;
        case 'chat':
            return chatToolSet;
        default:
            return chatToolSet;
    }
}

/**
 * Check if a tool set includes write capabilities
 */
export function hasWriteCapabilities(tools: Tool[]): boolean {
    const writeToolNames = ['write_file', 'edit_file', 'rename_file', 'copy_file', 'delete_file', 'run_command'];
    return tools.some(tool => writeToolNames.includes(tool.name));
}

/**
 * Get tool names from a tool set
 */
export function getToolNames(tools: Tool[]): string[] {
    return tools.map(tool => tool.name);
}
