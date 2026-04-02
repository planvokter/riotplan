/**
 * Retrospective Generator
 *
 * Generates plan retrospectives by analyzing execution data from SQLite .plan files.
 */
import { readAllReflections } from '../reflections/reader.js';
import { readPlanDoc } from '../artifacts/operations.js';
import { loadPlan } from '../plan/loader.js';
import { createSqliteProvider } from '@planvokter/riotplan-format';
/**
 * Load all context needed for retrospective generation from SQLite.
 */
export async function loadRetrospectiveContext(planPath) {
    const plan = await loadPlan(planPath);
    const reflections = await readAllReflections(planPath);
    const summaryDoc = await readPlanDoc(planPath, "summary", "SUMMARY.md");
    const execDoc = await readPlanDoc(planPath, "execution_plan", "EXECUTION_PLAN.md");
    const statusDoc = await readPlanDoc(planPath, "status", "STATUS.md");
    const stepFiles = [];
    const provider = createSqliteProvider(planPath);
    try {
        const stepsResult = await provider.getSteps();
        if (stepsResult.success && stepsResult.data) {
            for (const s of stepsResult.data) {
                if (s.content) {
                    stepFiles.push({
                        number: s.number,
                        title: s.title,
                        content: s.content,
                    });
                }
            }
        }
    }
    finally {
        await provider.close();
    }
    return {
        plan,
        reflections,
        summary: summaryDoc?.content,
        executionPlan: execDoc?.content,
        status: statusDoc?.content,
        stepFiles,
    };
}
export function formatRetrospectivePrompt(context) {
    const { plan, reflections, summary, executionPlan, status, stepFiles } = context;
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
    }
    else {
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
export async function generateRetrospective(planPath, options = {}) {
    const context = await loadRetrospectiveContext(planPath);
    if (!options.force) {
        const allCompleted = context.plan.steps.every((s) => s.status === 'completed' || s.status === 'skipped');
        if (!allCompleted) {
            throw new Error('Plan is not completed. Use force: true to generate retrospective anyway.');
        }
    }
    if (context.reflections.length === 0) {
        // eslint-disable-next-line no-console
        console.warn('Warning: No step reflections found. Retrospective will have limited depth.');
    }
    const prompt = formatRetrospectivePrompt(context);
    return { context, prompt };
}
//# sourceMappingURL=generator.js.map