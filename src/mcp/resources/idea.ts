/**
 * Idea Resource Handler
 * 
 * Provides access to IDEA.md file
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function readIdeaResource(planPath: string): Promise<any> {
    const ideaPath = join(planPath, 'IDEA.md');
    
    try {
        const content = await readFile(ideaPath, 'utf-8');
        return {
            content,
            type: 'idea',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error('IDEA.md not found. This plan may not be in idea mode.');
        }
        throw error;
    }
}
