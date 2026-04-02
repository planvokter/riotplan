/**
 * Create Tool - Create a new plan
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { assertNoClientDirectoryOverride, resolveDirectory, formatError, createSuccess } from './shared.js';
import { join } from 'node:path';
import {
    createSqliteProvider,
    formatPlanFilename,
    generatePlanUuid,
    type PlanMetadata as SqlitePlanMetadata,
    type PlanStep as SqlitePlanStep,
} from '@planvokter/riotplan-format';

function buildInitialSteps(count: number): SqlitePlanStep[] {
    const defaults = [
        { title: 'Setup', description: 'Initial setup and prerequisites' },
        { title: 'Implementation', description: 'Core implementation work' },
        { title: 'Testing', description: 'Verify everything works' },
    ];

    const selected = count <= defaults.length
        ? defaults.slice(0, count)
        : [
            ...defaults,
            ...Array.from({ length: count - defaults.length }, (_, index) => ({
                title: `Step ${defaults.length + index + 1}`,
                description: 'Additional implementation step',
            })),
        ];

    return selected.map((step, index) => ({
        number: index + 1,
        code: step.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        title: step.title,
        description: step.description,
        status: 'pending',
        content: '',
    }));
}

export async function executeCreate(
    args: any,
    context: ToolExecutionContext,
    toolName = 'riotplan_create'
): Promise<ToolResult> {
    try {
        assertNoClientDirectoryOverride(args, context, toolName);
        const parentDir = resolveDirectory(args, context);
        const uuid = generatePlanUuid();
        const planFilename = formatPlanFilename(uuid, args.code);
        const planPath = join(parentDir, planFilename);

        const provider = createSqliteProvider(planPath);
        const metadata: SqlitePlanMetadata = {
            id: args.code,
            uuid,
            name: args.name || args.code,
            description: args.description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stage: 'built',
            schemaVersion: 1,
        };

        const initResult = await provider.initialize(metadata);
        if (!initResult.success) {
            await provider.close();
            throw new Error(initResult.error || 'Failed to initialize sqlite plan');
        }

        const rawIdeaContent =
            (typeof args.ideaContent === 'string' ? args.ideaContent : '') ||
            (typeof args.idea === 'string' ? args.idea : '') ||
            (typeof args.motivation === 'string' ? args.motivation : '');
        const ideaContent = rawIdeaContent.trim();
        if (ideaContent.length > 0) {
            const now = new Date().toISOString();
            const saveIdeaResult = await provider.saveFile({
                type: 'idea',
                filename: 'IDEA.md',
                content: ideaContent,
                createdAt: now,
                updatedAt: now,
            });
            if (!saveIdeaResult.success) {
                await provider.close();
                throw new Error(saveIdeaResult.error || 'Failed to persist idea content');
            }
        }

        const requestedSteps = typeof args.steps === 'number' && Number.isFinite(args.steps)
            ? Math.max(1, Math.floor(args.steps))
            : 3;
        const steps = buildInitialSteps(requestedSteps);

        for (const step of steps) {
            const addStepResult = await provider.addStep(step);
            if (!addStepResult.success) {
                await provider.close();
                throw new Error(addStepResult.error || `Failed to add step ${step.number}`);
            }
        }

        await provider.close();

        return createSuccess(
            {
                planId: args.code,
                planUuid: uuid,
                code: args.code,
                stepsCreated: steps.length,
                catalysts: args.catalysts || [],
                storage: 'sqlite',
                ideaPersisted: ideaContent.length > 0,
            },
            `Plan "${args.code}" created successfully.`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const createTool: McpTool = {
    name: 'riotplan_create',
    description:
        'Create a new SQLite-backed plan with AI generation metadata. ' +
        'Generates detailed, actionable plans from descriptions without exposing storage paths.',
    schema: {
        code: z.string().describe('Plan code/identifier (e.g., "my-feature")'),
        name: z.string().optional().describe('Human-readable plan name'),
        description: z.string().describe('Plan description/prompt'),
        steps: z.number().optional().describe('Number of steps to generate (default: auto-determined)'),
        direct: z.boolean().optional().describe('Skip analysis, generate directly (default: false)'),
        provider: z.string().optional().describe('AI provider (anthropic, openai, gemini)'),
        model: z.string().optional().describe('Specific model to use'),
        noAi: z.boolean().optional().describe('Use templates only, no AI generation (default: false)'),
        catalysts: z.array(z.string()).optional().describe('Optional catalyst IDs or paths to apply to this plan'),
        ideaContent: z.string().optional().describe('Optional initial idea/motivation content to persist as IDEA.md'),
        idea: z.string().optional().describe('Alias for ideaContent'),
        motivation: z.string().optional().describe('Alias for ideaContent'),
    },
    execute: executeCreate,
};
