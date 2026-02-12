/**
 * delete_file tool - Delete a file or directory
 */

import { rm, access, stat } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

export interface DeleteFileParams {
    path: string;
    recursive?: boolean;
}

export async function deleteFileImpl(
    params: DeleteFileParams,
    workingDirectory: string
): Promise<string> {
    const filePath = isAbsolute(params.path) 
        ? params.path 
        : resolve(workingDirectory, params.path);

    // Check path exists
    try {
        await access(filePath);
    } catch {
        throw new Error(`Path not found: ${filePath}`);
    }

    // Check if it's a directory
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
        if (!params.recursive) {
            throw new Error(
                `Path is a directory: ${filePath}. Set recursive: true to delete directories.`
            );
        }
        await rm(filePath, { recursive: true });
        return `Directory deleted: ${filePath}`;
    }

    await rm(filePath);
    return `File deleted: ${filePath}`;
}

export const deleteFileTool: Tool = {
    name: 'delete_file',
    description: 'Delete a file or directory. For directories, set recursive: true. Fails if the path does not exist.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file or directory to delete (absolute or relative to working directory)',
            },
            recursive: {
                type: 'boolean',
                description: 'Whether to recursively delete directories (default: false, required for directories)',
            },
        },
        required: ['path'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: DeleteFileParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return deleteFileImpl(params, workingDirectory);
    },
};
