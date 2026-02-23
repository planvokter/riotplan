/**
 * Step Tools - Manage plan steps
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess, ensurePlanManifest } from './shared.js';
import { loadPlan } from '../../plan/loader.js';
import { startStep, completeStep, insertStep, removeStep, moveStep } from '../../steps/operations.js';
import { generateStatus } from '../../status/generator.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

function generateSqliteStatusMarkdown(planName: string, steps: Array<{
    number: number;
    title: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
}>): string {
    const completed = steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
    const total = steps.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const currentStep = steps.find((s) => s.status === 'in_progress')?.number
        ?? steps.find((s) => s.status === 'pending')?.number;
    const lastCompleted = steps
        .filter((s) => s.status === 'completed' || s.status === 'skipped')
        .map((s) => s.number)
        .sort((a, b) => b - a)[0];

    const statusLabel = steps.some((s) => s.status === 'in_progress')
        ? 'IN PROGRESS'
        : completed === total && total > 0
            ? 'COMPLETED'
            : 'PLANNING';

    return `# ${planName} Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ${statusLabel} |
| **Current Step** | ${currentStep ?? '-'} |
| **Last Completed** | ${lastCompleted ?? '-'} |
| **Progress** | ${percentage}% (${completed}/${total} steps) |
| **Last Updated** | ${new Date().toISOString()} |

## Step Progress

| Step | Name | Status | Started | Completed |
|------|------|--------|---------|-----------|
${steps.map((s) => `| ${s.number.toString().padStart(2, '0')} | ${s.title} | ${s.status} | ${s.startedAt ?? '-'} | ${s.completedAt ?? '-'} |`).join('\n')}
`;
}

function buildStepContent(stepNum: number, title: string): string {
    const padded = stepNum.toString().padStart(2, '0');
    return `# Step ${padded}: ${title}

## Objective

_Define objective..._

## Background

_Add background context..._

## Tasks

_Add specific tasks..._

## Acceptance Criteria

- [ ] _Add acceptance criteria..._

## Testing

_Add testing approach..._

## Files Changed

- _List files that will be modified..._

## Notes

_Add any additional notes..._
`;
}

async function rewriteSqliteSteps(
    provider: ReturnType<typeof createSqliteProvider>,
    steps: Array<{
        number: number;
        code: string;
        title: string;
        description?: string;
        status: 'pending' | 'in_progress' | 'completed' | 'skipped';
        startedAt?: string;
        completedAt?: string;
        content: string;
    }>
): Promise<void> {
    const existingResult = await provider.getSteps();
    if (existingResult.success && existingResult.data) {
        for (const step of existingResult.data) {
            await provider.deleteStep(step.number);
        }
    }
    for (const step of steps) {
        const addResult = await provider.addStep(step);
        if (!addResult.success) {
            throw new Error(addResult.error || `Failed to write step ${step.number}`);
        }
    }
}

async function saveSqliteStatusArtifact(
    provider: ReturnType<typeof createSqliteProvider>,
    planName: string
): Promise<void> {
    const stepsResult = await provider.getSteps();
    if (!stepsResult.success || !stepsResult.data) {
        throw new Error(stepsResult.error || 'Failed to read steps for status generation');
    }
    const statusContent = generateSqliteStatusMarkdown(
        planName,
        stepsResult.data.map((s) => ({
            number: s.number,
            title: s.title,
            status: s.status,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
        }))
    );
    const now = new Date().toISOString();
    await provider.saveFile({
        type: 'status',
        filename: 'STATUS.md',
        content: statusContent,
        createdAt: now,
        updatedAt: now,
    });
}

// ============================================================================
// Step Start
// ============================================================================

async function executeStepStart(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        if (planPath.endsWith('.plan')) {
            const provider = createSqliteProvider(planPath);
            try {
                const [metadataResult, stepResult] = await Promise.all([
                    provider.getMetadata(),
                    provider.getStep(args.step),
                ]);

                if (!metadataResult.success || !metadataResult.data) {
                    throw new Error(metadataResult.error || 'Failed to read plan metadata');
                }
                if (!stepResult.success) {
                    throw new Error(stepResult.error || `Failed to read step ${args.step}`);
                }
                if (!stepResult.data) {
                    throw new Error(`Step ${args.step} does not exist`);
                }

                const now = new Date().toISOString();
                const updateResult = await provider.updateStep(args.step, {
                    status: 'in_progress',
                    startedAt: stepResult.data.startedAt || now,
                });
                if (!updateResult.success) {
                    throw new Error(updateResult.error || `Failed to start step ${args.step}`);
                }

                const metadataUpdateResult = await provider.updateMetadata({
                    stage: 'executing',
                    updatedAt: now,
                });
                if (!metadataUpdateResult.success) {
                    throw new Error(metadataUpdateResult.error || 'Failed to update plan stage');
                }

                await provider.addTimelineEvent({
                    id: randomUUID(),
                    timestamp: now,
                    type: 'step_started',
                    data: {
                        step: args.step,
                        title: stepResult.data.title,
                    },
                });

                const stepsResult = await provider.getSteps();
                if (stepsResult.success && stepsResult.data) {
                    const statusContent = generateSqliteStatusMarkdown(
                        metadataResult.data.name,
                        stepsResult.data.map((s) => ({
                            number: s.number,
                            title: s.title,
                            status: s.status,
                            startedAt: s.startedAt,
                            completedAt: s.completedAt,
                        }))
                    );
                    await provider.saveFile({
                        type: 'status',
                        filename: 'STATUS.md',
                        content: statusContent,
                        createdAt: now,
                        updatedAt: now,
                    });
                }

                return createSuccess(
                    { planId: metadataResult.data.id, step: args.step },
                    `Step ${args.step} marked as started`
                );
            } finally {
                await provider.close();
            }
        }
        
        // Ensure plan has manifest
        await ensurePlanManifest(planPath);
        
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
            { planId: plan.metadata.code, step: args.step },
            `Step ${args.step} marked as started`
        );
    } catch (error) {
        return formatError(error);
    }
}

// ============================================================================
// Step Complete
// ============================================================================

async function executeStepComplete(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        if (planPath.endsWith('.plan')) {
            const provider = createSqliteProvider(planPath);
            try {
                const [metadataResult, stepResult, allStepsResult] = await Promise.all([
                    provider.getMetadata(),
                    provider.getStep(args.step),
                    provider.getSteps(),
                ]);
                if (!metadataResult.success || !metadataResult.data) {
                    throw new Error(metadataResult.error || 'Failed to read plan metadata');
                }
                if (!stepResult.success || !stepResult.data) {
                    throw new Error(stepResult.error || `Step ${args.step} does not exist`);
                }
                if (!allStepsResult.success || !allStepsResult.data) {
                    throw new Error(allStepsResult.error || 'Failed to read plan steps');
                }

                const now = new Date().toISOString();
                const updateResult = await provider.updateStep(args.step, {
                    status: 'completed',
                    completedAt: now,
                    startedAt: stepResult.data.startedAt || now,
                });
                if (!updateResult.success) {
                    throw new Error(updateResult.error || `Failed to complete step ${args.step}`);
                }

                const refreshedStepsResult = await provider.getSteps();
                const refreshedSteps = refreshedStepsResult.success ? (refreshedStepsResult.data || []) : [];
                const allStepsCompleted = refreshedSteps.every(
                    (s) => s.status === 'completed' || s.status === 'skipped'
                );

                await provider.updateMetadata({
                    stage: allStepsCompleted ? 'completed' : 'executing',
                    updatedAt: now,
                });

                await provider.addTimelineEvent({
                    id: randomUUID(),
                    timestamp: now,
                    type: 'step_completed',
                    data: {
                        step: args.step,
                        title: stepResult.data.title,
                    },
                });

                await saveSqliteStatusArtifact(provider, metadataResult.data.name);

                if (allStepsCompleted) {
                    return createSuccess(
                        { planId: metadataResult.data.id, step: args.step, planCompleted: true },
                        `Step ${args.step} marked as completed.\n\n` +
                        `🎉 All steps completed! Plan execution is finished.\n\n` +
                        `**Next: Generate Plan Retrospective**\n` +
                        `Call \`riotplan_generate_retrospective\` to create a retrospective that captures learning from this execution.\n\n` +
                        `**Recommendation**: Use the highest-tier model available (e.g., Claude Opus, GPT-4) for retrospective generation. ` +
                        `Retrospectives require creative analysis and pattern recognition to produce valuable insights.`
                    );
                }

                return createSuccess(
                    { planId: metadataResult.data.id, step: args.step },
                    `Step ${args.step} marked as completed`
                );
            } finally {
                await provider.close();
            }
        }
        
        // Ensure plan has manifest
        await ensurePlanManifest(planPath);
        
        const plan = await loadPlan(planPath);
        const updatedStep = await completeStep(plan, args.step, {
            notes: undefined,
            force: args.force,
            skipVerification: args.skipVerification,
        });
        
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
                { planId: plan.metadata.code, step: args.step, planCompleted: true },
                `Step ${args.step} marked as completed.\n\n` +
                `🎉 All steps completed! Plan execution is finished.\n\n` +
                `**Next: Generate Plan Retrospective**\n` +
                `Call \`riotplan_generate_retrospective\` to create a retrospective that captures learning from this execution.\n\n` +
                `**Recommendation**: Use the highest-tier model available (e.g., Claude Opus, GPT-4) for retrospective generation. ` +
                `Retrospectives require creative analysis and pattern recognition to produce valuable insights.`
            );
        }

        return createSuccess(
            { planId: plan.metadata.code, step: args.step },
            `Step ${args.step} marked as completed`
        );
    } catch (error) {
        return formatError(error);
    }
}

// ============================================================================
// Step Add
// ============================================================================

async function executeStepAdd(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        if (planPath.endsWith('.plan')) {
            const provider = createSqliteProvider(planPath);
            try {
                const [metadataResult, stepsResult] = await Promise.all([
                    provider.getMetadata(),
                    provider.getSteps(),
                ]);
                if (!metadataResult.success || !metadataResult.data) {
                    throw new Error(metadataResult.error || 'Failed to read plan metadata');
                }
                if (!stepsResult.success || !stepsResult.data) {
                    throw new Error(stepsResult.error || 'Failed to read steps');
                }

                const sorted = [...stepsResult.data].sort((a, b) => a.number - b.number);
                const requestedPosition = args.number ?? (args.after ? args.after + 1 : sorted.length + 1);
                if (requestedPosition < 1 || requestedPosition > sorted.length + 1) {
                    throw new Error(`Invalid insertion position: ${requestedPosition}`);
                }

                const inserted = {
                    number: requestedPosition,
                    code: args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `step-${requestedPosition}`,
                    title: args.title,
                    description: args.title,
                    status: 'pending' as const,
                    content: buildStepContent(requestedPosition, args.title),
                };

                const combined = [
                    ...sorted.slice(0, requestedPosition - 1),
                    inserted,
                    ...sorted.slice(requestedPosition - 1),
                ].map((step, index) => ({
                    ...step,
                    number: index + 1,
                    content: step.content || buildStepContent(index + 1, step.title),
                }));

                await rewriteSqliteSteps(provider, combined);
                await saveSqliteStatusArtifact(provider, metadataResult.data.name);

                return createSuccess(
                    {
                        planId: metadataResult.data.id,
                        step: requestedPosition,
                        file: `${requestedPosition.toString().padStart(2, '0')}-${args.title.toLowerCase().replace(/\s+/g, '-')}.md`,
                        renamedFiles: [],
                    },
                    `Step "${args.title}" added as step ${requestedPosition}`
                );
            } finally {
                await provider.close();
            }
        }
        
        const plan = await loadPlan(planPath);
        
        const result = await insertStep(plan, {
            title: args.title,
            position: args.number,
            after: args.after,
            status: 'pending',
        });

        return createSuccess(
            { 
                planId: plan.metadata.code,
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

// ============================================================================
// Step Remove
// ============================================================================

async function executeStepRemove(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        if (planPath.endsWith('.plan')) {
            const provider = createSqliteProvider(planPath);
            try {
                const [metadataResult, stepsResult] = await Promise.all([
                    provider.getMetadata(),
                    provider.getSteps(),
                ]);
                if (!metadataResult.success || !metadataResult.data) {
                    throw new Error(metadataResult.error || 'Failed to read plan metadata');
                }
                if (!stepsResult.success || !stepsResult.data) {
                    throw new Error(stepsResult.error || 'Failed to read steps');
                }

                const sorted = [...stepsResult.data].sort((a, b) => a.number - b.number);
                const removed = sorted.find((step) => step.number === args.step);
                if (!removed) {
                    throw new Error(`Step ${args.step} not found`);
                }

                const remaining = sorted
                    .filter((step) => step.number !== args.step)
                    .map((step, index) => ({ ...step, number: index + 1 }));

                await rewriteSqliteSteps(provider, remaining);
                await saveSqliteStatusArtifact(provider, metadataResult.data.name);

                return createSuccess(
                    {
                        planId: metadataResult.data.id,
                        removedStep: args.step,
                        removedTitle: removed.title,
                        deletedFile: `${args.step.toString().padStart(2, '0')}-${removed.title.toLowerCase().replace(/\s+/g, '-')}.md`,
                        renamedFiles: [],
                    },
                    `Step ${args.step} "${removed.title}" removed.`
                );
            } finally {
                await provider.close();
            }
        }
        
        const plan = await loadPlan(planPath);
        
        const result = await removeStep(plan, args.step);

        // Regenerate STATUS.md
        const updatedPlan = await loadPlan(planPath);
        const statusContent = await generateStatus(updatedPlan);
        await writeFile(join(planPath, 'STATUS.md'), statusContent, 'utf-8');

        return createSuccess(
            { 
                planId: plan.metadata.code,
                removedStep: result.removedStep.number,
                removedTitle: result.removedStep.title,
                deletedFile: result.deletedFile,
                renamedFiles: result.renamedFiles,
            },
            `Step ${args.step} "${result.removedStep.title}" removed. ${result.renamedFiles.length} files renumbered.`
        );
    } catch (error) {
        return formatError(error);
    }
}

// ============================================================================
// Step Move
// ============================================================================

async function executeStepMove(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        if (planPath.endsWith('.plan')) {
            const provider = createSqliteProvider(planPath);
            try {
                const [metadataResult, stepsResult] = await Promise.all([
                    provider.getMetadata(),
                    provider.getSteps(),
                ]);
                if (!metadataResult.success || !metadataResult.data) {
                    throw new Error(metadataResult.error || 'Failed to read plan metadata');
                }
                if (!stepsResult.success || !stepsResult.data) {
                    throw new Error(stepsResult.error || 'Failed to read steps');
                }

                const sorted = [...stepsResult.data].sort((a, b) => a.number - b.number);
                const fromIndex = sorted.findIndex((step) => step.number === args.from);
                if (fromIndex === -1) {
                    throw new Error(`Step ${args.from} not found`);
                }
                if (args.to < 1 || args.to > sorted.length) {
                    throw new Error(`Target step position must be between 1 and ${sorted.length}`);
                }

                const [moved] = sorted.splice(fromIndex, 1);
                sorted.splice(args.to - 1, 0, moved);
                const reordered = sorted.map((step, index) => ({ ...step, number: index + 1 }));

                await rewriteSqliteSteps(provider, reordered);
                await saveSqliteStatusArtifact(provider, metadataResult.data.name);

                return createSuccess(
                    {
                        planId: metadataResult.data.id,
                        step: args.from,
                        from: args.from,
                        to: args.to,
                        renamedFiles: [],
                    },
                    `Step moved from position ${args.from} to position ${args.to}.`
                );
            } finally {
                await provider.close();
            }
        }
        
        const plan = await loadPlan(planPath);
        
        const result = await moveStep(plan, args.from, args.to);

        // Regenerate STATUS.md
        const updatedPlan = await loadPlan(planPath);
        const statusContent = await generateStatus(updatedPlan);
        await writeFile(join(planPath, 'STATUS.md'), statusContent, 'utf-8');

        return createSuccess(
            { 
                planId: plan.metadata.code,
                step: result.step.number,
                from: args.from,
                to: args.to,
                renamedFiles: result.renamedFiles,
            },
            `Step moved from position ${args.from} to position ${args.to}. ${result.renamedFiles.length} files renumbered.`
        );
    } catch (error) {
        return formatError(error);
    }
}

const StepActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('start'),
        planId: z.string().optional(),
        step: z.number(),
    }),
    z.object({
        action: z.literal('complete'),
        planId: z.string().optional(),
        step: z.number(),
        force: z.boolean().optional(),
        skipVerification: z.boolean().optional(),
    }),
    z.object({
        action: z.literal('add'),
        planId: z.string().optional(),
        title: z.string(),
        number: z.number().optional(),
        after: z.number().optional(),
    }),
    z.object({
        action: z.literal('remove'),
        planId: z.string().optional(),
        step: z.number(),
    }),
    z.object({
        action: z.literal('move'),
        planId: z.string().optional(),
        from: z.number(),
        to: z.number(),
    }),
]);

const StepToolSchema = {
    action: z
        .enum(['start', 'complete', 'add', 'remove', 'move'])
        .describe('Step action to perform'),
    planId: z.string().optional().describe('Plan identifier (defaults to current plan context)'),
    step: z.number().optional().describe('Step number for start/complete/remove'),
    force: z.boolean().optional().describe('Force completion when action=complete'),
    skipVerification: z
        .boolean()
        .optional()
        .describe('Skip verification checks when action=complete'),
    title: z.string().optional().describe('Step title when action=add'),
    number: z.number().optional().describe('Step number insertion target when action=add'),
    after: z.number().optional().describe('Insert after this step when action=add'),
    from: z.number().optional().describe('Source step number when action=move'),
    to: z.number().optional().describe('Target step number when action=move'),
} satisfies z.ZodRawShape;

async function executeStep(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = StepActionSchema.parse(args);
        switch (validated.action) {
            case 'start':
                return executeStepStart(validated, context);
            case 'complete':
                return executeStepComplete(validated, context);
            case 'add':
                return executeStepAdd(validated, context);
            case 'remove':
                return executeStepRemove(validated, context);
            case 'move':
                return executeStepMove(validated, context);
        }
    } catch (error) {
        return formatError(error);
    }
}

export const stepTool: McpTool = {
    name: 'riotplan_step',
    description:
        'Manage plan steps with a single action-based tool. ' +
        'Use action=start|complete|add|remove|move.',
    schema: StepToolSchema,
    execute: executeStep,
};
