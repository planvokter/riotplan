/**
 * grep tool - Search file contents using ripgrep (with native grep fallback)
 */

import { spawn, spawnSync } from 'node:child_process';
import { resolve, isAbsolute } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

const MAX_RESULTS = 100;

// Check if ripgrep is available (cached)
let ripgrepAvailable: boolean | null = null;
function isRipgrepAvailable(): boolean {
    if (ripgrepAvailable === null) {
        const result = spawnSync('rg', ['--version'], { stdio: 'ignore' });
        ripgrepAvailable = result.status === 0;
    }
    return ripgrepAvailable;
}

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

/**
 * Run grep using native grep command (fallback when ripgrep not available)
 */
async function runNativeGrep(
    params: GrepParams,
    targetPath: string,
    maxResults: number
): Promise<string> {
    // Build grep command with find for recursive search
    // grep -r doesn't have all the nice features of rg, so we use find + grep
    const grepArgs: string[] = [
        '-r',           // recursive
        '-n',           // line numbers
        '-H',           // always print filename
        '--color=never',
    ];

    if (params.case_insensitive) {
        grepArgs.push('-i');
    }

    if (params.context_lines) {
        grepArgs.push(`-C${params.context_lines}`);
    }

    // File pattern filtering with --include
    if (params.file_pattern) {
        grepArgs.push(`--include=${params.file_pattern}`);
    }

    // Exclude common directories
    grepArgs.push('--exclude-dir=node_modules');
    grepArgs.push('--exclude-dir=.git');
    grepArgs.push('--exclude-dir=dist');
    grepArgs.push('--exclude-dir=build');
    grepArgs.push('--exclude-dir=coverage');

    grepArgs.push(params.pattern, targetPath);

    return new Promise((resolvePromise, reject) => {
        const grep = spawn('grep', grepArgs);
        let stdout = '';
        let stderr = '';

        grep.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        grep.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        grep.on('close', (code) => {
            if (code === 0 || code === 1) {
                // code 0 = matches found, code 1 = no matches
                const lines = stdout.trim().split('\n').filter(Boolean);
                if (lines.length === 0) {
                    resolvePromise('No matches found');
                } else {
                    // Limit results
                    const limited = lines.slice(0, maxResults);
                    resolvePromise(limited.join('\n'));
                }
            } else {
                reject(new Error(`grep failed: ${stderr || 'unknown error'}`));
            }
        });

        grep.on('error', (err) => {
            reject(new Error(`grep not available: ${err.message}`));
        });
    });
}

/**
 * Run grep using ripgrep (preferred)
 */
async function runRipgrep(
    params: GrepParams,
    targetPath: string,
    maxResults: number
): Promise<string> {
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

    return new Promise((resolvePromise, reject) => {
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
                const lines = stdout.trim().split('\n').filter(Boolean);
                if (lines.length === 0) {
                    resolvePromise('No matches found');
                } else {
                    resolvePromise(lines.join('\n'));
                }
            } else if (code === 1) {
                // No matches found (normal exit)
                resolvePromise('No matches found');
            } else {
                reject(new Error(`ripgrep failed: ${stderr || 'unknown error'}`));
            }
        });

        rg.on('error', (err) => {
            reject(new Error(`ripgrep error: ${err.message}`));
        });
    });
}

export async function grepImpl(
    params: GrepParams,
    workingDirectory: string
): Promise<string> {
    const targetPath = params.path 
        ? (isAbsolute(params.path) ? params.path : resolve(workingDirectory, params.path))
        : workingDirectory;

    const maxResults = Math.min(params.max_results || MAX_RESULTS, MAX_RESULTS);

    // Try ripgrep first, fall back to native grep
    if (isRipgrepAvailable()) {
        return runRipgrep(params, targetPath, maxResults);
    } else {
        return runNativeGrep(params, targetPath, maxResults);
    }
}

export const grepTool: Tool = {
    name: 'grep',
    description: 'Search for patterns in files. Returns matching lines with file paths and line numbers. Uses ripgrep if available, falls back to native grep.',
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
