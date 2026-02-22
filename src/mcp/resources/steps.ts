/**
 * Steps Resource Handler
 */

import type { StepsResource } from '../types.js';
import { loadPlan } from '../../plan/loader.js';

export async function readStepsResource(path: string): Promise<StepsResource> {
    try {
        const plan = await loadPlan(path);
        
        return {
            planId: plan.metadata.code,
            steps: plan.steps.map(s => ({
                number: s.number,
                title: s.title,
                status: s.status,
                file: s.filename,
            })),
        };
    } catch (error) {
        throw new Error(`Failed to read steps: ${error}`);
    }
}
