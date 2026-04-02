/**
 * Step Resource Handler
 */

import type { StepResource } from '../types.js';
import { createSqliteProvider } from '@planvokter/riotplan-format';

export async function readStepResource(path: string, stepNumber: number): Promise<StepResource> {
    try {
        if (!path.endsWith('.plan')) {
            throw new Error('Directory-based plans are no longer supported.');
        }
        const provider = createSqliteProvider(path);
        const [metadataResult, stepResult] = await Promise.all([
            provider.getMetadata(),
            provider.getStep(stepNumber),
        ]);
        await provider.close();
        if (!metadataResult.success || !metadataResult.data) {
            throw new Error(metadataResult.error || 'Failed to read sqlite plan metadata');
        }
        if (!stepResult.success || !stepResult.data) {
            throw new Error(`Step ${stepNumber} not found in plan`);
        }
        const step = stepResult.data;

        return {
            planId: metadataResult.data.id,
            number: step.number,
            title: step.title,
            status: step.status,
            file: `${String(step.number).padStart(2, '0')}-${step.code || 'step'}.md`,
            content: step.content || '',
        };
    } catch (error) {
        throw new Error(`Failed to read step ${stepNumber}: ${error}`);
    }
}
