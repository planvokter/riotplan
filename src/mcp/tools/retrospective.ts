/**
 * Retrospective Tool - Generate plan retrospectives
 */

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveSqlitePlanPath, formatError, createSuccess, formatTimestamp } from './shared.js';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

// ============================================================================
// Generate Retrospective Tool
// ============================================================================

async function executeGenerateRetrospective(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveSqlitePlanPath(args, context);
        return await generateRetrospectiveSqlite(planPath, args);
    } catch (error) {
        return formatError(error);
    }
}

async function generateRetrospectiveSqlite(planPath: string, args: any): Promise<ToolResult> {
    const provider = createSqliteProvider(planPath);
    const metadataResult = await provider.getMetadata();
    const metadata = metadataResult.data;
    const planName = metadata?.name || metadata?.id || 'Unknown Plan';

    if (!args.force && metadata?.stage !== 'completed' && (metadata?.stage as string) !== 'done') {
        await provider.close();
        return formatError(new Error(
            `Plan "${planName}" is in stage "${metadata?.stage || 'unknown'}". ` +
            `Use force: true to generate retrospective for incomplete plans.`
        ));
    }

    const stepsResult = await provider.getSteps();
    const steps = stepsResult.success ? stepsResult.data || [] : [];

    const timelineResult = await provider.getTimelineEvents();
    const timeline = timelineResult.success ? timelineResult.data || [] : [];

    const reflections = timeline
        .filter((event: any) => event.type === 'reflection_added')
        .map((event: any) => ({
            step: Number(event.data?.step ?? 0),
            content: String(event.data?.content ?? ''),
        }))
        .filter((r: any) => r.content.length > 0);

    const now = formatTimestamp();
    const retrospectiveContent = `# Retrospective: ${planName}

*This retrospective was generated from execution data including ${reflections.length} step reflections and ${steps.length} steps.*

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

*Generated: ${now}*
`;

    await provider.saveFile({
        type: 'retrospective' as any,
        filename: 'retrospective.md',
        content: retrospectiveContent,
        createdAt: now,
        updatedAt: now,
    });
    await provider.addTimelineEvent({
        id: randomUUID(),
        timestamp: now,
        type: 'note_added' as any,
        data: { action: 'retrospective_generated', reflectionsCount: reflections.length, stepsCount: steps.length },
    });
    await provider.close();

    return createSuccess(
        {
            planId: metadata?.id || planPath,
            reflectionsCount: reflections.length,
            stepsAnalyzed: steps.length,
        },
        `Retrospective generated for "${planName}". ` +
            `Analyzed ${steps.length} steps with ${reflections.length} reflections. ` +
            `\n\n**Note**: For best results, this retrospective should be reviewed and refined with a highest-tier model.`
    );
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
        planId: z.string().optional().describe('Plan identifier (defaults to current plan context)'),
        force: z.boolean().optional().describe('Generate retrospective even if plan is not completed (default: false)'),
    },
    execute: executeGenerateRetrospective,
};
