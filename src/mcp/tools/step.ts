/**
 * Step Tools - Manage plan steps
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { loadPlan } from '../../plan/loader.js';
import { startStep, completeStep, insertStep } from '../../steps/operations.js';
import { generateStatus } from '../../status/generator.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ============================================================================
// Step List Tool
// ============================================================================

async function executeStepList(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = args.path ? args.path : resolveDirectory(args, context);
        const plan = await loadPlan(planPath);

        let steps = plan.steps;

        if (args.pending) {
            steps = steps.filter(s => s.status === 'pending');
        } else if (!args.all) {
            steps = steps.filter(s => s.status !== 'completed');
        }

        return createSuccess({
            planPath: plan.metadata.path,
            steps: steps.map(s => ({
                number: s.number,
                title: s.title,
                status: s.status,
                file: s.filename,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
            })),
        });
    } catch (error) {
        return formatError(error);
    }
}

export const stepListTool: McpTool = {
    name: 'riotplan_step_list',
    description:
        'List all steps in a plan with their status. ' +
        'Can filter to show only pending, in-progress, or all steps.',
    schema: {
        path: z.string().optional().describe('Plan directory path (defaults to current directory)'),
        pending: z.boolean().optional().describe('Show only pending steps (default: false)'),
        all: z.boolean().optional().describe('Include completed steps (default: true)'),
    },
    execute: executeStepList,
};

// ============================================================================
// Step Start Tool
// ============================================================================

async function executeStepStart(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = args.path ? args.path : resolveDirectory(args, context);
        
        const plan = await loadPlan(planPath);
        const updatedStep = startStep(plan, args.step);
        
        // Update the plan's steps array
        const stepIndex = plan.steps.findIndex(s => s.number === args.step);
        if (stepIndex >= 0) {
            plan.steps[stepIndex] = updatedStep;
        }
        
        // Update plan state
        plan.state.currentStep = args.step;
        plan.state.status = 'in_progress';
        plan.state.lastUpdatedAt = new Date();
        
        // Regenerate STATUS.md
        const statusContent = await generateStatus(plan);
        await writeFile(join(planPath, 'STATUS.md'), statusContent, 'utf-8');

        return createSuccess(
            { planPath, step: args.step },
            `Step ${args.step} marked as started`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const stepStartTool: McpTool = {
    name: 'riotplan_step_start',
    description:
        'Mark a step as started. Updates STATUS.md to reflect the step is in progress.',
    schema: {
        path: z.string().optional().describe('Plan directory path (defaults to current directory)'),
        step: z.number().describe('Step number to start'),
    },
    execute: executeStepStart,
};

// ============================================================================
// Step Complete Tool
// ============================================================================

async function executeStepComplete(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = args.path ? args.path : resolveDirectory(args, context);
        
        const plan = await loadPlan(planPath);
        const updatedStep = completeStep(plan, args.step);
        
        // Update the plan's steps array
        const stepIndex = plan.steps.findIndex(s => s.number === args.step);
        if (stepIndex >= 0) {
            plan.steps[stepIndex] = updatedStep;
        }
        
        // Update plan state
        plan.state.lastCompletedStep = args.step;
        plan.state.lastUpdatedAt = new Date();
        
        // Find next pending step or mark as completed
        const nextPending = plan.steps.find(s => s.status === 'pending');
        if (nextPending) {
            plan.state.currentStep = nextPending.number;
            plan.state.status = 'in_progress';
        } else {
            plan.state.status = 'completed';
            plan.state.currentStep = undefined;
        }
        
        // Regenerate STATUS.md
        const statusContent = await generateStatus(plan);
        await writeFile(join(planPath, 'STATUS.md'), statusContent, 'utf-8');

        // Check if all steps are now completed
        const allStepsCompleted = plan.steps.every(
            s => s.status === 'completed' || s.status === 'skipped'
        );

        if (allStepsCompleted) {
            return createSuccess(
                { planPath, step: args.step, planCompleted: true },
                `Step ${args.step} marked as completed.\n\n` +
                `🎉 All steps completed! Plan execution is finished.\n\n` +
                `**Next: Generate Plan Retrospective**\n` +
                `Call \`riotplan_generate_retrospective\` to create a retrospective that captures learning from this execution.\n\n` +
                `**Recommendation**: Use the highest-tier model available (e.g., Claude Opus, GPT-4) for retrospective generation. ` +
                `Retrospectives require creative analysis and pattern recognition to produce valuable insights.`
            );
        }

        return createSuccess(
            { planPath, step: args.step },
            `Step ${args.step} marked as completed`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const stepCompleteTool: McpTool = {
    name: 'riotplan_step_complete',
    description:
        'Mark a step as completed. Updates STATUS.md to reflect the step is done.',
    schema: {
        path: z.string().optional().describe('Plan directory path (defaults to current directory)'),
        step: z.number().describe('Step number to complete'),
    },
    execute: executeStepComplete,
};

// ============================================================================
// Step Add Tool
// ============================================================================

async function executeStepAdd(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = args.path ? args.path : resolveDirectory(args, context);
        
        const plan = await loadPlan(planPath);
        
        const result = await insertStep(plan, {
            title: args.title,
            position: args.number,
            after: args.after,
            status: 'pending',
        });

        return createSuccess(
            { 
                planPath, 
                step: result.step.number, 
                file: result.createdFile,
                renamedFiles: result.renamedFiles,
            },
            `Step "${args.title}" added as step ${result.step.number}`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const stepAddTool: McpTool = {
    name: 'riotplan_step_add',
    description:
        'Add a new step to the plan. Can specify position or add after a specific step.',
    schema: {
        path: z.string().optional().describe('Plan directory path (defaults to current directory)'),
        title: z.string().describe('Step title'),
        number: z.number().optional().describe('Step number (optional, defaults to end)'),
        after: z.number().optional().describe('Add after this step number (optional)'),
    },
    execute: executeStepAdd,
};
