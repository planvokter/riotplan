/**
 * Status Resource Handler
 */

import type { StatusResource } from '../types.js';
import { loadPlan } from '../../plan/loader.js';

export async function readStatusResource(path: string): Promise<StatusResource> {
    try {
        const plan = await loadPlan(path);
        
        const completed = plan.steps.filter(s => s.status === 'completed').length;
        const total = plan.steps.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
            planId: plan.metadata.code,
            status: plan.state.status,
            currentStep: plan.state.currentStep,
            lastCompleted: plan.state.lastCompletedStep,
            progress: {
                completed,
                total,
                percentage,
            },
            blockers: (plan.state.blockers || []).map(b => 
                typeof b === 'string' ? b : `${b.severity}: ${b.description}`
            ),
            issues: (plan.state.issues || []).map(i => 
                typeof i === 'string' ? i : `${i.severity}: ${i.description}`
            ),
        };
    } catch (error) {
        throw new Error(`Failed to read status: ${error}`);
    }
}
