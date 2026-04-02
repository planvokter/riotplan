/**
 * Shaping Resource Handler
 * 
 * Provides access to SHAPING.md file
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSqliteProvider } from '@planvokter/riotplan-format';

export async function readShapingResource(planPath: string): Promise<any> {
    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const filesResult = await provider.getFiles();
        await provider.close();
        if (!filesResult.success || !filesResult.data) {
            return {
                content: null,
                type: 'shaping',
                note: 'No shaping file found - idea may not have been shaped yet',
            };
        }
        const shapingFiles = filesResult.data
            .filter((f) => f.type === 'shaping')
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        const shaping = shapingFiles[0];
        if (!shaping) {
            return {
                content: null,
                type: 'shaping',
                note: 'No shaping file found - idea may not have been shaped yet',
            };
        }
        return {
            content: shaping.content,
            type: 'shaping',
        };
    }

    const shapingPath = join(planPath, 'SHAPING.md');
    
    try {
        const content = await readFile(shapingPath, 'utf-8');
        return {
            content,
            type: 'shaping',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
                content: null,
                type: 'shaping',
                note: 'No shaping file found - idea may not have been shaped yet',
            };
        }
        throw error;
    }
}
