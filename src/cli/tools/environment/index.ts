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
export { renameFileTool, renameFileImpl, type RenameFileParams } from './rename-file.js';
export { copyFileTool, copyFileImpl, type CopyFileParams } from './copy-file.js';
export { deleteFileTool, deleteFileImpl, type DeleteFileParams } from './delete-file.js';
export { fileOutlineTool, fileOutlineImpl, type FileOutlineParams } from './file-outline.js';
export { findSymbolTool, findSymbolImpl, type FindSymbolParams } from './find-symbol.js';
export { 
    indexProjectTool, 
    indexProjectImpl, 
    queryIndexTool, 
    queryIndexImpl,
    type IndexProjectParams,
    type QueryIndexParams,
} from './project-index.js';

import { readFileTool } from './read-file.js';
import { listFilesTool } from './list-files.js';
import { grepTool } from './grep.js';
import { runCommandTool } from './run-command.js';
import { writeFileTool } from './write-file.js';
import { editFileTool } from './edit-file.js';
import { renameFileTool } from './rename-file.js';
import { copyFileTool } from './copy-file.js';
import { deleteFileTool } from './delete-file.js';
import { fileOutlineTool } from './file-outline.js';
import { findSymbolTool } from './find-symbol.js';
import { indexProjectTool, queryIndexTool } from './project-index.js';

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
    renameFileTool,
    copyFileTool,
    deleteFileTool,
    fileOutlineTool,
    findSymbolTool,
    indexProjectTool,
    queryIndexTool,
];

/**
 * Read-only environment tools (no file modification)
 */
export const readOnlyEnvironmentTools = [
    readFileTool,
    listFilesTool,
    grepTool,
    fileOutlineTool,
    findSymbolTool,
    indexProjectTool,
    queryIndexTool,
];

/**
 * Write-capable environment tools
 */
export const writeEnvironmentTools = [
    writeFileTool,
    editFileTool,
    renameFileTool,
    copyFileTool,
    deleteFileTool,
];
