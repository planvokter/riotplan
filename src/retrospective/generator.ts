/**
 * Retrospective Generator
 *
 * Generates plan retrospectives by analyzing execution data and applying
 * the retrospective generation prompt.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readAllReflections } from '../reflections/reader.js';
import { loadPlan } from '../plan/loader.js';
import type { Plan } from '../types.js';

export interface GenerateRetrospectiveOptions {
    /**
     * Provider to use for generation (anthropic, openai, etc.)
     * Defaults to anthropic
     */
    provider?: string;

    /**
     * Model to use for generation
     * Should be highest-tier model available (e.g., claude-opus-4, gpt-4)
     */
    model?: string;

    /**
     * Force generation even if plan is not completed
     */
    force?: boolean;
}

export interface RetrospectiveContext {
    /** The loaded plan */
    plan: Plan;

    /** All step reflections */
    reflections: Array<{ step: number; content: string }>;

    /** Original plan summary */
    summary?: string;

    /** Execution plan */
    executionPlan?: string;

    /** Current status */
    status?: string;

    /** Individual step files */
    stepFiles: Array<{ number: number; title: string; content: string }>;
}

/**
 * Load all context needed for retrospective generation
 */
export async function loadRetrospectiveContext(
    planPath: string
): Promise<RetrospectiveContext> {
    const plan = await loadPlan(planPath);

    // Load reflections
    const reflections = await readAllReflections(planPath);

    // Load plan files
    const summary = await readFileIfExists(join(planPath, 'SUMMARY.md'));
    const executionPlan = await readFileIfExists(
        join(planPath, 'EXECUTION_PLAN.md')
    );
    const status = await readFileIfExists(join(planPath, 'STATUS.md'));

    // Load step files
    const stepFiles: Array<{ number: number; title: string; content: string }> =
        [];
    for (const step of plan.steps) {
        const content = await readFileIfExists(step.filePath);
        if (content) {
            stepFiles.push({
                number: step.number,
                title: step.title,
                content,
            });
        }
    }

    return {
        plan,
        reflections,
        summary,
        executionPlan,
        status,
        stepFiles,
    };
}

/**
 * Helper to read a file if it exists
 */
async function readFileIfExists(path: string): Promise<string | undefined> {
    if (!existsSync(path)) {
        return undefined;
    }
    try {
        return await readFile(path, 'utf-8');
    } catch {
        return undefined;
    }
}

/**
 * Format the context into a prompt for retrospective generation
 */
export function formatRetrospectivePrompt(
    context: RetrospectiveContext
): string {
    const { plan, reflections, summary, executionPlan, status, stepFiles } =
        context;

    let prompt = `# Plan Retrospective Generation

You are generating a retrospective for the plan: **${plan.metadata.name}**

## Original Plan

`;

    if (summary) {
        prompt += `### SUMMARY.md

${summary}

`;
    }

    if (executionPlan) {
        prompt += `### EXECUTION_PLAN.md

${executionPlan}

`;
    }

    prompt += `## Step Files

`;

    for (const stepFile of stepFiles) {
        prompt += `### Step ${stepFile.number}: ${stepFile.title}

${stepFile.content}

`;
    }

    prompt += `## Actual Execution

`;

    if (status) {
        prompt += `### STATUS.md

${status}

`;
    }

    prompt += `## Step Reflections

`;

    if (reflections.length === 0) {
        prompt += `*No step reflections were captured during execution.*

This limits the depth of analysis possible. Future plans should ensure reflections are written after each step.

`;
    } else {
        for (const reflection of reflections) {
            prompt += `### Step ${reflection.step} Reflection

${reflection.content}

`;
        }
    }

    prompt += `## Your Task

Using the retrospective generation guidelines, analyze this plan's execution and write a high-value retrospective.

Focus on:
1. **What went right?** - Patterns and approaches that worked well
2. **What went wrong?** - Where assumptions failed or friction occurred
3. **What would you do differently?** - Concrete changes for next time

Be specific. Be honest. Be useful. Avoid generic observations.

Compare what was planned (original plan) vs what actually happened (status and reflections).

Identify the single most surprising thing and the assumption that was most wrong.

Write the retrospective now:
`;

    return prompt;
}

/**
 * Generate a retrospective for a completed plan
 *
 * Note: This function prepares the context and prompt but does NOT
 * actually call an LLM. That's handled by the MCP tool layer which
 * has access to the model execution infrastructure.
 */
export async function generateRetrospective(
    planPath: string,
    options: GenerateRetrospectiveOptions = {}
): Promise<{ context: RetrospectiveContext; prompt: string }> {
    const context = await loadRetrospectiveContext(planPath);

    // Validate plan is completed (unless forced)
    if (!options.force) {
        const allCompleted = context.plan.steps.every(
            (s) => s.status === 'completed' || s.status === 'skipped'
        );
        if (!allCompleted) {
            throw new Error(
                'Plan is not completed. Use force: true to generate retrospective anyway.'
            );
        }
    }

    // Warn if no reflections
    if (context.reflections.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(
            'Warning: No step reflections found. Retrospective will have limited depth.'
        );
    }

    const prompt = formatRetrospectivePrompt(context);

    return { context, prompt };
}
