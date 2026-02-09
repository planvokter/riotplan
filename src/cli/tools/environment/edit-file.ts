/**
 * edit_file tool - Targeted text replacements
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

export interface EditFileParams {
    path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
}

export async function editFileImpl(
    params: EditFileParams,
    workingDirectory: string
): Promise<string> {
    const filePath = isAbsolute(params.path) 
        ? params.path 
        : resolve(workingDirectory, params.path);

    const content = await readFile(filePath, 'utf-8');
    
    // Check if old_string exists
    if (!content.includes(params.old_string)) {
        throw new Error(`String not found in file: "${params.old_string.slice(0, 50)}${params.old_string.length > 50 ? '...' : ''}"`);
    }

    let newContent: string;
    let replacementCount: number;

    if (params.replace_all) {
        // Replace all occurrences
        const regex = new RegExp(escapeRegex(params.old_string), 'g');
        replacementCount = (content.match(regex) || []).length;
        newContent = content.replace(regex, params.new_string);
    } else {
        // Replace first occurrence only
        const index = content.indexOf(params.old_string);
        
        // Check for uniqueness
        const secondIndex = content.indexOf(params.old_string, index + 1);
        if (secondIndex !== -1) {
            throw new Error(
                'String is not unique in file. Either provide more context to make it unique, ' +
                'or set replace_all: true to replace all occurrences.'
            );
        }
        
        newContent = content.replace(params.old_string, params.new_string);
        replacementCount = 1;
    }

    await writeFile(filePath, newContent, 'utf-8');
    
    return `File edited: ${filePath} (${replacementCount} replacement${replacementCount !== 1 ? 's' : ''})`;
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const editFileTool: Tool = {
    name: 'edit_file',
    description: 'Make targeted text replacements in a file. By default, replaces the first occurrence and requires the string to be unique. Use replace_all: true to replace all occurrences.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file to edit (absolute or relative to working directory)',
            },
            old_string: {
                type: 'string',
                description: 'The exact string to find and replace. Must be unique unless replace_all is true.',
            },
            new_string: {
                type: 'string',
                description: 'The string to replace it with',
            },
            replace_all: {
                type: 'boolean',
                description: 'Whether to replace all occurrences (default: false)',
            },
        },
        required: ['path', 'old_string', 'new_string'],
    },
    category: 'environment',
    cost: 'cheap',
    execute: async (params: EditFileParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return editFileImpl(params, workingDirectory);
    },
};
