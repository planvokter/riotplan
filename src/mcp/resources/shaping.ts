/**
 * Shaping Resource Handler
 * 
 * Provides access to SHAPING.md file
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function readShapingResource(planPath: string): Promise<any> {
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
