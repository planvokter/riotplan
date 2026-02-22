/**
 * Timeline Resource Handler
 * 
 * Provides access to .history/timeline.jsonl
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function readTimelineResource(planPath: string): Promise<any> {
    const timelinePath = join(planPath, '.history', 'timeline.jsonl');
    
    try {
        const content = await readFile(timelinePath, 'utf-8');
        const events = content
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
        
        return {
            events,
            count: events.length,
            type: 'timeline',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error('Timeline not found. This plan may not have history tracking enabled.');
        }
        throw error;
    }
}
