/**
 * read_file tool - Read file contents with optional line range
 */

import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

const MAX_FILE_SIZE = 100 * 1024; // 100KB default limit

export interface ReadFileParams {
    path: string;
    start_line?: number;
    num_lines?: number;
}

export async function readFileImpl(
    params: ReadFileParams,
    workingDirectory: string
): Promise<string> {
    const filePath = isAbsolute(params.path) 
        ? params.path 
        : resolve(workingDirectory, params.path);

    let content: string;
    try {
        content = await readFile(filePath, 'utf-8');
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return `File not found: ${params.path}`;
        }
        if (err.code === 'EISDIR') {
            return `"${params.path}" is a directory. Use list_files to explore directories.`;
        }
        if (err.code === 'EACCES') {
            return `Permission denied: ${params.path}`;
        }
        throw err;
    }
    
    // Check size limit
    if (content.length > MAX_FILE_SIZE) {
        // If no line range specified, return truncated with warning
        if (!params.start_line && !params.num_lines) {
            return `[File truncated - ${content.length} bytes, showing first ${MAX_FILE_SIZE} bytes]\n\n${content.slice(0, MAX_FILE_SIZE)}`;
        }
    }

    // Apply line range if specified
    if (params.start_line !== undefined || params.num_lines !== undefined) {
        const lines = content.split('\n');
        const startLine = Math.max(0, (params.start_line || 1) - 1);
        const numLines = params.num_lines || lines.length;
        const endLine = Math.min(lines.length, startLine + numLines);
        
        const selectedLines = lines.slice(startLine, endLine);
        
        // Add line numbers for context
        return selectedLines
            .map((line, idx) => `${startLine + idx + 1}|${line}`)
            .join('\n');
    }

    return content;
}

export const readFileTool: Tool = {
    name: 'read_file',
    description: 'Read the contents of a file. Can optionally read a specific range of lines. Returns file content with line numbers when a range is specified.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file to read (absolute or relative to working directory)',
            },
            start_line: {
                type: 'number',
                description: 'Starting line number (1-indexed). If omitted, starts from beginning.',
            },
            num_lines: {
                type: 'number',
                description: 'Number of lines to read. If omitted, reads to end of file.',
            },
        },
        required: ['path'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: ReadFileParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return readFileImpl(params, workingDirectory);
    },
};
