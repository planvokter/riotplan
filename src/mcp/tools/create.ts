/**
 * Create Tool - Create a new plan
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess, isIdeaOrShapingDirectory, ensurePlanManifest } from './shared.js';
import { createPlan } from '../../plan/creator.js';
import { join } from 'node:path';

async function executeCreate(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const parentDir = args.directory ? args.directory : resolveDirectory(args, context);
        const targetPath = join(parentDir, args.code);
        
        // Check if target directory is already an idea/shaping directory
        const detection = await isIdeaOrShapingDirectory(targetPath);
        
        let warningMessage = '';
        if (detection.isIdeaOrShaping) {
            const detectedFiles = detection.detected.join(', ');
            const stageInfo = detection.stage ? ` (stage: ${detection.stage})` : '';
            warningMessage = `\n\n⚠️  WARNING: Target directory appears to be an existing ${detection.stage || 'idea/shaping'} directory${stageInfo}.\n` +
                `Detected: ${detectedFiles}\n` +
                `Consider using 'riotplan_build' to create plan files in the existing directory instead of creating a new nested directory.`;
        }
        
        // Build step configs if AI generation is requested
        let steps: Array<{ title: string; description?: string }> | undefined;
        
        // For now, create basic plan structure
        // AI generation would be added later with generatePlan integration
        const config = {
            code: args.code,
            name: args.name || args.code,
            basePath: parentDir,
            description: args.description,
            steps,
        };

        const result = await createPlan(config);

        // Always create plan.yaml manifest with plan identity
        const manifestCreated = await ensurePlanManifest(result.path, {
            id: args.code,
            title: args.name || args.code,
            catalysts: args.catalysts,
        });

        const catalystInfo = args.catalysts && args.catalysts.length > 0
            ? `\nApplied catalysts: ${args.catalysts.join(', ')}`
            : '';
        
        const manifestInfo = manifestCreated ? '\nCreated plan.yaml manifest' : '';

        return createSuccess(
            {
                planPath: result.path,
                code: args.code,
                stepsCreated: result.plan.steps?.length || 0,
                filesCreated: result.filesCreated || [],
                catalysts: args.catalysts || [],
                manifestCreated,
                warning: detection.isIdeaOrShaping ? 'Existing idea/shaping directory detected' : undefined,
            },
            `Plan "${args.code}" created successfully at ${result.path}${catalystInfo}${manifestInfo}${warningMessage}`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const createTool: McpTool = {
    name: 'riotplan_create',
    description:
        'Create a new plan directory with AI generation. ' +
        'Generates detailed, actionable plans from descriptions. ' +
        'Warns if target directory is already an idea/shaping directory (use riotplan_build instead).',
    schema: {
        code: z.string().describe('Plan code/identifier (e.g., "my-feature")'),
        name: z.string().optional().describe('Human-readable plan name'),
        description: z.string().describe('Plan description/prompt'),
        directory: z.string().optional().describe('Parent directory for plan (defaults to current directory)'),
        steps: z.number().optional().describe('Number of steps to generate (default: auto-determined)'),
        direct: z.boolean().optional().describe('Skip analysis, generate directly (default: false)'),
        provider: z.string().optional().describe('AI provider (anthropic, openai, gemini)'),
        model: z.string().optional().describe('Specific model to use'),
        noAi: z.boolean().optional().describe('Use templates only, no AI generation (default: false)'),
        catalysts: z.array(z.string()).optional().describe('Optional catalyst IDs or paths to apply to this plan'),
    },
    execute: executeCreate,
};
