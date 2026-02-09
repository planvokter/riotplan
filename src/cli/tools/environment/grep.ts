/**
 * grep tool - Search file contents using ripgrep
 */

import { spawn } from 'node:child_process';
import { resolve, isAbsolute } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

const MAX_RESULTS = 100;

export interface GrepParams {
    pattern: string;
    path?: string;
    case_insensitive?: boolean;
    max_results?: number;
    file_pattern?: string;
    context_lines?: number;
}

export interface GrepMatch {
    file: string;
    line: number;
    content: string;
}

export async function grepImpl(
    params: GrepParams,
    workingDirectory: string
): Promise<string> {
    const targetPath = params.path 
        ? (isAbsolute(params.path) ? params.path : resolve(workingDirectory, params.path))
        : workingDirectory;

    const maxResults = Math.min(params.max_results || MAX_RESULTS, MAX_RESULTS);

    // Build ripgrep command
    const args: string[] = [
        '--line-number',
        '--no-heading',
        '--color=never',
        `--max-count=${maxResults}`,
    ];

    if (params.case_insensitive) {
        args.push('--ignore-case');
    }

    if (params.file_pattern) {
        args.push('--glob', params.file_pattern);
    }

    if (params.context_lines) {
        args.push(`--context=${params.context_lines}`);
    }

    // Add common ignores
    args.push('--glob', '!node_modules');
    args.push('--glob', '!.git');
    args.push('--glob', '!dist');
    args.push('--glob', '!build');
    args.push('--glob', '!coverage');

    args.push(params.pattern, targetPath);

    return new Promise((resolve, reject) => {
        const rg = spawn('rg', args);
        let stdout = '';
        let stderr = '';

        rg.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        rg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        rg.on('close', (code) => {
            if (code === 0) {
                // Format output
                const lines = stdout.trim().split('\n').filter(Boolean);
                if (lines.length === 0) {
                    resolve('No matches found');
                } else {
                    resolve(lines.join('\n'));
                }
            } else if (code === 1) {
                // No matches found (normal exit)
                resolve('No matches found');
            } else {
                // Try fallback to grep if rg not available
                reject(new Error(`ripgrep failed: ${stderr || 'unknown error'}`));
            }
        });

        rg.on('error', (err) => {
            // ripgrep not installed, try native grep
            reject(new Error(`ripgrep not available: ${err.message}. Please install ripgrep (rg).`));
        });
    });
}

export const grepTool: Tool = {
    name: 'grep',
    description: 'Search for patterns in files using ripgrep. Returns matching lines with file paths and line numbers. Fast and respects .gitignore.',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Search pattern (supports regex)',
            },
            path: {
                type: 'string',
                description: 'Directory or file to search (defaults to working directory)',
            },
            case_insensitive: {
                type: 'boolean',
                description: 'Case-insensitive search (default: false)',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results (default: 100, max: 100)',
            },
            file_pattern: {
                type: 'string',
                description: 'Glob pattern to filter files (e.g., "*.ts", "*.md")',
            },
            context_lines: {
                type: 'number',
                description: 'Number of context lines before and after each match',
            },
        },
        required: ['pattern'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: GrepParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return grepImpl(params, workingDirectory);
    },
};
