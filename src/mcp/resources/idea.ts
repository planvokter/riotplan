/**
 * Idea Resource Handler
 * 
 * Provides access to IDEA.md file
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

export async function readIdeaResource(planPath: string): Promise<any> {
    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const filesResult = await provider.getFiles();
        await provider.close();
        if (!filesResult.success || !filesResult.data) {
            throw new Error('IDEA.md not found. This plan may not be in idea mode.');
        }
        const ideaFiles = filesResult.data
            .filter((f) => f.type === 'idea')
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        const idea = ideaFiles[0];
        if (!idea) {
            throw new Error('IDEA.md not found. This plan may not be in idea mode.');
        }
        return {
            content: idea.content,
            type: 'idea',
        };
    }

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
