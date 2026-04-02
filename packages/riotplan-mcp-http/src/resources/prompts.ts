/**
 * Prompts Resource Handler
 * 
 * Provides access to .history/prompts/ directory
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSqliteProvider } from '@planvokter/riotplan-format';

export async function readPromptsListResource(planPath: string): Promise<any> {
    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const filesResult = await provider.getFiles();
        await provider.close();
        if (!filesResult.success || !filesResult.data) {
            return {
                prompts: [],
                count: 0,
                type: 'prompts_list',
                note: 'No prompt files found',
            };
        }
        const promptFiles = filesResult.data
            .filter((f) => f.type === 'prompt')
            .map((f) => f.filename)
            .sort();
        return {
            prompts: promptFiles,
            count: promptFiles.length,
            type: 'prompts_list',
        };
    }

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
    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const filesResult = await provider.getFiles();
        await provider.close();
        if (!filesResult.success || !filesResult.data) {
            throw new Error(`Prompt file not found: ${promptFile}`);
        }
        const prompt = filesResult.data.find((f) => f.type === 'prompt' && f.filename === promptFile);
        if (!prompt) {
            throw new Error(`Prompt file not found: ${promptFile}`);
        }
        return {
            file: promptFile,
            content: prompt.content,
            type: 'prompt',
        };
    }

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
