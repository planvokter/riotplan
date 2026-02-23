/**
 * Reflection Tool - Capture step reflections
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { loadPlan } from '../../plan/loader.js';
import { writeStepReflection } from '../../reflections/writer.js';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { logEvent } from './history.js';

function buildReflectionExcerpt(reflection: string, maxLength = 200): string {
    const normalized = reflection.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength - 3)}...`;
}

// ============================================================================
// Step Reflect Tool
// ============================================================================

async function executeStepReflect(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        const now = new Date().toISOString();
        const reflectionExcerpt = buildReflectionExcerpt(args.reflection);

        if (planPath.endsWith('.plan')) {
            const provider = createSqliteProvider(planPath);
            try {
                const [metadataResult, stepResult] = await Promise.all([
                    provider.getMetadata(),
                    provider.getStep(args.step),
                ]);

                if (!metadataResult.success || !metadataResult.data) {
                    throw new Error(metadataResult.error || 'Failed to read SQLite plan metadata');
                }
                if (!stepResult.success) {
                    throw new Error(stepResult.error || `Failed to read step ${args.step}`);
                }
                if (!stepResult.data) {
                    return {
                        success: false,
                        error: `Step ${args.step} not found in plan`,
                    };
                }
                if (stepResult.data.status !== 'completed') {
                    return {
                        success: false,
                        error: `Cannot reflect on step ${args.step} - step must be completed first (current status: ${stepResult.data.status})`,
                    };
                }

                const stepNum = String(args.step).padStart(2, '0');
                const reflectionFilename = `reflections/${stepNum}-reflection.md`;
                const saveResult = await provider.saveFile({
                    // Use prompt artifact storage with reflection namespaced by filename.
                    type: 'prompt',
                    filename: reflectionFilename,
                    content: args.reflection,
                    createdAt: now,
                    updatedAt: now,
                });
                if (!saveResult.success) {
                    throw new Error(
                        `Could not persist reflection for SQLite plan: ${saveResult.error || 'unknown provider error'}`
                    );
                }

                await logEvent(planPath, {
                    timestamp: now,
                    type: 'step_reflected',
                    data: {
                        step: args.step,
                        reflection: reflectionExcerpt,
                        timestamp: now,
                        storage: 'sqlite',
                        reflectionFile: reflectionFilename,
                    },
                });

                return createSuccess(
                    {
                        planId: metadataResult.data.id,
                        step: args.step,
                        reflectionFile: reflectionFilename,
                    },
                    `Reflection for step ${args.step} saved to ${reflectionFilename}`
                );
            } finally {
                await provider.close();
            }
        }

        const plan = await loadPlan(planPath);

        // Validate that the step exists
        const step = plan.steps.find(s => s.number === args.step);
        if (!step) {
            return {
                success: false,
                error: `Step ${args.step} not found in plan`,
            };
        }

        // Validate that the step is completed
        if (step.status !== 'completed') {
            return {
                success: false,
                error: `Cannot reflect on step ${args.step} - step must be completed first (current status: ${step.status})`,
            };
        }

        // Write the reflection file
        const filepath = await writeStepReflection(
            planPath,
            args.step,
            args.reflection
        );

        await logEvent(planPath, {
            timestamp: now,
            type: 'step_reflected',
            data: {
                step: args.step,
                reflection: reflectionExcerpt,
                timestamp: now,
                storage: 'directory',
                reflectionFile: filepath,
            },
        });

        return createSuccess(
            {
                planId: plan.metadata.code,
                step: args.step,
                reflectionFile: filepath,
            },
            `Reflection for step ${args.step} saved to ${filepath}`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const stepReflectTool: McpTool = {
    name: 'riotplan_step_reflect',
    description:
        'Capture a reflection after completing a step. ' +
        'Write freeform analysis about what happened during execution: ' +
        'what surprised you, what took longer than expected, what could be done differently, ' +
        'and what the next step should know. This creates the inter-step learning channel.',
    schema: {
        planId: z.string().optional().describe('Plan identifier (defaults to current plan context)'),
        step: z.number().describe('Step number to reflect on (must be completed)'),
        reflection: z.string().describe(
            'The reflection content. Be honest, specific, and creative. ' +
            'What surprised you? What took longer than expected? ' +
            'What could have been done differently? What should the next step know?'
        ),
    },
    execute: executeStepReflect,
};
