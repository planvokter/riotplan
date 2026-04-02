/**
 * Steps Resource Handler
 */

import type { StepsResource } from '../types.js';
import { createSqliteProvider } from '@planvokter/riotplan-format';

export async function readStepsResource(path: string): Promise<StepsResource> {
    try {
        if (!path.endsWith('.plan')) {
            throw new Error('Directory-based plans are no longer supported.');
        }
        const provider = createSqliteProvider(path);
        const [metadataResult, stepsResult] = await Promise.all([
            provider.getMetadata(),
            provider.getSteps(),
        ]);
        await provider.close();
        if (!metadataResult.success || !metadataResult.data) {
            throw new Error(metadataResult.error || 'Failed to read sqlite plan metadata');
        }
        const steps = stepsResult.success ? stepsResult.data || [] : [];
        
        return {
            planId: metadataResult.data.id,
            steps: steps.map((s) => ({
                number: s.number,
                title: s.title,
                status: s.status,
                file: `${String(s.number).padStart(2, '0')}-${s.code || 'step'}.md`,
            })),
        };
    } catch (error) {
        throw new Error(`Failed to read steps: ${error}`);
    }
}
