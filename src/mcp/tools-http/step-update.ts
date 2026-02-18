/**
 * Update step status
 */

import { z } from 'zod';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import type { HttpToolContext, ToolResult } from './shared.js';
import { findPlanByUuid } from './shared.js';

export const stepUpdateSchema = z.object({
    planId: z.string().describe('Plan UUID, abbreviation, or file path'),
    step: z.number().describe('Step number'),
    status: z
        .enum(['pending', 'in_progress', 'completed', 'skipped'])
        .describe('New step status'),
});

export async function executeStepUpdate(
    args: z.infer<typeof stepUpdateSchema>,
    context: HttpToolContext
): Promise<ToolResult> {
    try {
        // Resolve plan path
        let planPath: string | null = args.planId;

        if (args.planId.match(/^[0-9a-f]{8,}/i)) {
            planPath = findPlanByUuid(context.plansDir, args.planId);
            if (!planPath) {
                return {
                    success: false,
                    error: `Plan not found: ${args.planId}`,
                };
            }
        }

        const provider = createSqliteProvider(planPath);

        // Check if plan exists
        const exists = await provider.exists();
        if (!exists) {
            await provider.close();
            return {
                success: false,
                error: `Plan does not exist: ${planPath}`,
            };
        }

        // Get the step
        const stepResult = await provider.getStep(args.step);
        if (!stepResult.success || !stepResult.data) {
            await provider.close();
            return {
                success: false,
                error: `Step ${args.step} not found`,
            };
        }

        // Update step status
        const updates: any = { status: args.status };

        if (args.status === 'in_progress' && !stepResult.data.startedAt) {
            updates.startedAt = new Date().toISOString();
        }

        if (
            (args.status === 'completed' || args.status === 'skipped') &&
            !stepResult.data.completedAt
        ) {
            updates.completedAt = new Date().toISOString();
        }

        const updateResult = await provider.updateStep(args.step, updates);

        await provider.close();

        if (!updateResult.success) {
            return {
                success: false,
                error: updateResult.error || 'Failed to update step',
            };
        }

        return {
            success: true,
            data: {
                step: args.step,
                status: args.status,
                ...updates,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update step',
        };
    }
}
