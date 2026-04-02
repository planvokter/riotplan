/**
 * Step Tools - Manage plan steps
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { loadPlan, insertStep, removeStep, moveStep, saveStatusDoc, generateStatus } from '@planvokter/riotplan';
import { randomUUID } from 'node:crypto';
import { createSqliteProvider } from '@planvokter/riotplan-format';

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
        const plan = await loadPlan(planPath);

        const result = await insertStep(plan, {
            title: args.title,
            position: args.number,
            after: args.after,
            status: 'pending',
        });

        const refreshed = await loadPlan(planPath);
        const statusContent = await generateStatus(refreshed);
        await saveStatusDoc(planPath, statusContent);

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
        const plan = await loadPlan(planPath);
        const result = await removeStep(plan, args.step);

        const updatedPlan = await loadPlan(planPath);
        const statusContent = await generateStatus(updatedPlan);
        await saveStatusDoc(planPath, statusContent);

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
        const plan = await loadPlan(planPath);
        const result = await moveStep(plan, args.from, args.to);

        const updatedPlan = await loadPlan(planPath);
        const statusContent = await generateStatus(updatedPlan);
        await saveStatusDoc(planPath, statusContent);

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
