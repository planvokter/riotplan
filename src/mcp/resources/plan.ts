/**
 * Plan Resource Handler
 */

import type { PlanResource } from '../types.js';
import { loadPlan } from '../../plan/loader.js';
import { existsSync } from 'node:fs';

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
