/**
 * copy_file tool - Copy a file to a new location
 */

import { copyFile as fsCopyFile, mkdir, access } from 'node:fs/promises';
import { resolve, isAbsolute, dirname } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

export interface CopyFileParams {
    source: string;
    destination: string;
    create_directories?: boolean;
    overwrite?: boolean;
}

export async function copyFileImpl(
    params: CopyFileParams,
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

    // Check destination doesn't already exist (unless overwrite is true)
    if (!params.overwrite) {
        try {
            await access(destPath);
            throw new Error(`Destination already exists: ${destPath}. Set overwrite: true to replace.`);
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('Destination already exists')) {
                throw err;
            }
            // File doesn't exist, which is what we want
        }
    }

    // Create parent directories if requested
    if (params.create_directories !== false) {
        await mkdir(dirname(destPath), { recursive: true });
    }

    await fsCopyFile(sourcePath, destPath);
    
    return `File copied: ${sourcePath} → ${destPath}`;
}

export const copyFileTool: Tool = {
    name: 'copy_file',
    description: 'Copy a file to a new location. By default, fails if the destination already exists. Set overwrite: true to replace existing files. Parent directories are created automatically.',
    parameters: {
        type: 'object',
        properties: {
            source: {
                type: 'string',
                description: 'Path of the source file to copy (absolute or relative to working directory)',
            },
            destination: {
                type: 'string',
                description: 'Path for the copy (absolute or relative to working directory)',
            },
            create_directories: {
                type: 'boolean',
                description: 'Whether to create parent directories if they do not exist (default: true)',
            },
            overwrite: {
                type: 'boolean',
                description: 'Whether to overwrite if destination exists (default: false)',
            },
        },
        required: ['source', 'destination'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: CopyFileParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return copyFileImpl(params, workingDirectory);
    },
};
