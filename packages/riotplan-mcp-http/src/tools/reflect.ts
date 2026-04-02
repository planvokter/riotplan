/**
 * Reflection Tool - Capture step reflections
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { writeStepReflection } from '@planvokter/riotplan';
import { createSqliteProvider } from '@planvokter/riotplan-format';
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

async function validateStepCompleted(
    planPath: string,
    stepNumber: number
): Promise<{ planId: string; error?: string }> {
    const provider = createSqliteProvider(planPath);
    try {
        const [metadataResult, stepResult] = await Promise.all([
            provider.getMetadata(),
            provider.getStep(stepNumber),
        ]);

        if (!metadataResult.success || !metadataResult.data) {
            throw new Error(metadataResult.error || 'Failed to read SQLite plan metadata');
        }
        if (!stepResult.success) {
            throw new Error(stepResult.error || `Failed to read step ${stepNumber}`);
        }
        if (!stepResult.data) {
            return { planId: metadataResult.data.id, error: `Step ${stepNumber} not found in plan` };
        }
        if (stepResult.data.status !== 'completed') {
            return {
                planId: metadataResult.data.id,
                error: `Cannot reflect on step ${stepNumber} - step must be completed first (current status: ${stepResult.data.status})`,
            };
        }
        return { planId: metadataResult.data.id };
    } finally {
        await provider.close();
    }
}

async function executeStepReflect(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        const now = new Date().toISOString();
        const reflectionExcerpt = buildReflectionExcerpt(args.reflection);

        const { planId, error } = await validateStepCompleted(planPath, args.step);
        if (error) {
            return { success: false, error };
        }

        const reflectionFile = await writeStepReflection(planPath, args.step, args.reflection);

        await logEvent(planPath, {
            timestamp: now,
            type: 'step_reflected',
            data: {
                step: args.step,
                reflection: reflectionExcerpt,
                timestamp: now,
                storage: 'sqlite',
                reflectionFile,
            },
        });

        return createSuccess(
            { planId, step: args.step, reflectionFile },
            `Reflection for step ${args.step} saved to ${reflectionFile}`
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
