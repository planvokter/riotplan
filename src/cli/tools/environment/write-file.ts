/**
 * write_file tool - Write or overwrite file contents
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, isAbsolute, dirname } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

export interface WriteFileParams {
    path: string;
    content: string;
    create_directories?: boolean;
}

export async function writeFileImpl(
    params: WriteFileParams,
    workingDirectory: string
): Promise<string> {
    const filePath = isAbsolute(params.path) 
        ? params.path 
        : resolve(workingDirectory, params.path);

    // Create parent directories if requested
    if (params.create_directories !== false) {
        await mkdir(dirname(filePath), { recursive: true });
    }

    await writeFile(filePath, params.content, 'utf-8');
    
    return `File written: ${filePath} (${params.content.length} bytes)`;
}

export const writeFileTool: Tool = {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist, or overwrites if it does. Parent directories are created automatically.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file to write (absolute or relative to working directory)',
            },
            content: {
                type: 'string',
                description: 'Content to write to the file',
            },
            create_directories: {
                type: 'boolean',
                description: 'Whether to create parent directories if they do not exist (default: true)',
            },
        },
        required: ['path', 'content'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: WriteFileParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return writeFileImpl(params, workingDirectory);
    },
};
