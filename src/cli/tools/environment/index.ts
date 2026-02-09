/**
 * Environment Tools
 * 
 * File system and shell tools for the CLI agent.
 */

export { readFileTool, readFileImpl, type ReadFileParams } from './read-file.js';
export { listFilesTool, listFilesImpl, type ListFilesParams } from './list-files.js';
export { grepTool, grepImpl, type GrepParams } from './grep.js';
export { runCommandTool, runCommandImpl, type RunCommandParams } from './run-command.js';
export { writeFileTool, writeFileImpl, type WriteFileParams } from './write-file.js';
export { editFileTool, editFileImpl, type EditFileParams } from './edit-file.js';

import { readFileTool } from './read-file.js';
import { listFilesTool } from './list-files.js';
import { grepTool } from './grep.js';
import { runCommandTool } from './run-command.js';
import { writeFileTool } from './write-file.js';
import { editFileTool } from './edit-file.js';

/**
 * All environment tools
 */
export const environmentTools = [
    readFileTool,
    listFilesTool,
    grepTool,
    runCommandTool,
    writeFileTool,
    editFileTool,
];

/**
 * Read-only environment tools (no file modification)
 */
export const readOnlyEnvironmentTools = [
    readFileTool,
    listFilesTool,
    grepTool,
];

/**
 * Write-capable environment tools
 */
export const writeEnvironmentTools = [
    writeFileTool,
    editFileTool,
];
