/**
 * rename_file tool - Rename or move a file
 */

import { rename, mkdir, access } from 'node:fs/promises';
import { resolve, isAbsolute, dirname } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

export interface RenameFileParams {
    source: string;
    destination: string;
    create_directories?: boolean;
}

export async function renameFileImpl(
    params: RenameFileParams,
    workingDirectory: string
): Promise<string> {
    const sourcePath = isAbsolute(params.source) 
        ? params.source 
        : resolve(workingDirectory, params.source);

    const destPath = isAbsolute(params.destination) 
        ? params.destination 
        : resolve(workingDirectory, params.destination);

    // Check source exists
    try {
        await access(sourcePath);
    } catch {
        throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Check destination doesn't already exist
    try {
        await access(destPath);
        throw new Error(`Destination already exists: ${destPath}`);
    } catch (err) {
        // If the error is our "already exists" error, re-throw it
        if (err instanceof Error && err.message.startsWith('Destination already exists')) {
            throw err;
        }
        // Otherwise, file doesn't exist, which is what we want
    }

    // Create parent directories if requested
    if (params.create_directories !== false) {
        await mkdir(dirname(destPath), { recursive: true });
    }

    await rename(sourcePath, destPath);
    
    return `File renamed: ${sourcePath} → ${destPath}`;
}

export const renameFileTool: Tool = {
    name: 'rename_file',
    description: 'Rename or move a file from one path to another. Fails if the destination already exists. Parent directories are created automatically.',
    parameters: {
        type: 'object',
        properties: {
            source: {
                type: 'string',
                description: 'Current path of the file (absolute or relative to working directory)',
            },
            destination: {
                type: 'string',
                description: 'New path for the file (absolute or relative to working directory)',
            },
            create_directories: {
                type: 'boolean',
                description: 'Whether to create parent directories if they do not exist (default: true)',
            },
        },
        required: ['source', 'destination'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: RenameFileParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return renameFileImpl(params, workingDirectory);
    },
};
