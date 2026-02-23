/**
 * Plan Resource Handler
 */

import type { PlanResource } from '../types.js';
import { loadPlan } from '../../plan/loader.js';
import { existsSync } from 'node:fs';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

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
        if (path.endsWith('.plan')) {
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
        }

        const plan = await loadPlan(path);
        
        return {
            planId: plan.metadata.code,
            code: plan.metadata.code,
            name: plan.metadata.name,
            exists: true,
            metadata: {
                code: plan.metadata.code,
                name: plan.metadata.name,
                description: plan.metadata.description,
                created: plan.metadata.createdAt,
                projectPath: plan.metadata.projectPath,
            },
            state: {
                status: plan.state.status,
                currentStep: plan.state.currentStep,
                lastCompleted: plan.state.lastCompletedStep,
                startedAt: plan.state.startedAt,
                lastUpdated: plan.state.lastUpdatedAt,
            },
        };
    } catch (error) {
        throw new Error(`Failed to read plan: ${error}`);
    }
}
