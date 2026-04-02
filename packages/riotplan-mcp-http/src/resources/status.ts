/**
 * Status Resource Handler
 */

import type { StatusResource } from '../types.js';
import { createSqliteProvider } from '@planvokter/riotplan-format';

export async function readStatusResource(path: string): Promise<StatusResource> {
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
        const completed = steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
        const total = steps.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        const inProgress = steps.find((s) => s.status === 'in_progress');
        const currentStep = inProgress?.number ?? steps.find((s) => s.status === 'pending')?.number;
        const lastCompleted = steps
            .filter((s) => s.status === 'completed' || s.status === 'skipped')
            .map((s) => s.number)
            .sort((a, b) => b - a)[0];

        return {
            planId: metadataResult.data.id,
            status: inProgress ? 'in_progress' : completed === total && total > 0 ? 'completed' : 'pending',
            currentStep,
            lastCompleted,
            progress: { completed, total, percentage },
            blockers: [],
            issues: [],
        };
    } catch (error) {
        throw new Error(`Failed to read status: ${error}`);
    }
}
