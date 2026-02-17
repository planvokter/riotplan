/**
 * Get plan status and progress information
 */

import { z } from 'zod';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import type { HttpToolContext, ToolResult } from './shared.js';
import { findPlanByUuid, calculateProgress, deriveOverallStatus } from './shared.js';

export const planStatusSchema = z.object({
    planId: z.string().describe('Plan UUID, abbreviation, or file path'),
});

export async function executePlanStatus(
    args: z.infer<typeof planStatusSchema>,
    context: HttpToolContext
): Promise<ToolResult> {
    try {
        // Resolve plan path
        let planPath: string | null = args.planId;

        // If it looks like a UUID or abbreviation, try to find it
        if (args.planId.match(/^[0-9a-f]{8,}/i)) {
            planPath = findPlanByUuid(context.plansDir, args.planId);
            if (!planPath) {
                return {
                    success: false,
                    error: `Plan not found: ${args.planId}`,
                };
            }
        }

        // Create provider
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

        // Get metadata
        const metadataResult = await provider.getMetadata();
        if (!metadataResult.success || !metadataResult.data) {
            await provider.close();
            return {
                success: false,
                error: 'Failed to get plan metadata',
            };
        }

        // Get steps
        const stepsResult = await provider.getSteps();
        const steps = stepsResult.success ? stepsResult.data || [] : [];

        const metadata = metadataResult.data;
        const progress = calculateProgress(steps);
        const status = deriveOverallStatus(steps);

        // Get current step
        let currentStep = null;
        const inProgressStep = steps.find((s) => s.status === 'in_progress');
        if (inProgressStep) {
            currentStep = {
                number: inProgressStep.number,
                title: inProgressStep.title,
                status: inProgressStep.status,
            };
        } else {
            // Find next pending step
            const nextPending = steps.find((s) => s.status === 'pending');
            if (nextPending) {
                currentStep = {
                    number: nextPending.number,
                    title: nextPending.title,
                    status: 'ready',
                };
            }
        }

        await provider.close();

        return {
            success: true,
            data: {
                plan: {
                    uuid: metadata.uuid,
                    id: metadata.id,
                    name: metadata.name,
                    description: metadata.description,
                    stage: metadata.stage,
                },
                status,
                progress,
                currentStep,
                steps: steps.map((s) => ({
                    number: s.number,
                    title: s.title,
                    status: s.status,
                    startedAt: s.startedAt,
                    completedAt: s.completedAt,
                })),
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get plan status',
        };
    }
}
