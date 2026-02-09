/**
 * Retrospective Tool - Generate plan retrospectives
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { generateRetrospective } from '../../retrospective/generator.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ============================================================================
// Generate Retrospective Tool
// ============================================================================

async function executeGenerateRetrospective(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = args.path ? args.path : resolveDirectory(args, context);

        // Generate the retrospective context and prompt
        const { context: retroContext, prompt } = await generateRetrospective(
            planPath,
            {
                force: args.force || false,
            }
        );

        // Note: In a real implementation, this would call an LLM with the prompt
        // For now, we'll write a placeholder retrospective that includes the prompt
        // The actual LLM integration would happen here

        const retrospectiveContent = `# Retrospective: ${retroContext.plan.metadata.name}

*This retrospective was generated from execution data including ${retroContext.reflections.length} step reflections.*

---

## Plan vs Reality

[Retrospective content would be generated here by applying the prompt to a high-tier model]

## What Went Right

[Analysis of successful patterns and approaches]

## What Went Wrong

[Analysis of failed assumptions and friction points]

## What Would You Do Differently

[Concrete recommendations for future plans]

---

*Generated: ${new Date().toISOString()}*

<!-- 
PROMPT USED FOR GENERATION:

${prompt}
-->
`;

        // Write retrospective.md
        const retrospectivePath = join(planPath, 'retrospective.md');
        await writeFile(retrospectivePath, retrospectiveContent, 'utf-8');

        return createSuccess(
            {
                planPath,
                retrospectivePath,
                reflectionsCount: retroContext.reflections.length,
                stepsAnalyzed: retroContext.plan.steps.length,
            },
            `Retrospective generated at ${retrospectivePath}. ` +
                `Analyzed ${retroContext.plan.steps.length} steps with ${retroContext.reflections.length} reflections. ` +
                `\n\n**Note**: For best results, this retrospective should be reviewed and refined with a highest-tier model.`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const generateRetrospectiveTool: McpTool = {
    name: 'riotplan_generate_retrospective',
    description:
        'Generate a plan retrospective that analyzes execution and provides insights for future planning. ' +
        'This tool loads all execution context (reflections, plan files, status) and generates a high-value ' +
        'retrospective focused on what went right, what went wrong, and what should be done differently. ' +
        '\n\n' +
        '**IMPORTANT**: This tool produces best results with the highest-tier reasoning model available ' +
        '(e.g., Claude Opus, GPT-4). Retrospectives require creative analysis and pattern recognition. ' +
        'Lower-tier models tend to produce generic observations rather than surprising insights.',
    schema: {
        path: z.string().optional().describe('Plan directory path (defaults to current directory)'),
        force: z.boolean().optional().describe('Generate retrospective even if plan is not completed (default: false)'),
    },
    execute: executeGenerateRetrospective,
};
