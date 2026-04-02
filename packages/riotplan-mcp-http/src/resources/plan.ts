/**
 * Plan Resource Handler
 */

import type { PlanResource } from '../types.js';
import { existsSync } from 'node:fs';
import { createSqliteProvider } from '@planvokter/riotplan-format';

export async function readPlanResource(path: string): Promise<PlanResource> {
    const exists = existsSync(path);
    
    if (!exists) {
        return {
            planId: null,
            code: '',
            name: '',
            exists: false,
        };
    }

    try {
        if (!path.endsWith('.plan')) {
            throw new Error('Directory-based plans are no longer supported.');
        }
        const provider = createSqliteProvider(path);
        const metadataResult = await provider.getMetadata();
        await provider.close();
        if (!metadataResult.success || !metadataResult.data) {
            throw new Error(metadataResult.error || 'Failed to read sqlite metadata');
        }
        const metadata = metadataResult.data;
        
        return {
            planId: metadata.id,
            code: metadata.id,
            name: metadata.name,
            exists: true,
            metadata: {
                code: metadata.id,
                name: metadata.name,
                description: metadata.description,
            },
            state: {
                status: metadata.stage,
            },
        };
    } catch (error) {
        throw new Error(`Failed to read plan: ${error}`);
    }
}
