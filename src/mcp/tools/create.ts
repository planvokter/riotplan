/**
 * Create Tool - Create a new plan
 */

import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess, isIdeaOrShapingDirectory } from './shared.js';
import { createPlan } from '../../plan/creator.js';
import { join } from 'node:path';

export const createTool: McpTool = {
    name: 'riotplan_create',
    description:
        'Create a new plan directory with AI generation. ' +
        'Generates detailed, actionable plans from descriptions. ' +
        'Warns if target directory is already an idea/shaping directory (use riotplan_build instead).',
    inputSchema: {
        type: 'object',
        properties: {
            code: {
                type: 'string',
                description: 'Plan code/identifier (e.g., "my-feature")',
            },
            name: {
                type: 'string',
                description: 'Human-readable plan name',
            },
            description: {
                type: 'string',
                description: 'Plan description/prompt',
            },
            directory: {
                type: 'string',
                description: 'Parent directory for plan (defaults to current directory)',
            },
            steps: {
                type: 'number',
                description: 'Number of steps to generate (default: auto-determined)',
            },
            direct: {
                type: 'boolean',
                description: 'Skip analysis, generate directly (default: false)',
            },
            provider: {
                type: 'string',
                description: 'AI provider (anthropic, openai, gemini)',
            },
            model: {
                type: 'string',
                description: 'Specific model to use',
            },
            noAi: {
                type: 'boolean',
                description: 'Use templates only, no AI generation (default: false)',
            },
        },
        required: ['code', 'description'],
    },
};

export async function executeCreate(
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

        return createSuccess(
            {
                planPath: result.path,
                code: args.code,
                stepsCreated: result.plan.steps?.length || 0,
                filesCreated: result.filesCreated || [],
                warning: detection.isIdeaOrShaping ? 'Existing idea/shaping directory detected' : undefined,
            },
            `Plan "${args.code}" created successfully at ${result.path}${warningMessage}`
        );
    } catch (error) {
        return formatError(error);
    }
}
