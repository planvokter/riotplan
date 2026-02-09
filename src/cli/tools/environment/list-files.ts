/**
 * list_files tool - List directory contents
 */

import { readdir } from 'node:fs/promises';
import { resolve, isAbsolute, join, relative } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

// Default ignore patterns
const DEFAULT_IGNORE = [
    'node_modules',
    '.git',
    '.DS_Store',
    '__pycache__',
    '.pytest_cache',
    '.venv',
    'venv',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
];

export interface ListFilesParams {
    path?: string;
    recursive?: boolean;
    include_hidden?: boolean;
    max_depth?: number;
    pattern?: string;
}

async function listFilesRecursive(
    dirPath: string,
    basePath: string,
    options: {
        recursive: boolean;
        includeHidden: boolean;
        maxDepth: number;
        currentDepth: number;
        pattern?: RegExp;
    }
): Promise<string[]> {
    const results: string[] = [];
    
    if (options.currentDepth > options.maxDepth) {
        return results;
    }

    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const entryName = entry.name;
            
            // Skip hidden files unless requested
            if (!options.includeHidden && entryName.startsWith('.')) {
                continue;
            }
            
            // Skip ignored directories
            if (entry.isDirectory() && DEFAULT_IGNORE.includes(entryName)) {
                continue;
            }
            
            const fullPath = join(dirPath, entryName);
            const relativePath = relative(basePath, fullPath);
            
            // Apply pattern filter if specified
            if (options.pattern && !options.pattern.test(relativePath)) {
                if (!entry.isDirectory()) {
                    continue;
                }
            }
            
            if (entry.isDirectory()) {
                results.push(relativePath + '/');
                
                if (options.recursive) {
                    const subResults = await listFilesRecursive(
                        fullPath,
                        basePath,
                        {
                            ...options,
                            currentDepth: options.currentDepth + 1,
                        }
                    );
                    results.push(...subResults);
                }
            } else {
                if (!options.pattern || options.pattern.test(relativePath)) {
                    results.push(relativePath);
                }
            }
        }
    } catch {
        // Permission denied or other errors - skip this directory
    }
    
    return results;
}

export async function listFilesImpl(
    params: ListFilesParams,
    workingDirectory: string
): Promise<string> {
    const targetPath = params.path 
        ? (isAbsolute(params.path) ? params.path : resolve(workingDirectory, params.path))
        : workingDirectory;

    const pattern = params.pattern 
        ? new RegExp(params.pattern.replace(/\*/g, '.*'))
        : undefined;

    const files = await listFilesRecursive(targetPath, targetPath, {
        recursive: params.recursive ?? false,
        includeHidden: params.include_hidden ?? false,
        maxDepth: params.max_depth ?? 10,
        currentDepth: 0,
        pattern,
    });

    if (files.length === 0) {
        return 'No files found';
    }

    // Sort: directories first, then files
    files.sort((a, b) => {
        const aIsDir = a.endsWith('/');
        const bIsDir = b.endsWith('/');
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });

    return files.join('\n');
}

export const listFilesTool: Tool = {
    name: 'list_files',
    description: 'List files and directories. Can list recursively and filter by pattern. Automatically ignores common directories like node_modules, .git, etc.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Directory path to list (defaults to working directory)',
            },
            recursive: {
                type: 'boolean',
                description: 'Whether to list recursively (default: false)',
            },
            include_hidden: {
                type: 'boolean',
                description: 'Whether to include hidden files starting with . (default: false)',
            },
            max_depth: {
                type: 'number',
                description: 'Maximum recursion depth (default: 10)',
            },
            pattern: {
                type: 'string',
                description: 'Filter pattern (glob-like, e.g., "*.ts" or "src/*")',
            },
        },
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: ListFilesParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return listFilesImpl(params, workingDirectory);
    },
};
