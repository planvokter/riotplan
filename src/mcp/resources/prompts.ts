/**
 * Prompts Resource Handler
 * 
 * Provides access to .history/prompts/ directory
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function readPromptsListResource(planPath: string): Promise<any> {
    const promptsDir = join(planPath, '.history', 'prompts');
    
    try {
        const files = await readdir(promptsDir);
        const promptFiles = files
            .filter(f => f.endsWith('.md'))
            .sort();
        
        return {
            prompts: promptFiles,
            count: promptFiles.length,
            type: 'prompts_list',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
                prompts: [],
                count: 0,
                type: 'prompts_list',
                note: 'No prompts directory found',
            };
        }
        throw error;
    }
}

export async function readPromptResource(planPath: string, promptFile: string): Promise<any> {
    const promptPath = join(planPath, '.history', 'prompts', promptFile);
    
    try {
        const content = await readFile(promptPath, 'utf-8');
        return {
            file: promptFile,
            content,
            type: 'prompt',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Prompt file not found: ${promptFile}`);
        }
        throw error;
    }
}
