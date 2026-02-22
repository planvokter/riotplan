/**
 * Reflection Tool - Capture step reflections
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { loadPlan } from '../../plan/loader.js';
import { writeStepReflection } from '../../reflections/writer.js';

// ============================================================================
// Step Reflect Tool
// ============================================================================

async function executeStepReflect(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
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
