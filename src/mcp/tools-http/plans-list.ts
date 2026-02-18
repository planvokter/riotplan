/**
 * List all plans with metadata
 */
/* eslint-disable no-console */

import { z } from 'zod';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import type { HttpToolContext, ToolResult } from './shared.js';
import { findAllPlanFiles } from './shared.js';

export const plansListSchema = z.object({
    filter: z
        .enum(['all', 'active', 'done', 'hold'])
        .optional()
        .describe('Filter plans by status'),
});

export async function executeListPlans(
    args: z.infer<typeof plansListSchema>,
    context: HttpToolContext
): Promise<ToolResult> {
    try {
        const planFiles = findAllPlanFiles(context.plansDir);
        const plans: any[] = [];

        for (const planFile of planFiles) {
            try {
                const provider = createSqliteProvider(planFile);

                // Check if plan exists
                const exists = await provider.exists();
                if (!exists) {
                    continue;
                }

                // Get metadata
                const metadataResult = await provider.getMetadata();
                if (!metadataResult.success || !metadataResult.data) {
                    continue;
                }

                const metadata = metadataResult.data;

                // Determine category based on path
                let category = 'active';
                if (planFile.includes('/done/')) {
                    category = 'done';
                } else if (planFile.includes('/hold/')) {
                    category = 'hold';
                }

                // Apply filter
                if (args.filter && args.filter !== 'all') {
                    if (args.filter !== category) {
                        await provider.close();
                        continue;
                    }
                }

                // Get steps for progress calculation
                const stepsResult = await provider.getSteps();
                const steps = stepsResult.success ? stepsResult.data || [] : [];

                const completed = steps.filter(
                    (s) => s.status === 'completed' || s.status === 'skipped'
                ).length;
                const total = steps.length;

                plans.push({
                    uuid: metadata.uuid,
                    id: metadata.id,
                    name: metadata.name,
                    description: metadata.description,
                    stage: metadata.stage,
                    category,
                    progress: {
                        completed,
                        total,
                        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
                    },
                    createdAt: metadata.createdAt,
                    updatedAt: metadata.updatedAt,
                    path: planFile,
                });

                await provider.close();
            } catch (error) {
                // Skip plans that can't be read
                console.error(`Error reading plan ${planFile}:`, error);
            }
        }

        // Sort by updatedAt descending
        plans.sort((a, b) => {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        return {
            success: true,
            data: {
                plans,
                count: plans.length,
                filter: args.filter || 'all',
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list plans',
        };
    }
}
