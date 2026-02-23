/**
 * Checkpoints Resource Handler
 * 
 * Provides access to .history/checkpoints/ directory
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

export async function readCheckpointsListResource(planPath: string): Promise<any> {
    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const checkpointsResult = await provider.getCheckpoints();
        await provider.close();
        if (!checkpointsResult.success || !checkpointsResult.data) {
            return {
                checkpoints: [],
                count: 0,
                type: 'checkpoints_list',
                note: 'No checkpoints found',
            };
        }
        const checkpoints = checkpointsResult.data
            .map((checkpoint) => ({
                name: checkpoint.name,
                file: `${checkpoint.name}.json`,
                created: checkpoint.createdAt,
            }))
            .sort((a, b) => Date.parse(String(b.created)) - Date.parse(String(a.created)));
        return {
            checkpoints,
            count: checkpoints.length,
            type: 'checkpoints_list',
        };
    }

    const checkpointsDir = join(planPath, '.history', 'checkpoints');
    
    try {
        const files = await readdir(checkpointsDir);
        const checkpointFiles = await Promise.all(
            files
                .filter(f => f.endsWith('.json'))
                .map(async (file) => {
                    const filePath = join(checkpointsDir, file);
                    const stats = await stat(filePath);
                    const name = file.replace('.json', '');
                    return {
                        name,
                        file,
                        created: stats.mtime,
                    };
                })
        );
        
        // Sort by creation time, most recent first
        checkpointFiles.sort((a, b) => b.created.getTime() - a.created.getTime());
        
        return {
            checkpoints: checkpointFiles,
            count: checkpointFiles.length,
            type: 'checkpoints_list',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
                checkpoints: [],
                count: 0,
                type: 'checkpoints_list',
                note: 'No checkpoints directory found',
            };
        }
        throw error;
    }
}

export async function readCheckpointResource(planPath: string, checkpointName: string): Promise<any> {
    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const checkpointResult = await provider.getCheckpoint(checkpointName);
        await provider.close();
        if (!checkpointResult.success || !checkpointResult.data) {
            throw new Error(`Checkpoint not found: ${checkpointName}`);
        }
        return {
            name: checkpointName,
            checkpoint: checkpointResult.data,
            prompt: null,
            type: 'checkpoint',
        };
    }

    const checkpointPath = join(planPath, '.history', 'checkpoints', `${checkpointName}.json`);
    const promptPath = join(planPath, '.history', 'prompts', `${checkpointName}.md`);
    
    try {
        const checkpointContent = await readFile(checkpointPath, 'utf-8');
        const checkpoint = JSON.parse(checkpointContent);
        
        // Try to read associated prompt file
        let promptContent = null;
        try {
            promptContent = await readFile(promptPath, 'utf-8');
        } catch {
            // Prompt file is optional
        }
        
        return {
            name: checkpointName,
            checkpoint,
            prompt: promptContent,
            type: 'checkpoint',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Checkpoint not found: ${checkpointName}`);
        }
        throw error;
    }
}
