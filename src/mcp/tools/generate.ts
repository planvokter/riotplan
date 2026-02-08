/**
 * Generate Tool - Generate plan from existing prompt
 */

import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { formatError, createSuccess } from './shared.js';
import { generatePlan } from '../../ai/generator.js';
import { loadProvider } from '../../ai/provider-loader.js';

export const generateTool: McpTool = {
    name: 'riotplan_generate',
    description:
        'Generate plan content using AI. ' +
        'Creates detailed, actionable steps from a description. ' +
        'Note: Requires an AI provider package to be installed. ' +
        'When using RiotPlan via MCP, consider using riotplan_step_add for manual step creation instead.',
    inputSchema: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                description: 'Plan description/requirements',
            },
            steps: {
                type: 'number',
                description: 'Number of steps to generate (default: auto-determined)',
            },
            provider: {
                type: 'string',
                description: 'AI provider (anthropic, openai, gemini)',
            },
            model: {
                type: 'string',
                description: 'Specific model to use',
            },
        },
        required: ['description'],
    },
};

export async function executeGenerate(
    args: any,
    _context: ToolExecutionContext
): Promise<ToolResult> {
    const providerName = args.provider || 'anthropic';
    try {
        const provider = await loadProvider({
            name: providerName,
            apiKey: process.env[`${providerName.toUpperCase()}_API_KEY`],
        });
        
        const generationContext = {
            planName: 'Generated Plan',
            description: args.description,
            stepCount: args.steps,
        };
        
        const result = await generatePlan(generationContext, provider, {
            model: args.model,
        });

        return createSuccess(
            {
                summary: result.summary,
                approach: result.approach,
                stepsGenerated: result.steps.length,
                steps: result.steps.map(s => ({
                    number: s.number,
                    title: s.title,
                    objective: s.objective,
                })),
            },
            `Plan generated successfully with ${result.steps.length} steps`
        );
    } catch (error) {
        // Enhanced error handling for missing providers when used via MCP
        if (error instanceof Error && error.message.includes('is not installed')) {
            return {
                success: false,
                error: 'AI_PROVIDER_NOT_AVAILABLE',
                message: 
                    '⚠️  AI provider not available for automatic generation.\n\n' +
                    '**Why this happened:**\n' +
                    'The `riotplan_generate` tool requires an AI provider package to be installed, ' +
                    'but you\'re already using RiotPlan through an AI model (like Claude in Cursor).\n\n' +
                    '**Recommended approach:**\n' +
                    'Instead of using `riotplan_generate`, you can create the plan steps manually:\n' +
                    '1. Break down the requirements into specific, actionable steps\n' +
                    '2. Use `riotplan_step_add` to add each step to the plan\n' +
                    '3. This gives you more control over the plan structure\n\n' +
                    '**Alternative (if you need auto-generation):**\n' +
                    'Install an AI provider package:\n' +
                    '```bash\n' +
                    'npm install @kjerneverk/execution-anthropic\n' +
                    '```\n' +
                    'Then set your API key:\n' +
                    '```bash\n' +
                    'export ANTHROPIC_API_KEY=your-key-here\n' +
                    '```\n\n' +
                    '**Future improvement:**\n' +
                    'We\'re working on MCP sampling support so RiotPlan can delegate generation ' +
                    'to the calling AI model, eliminating the need for separate API keys.',
                context: {
                    description: args.description,
                    requestedSteps: args.steps,
                    suggestedProvider: providerName,
                },
                recovery: [
                    'Use riotplan_step_add to manually create plan steps',
                    'Install @kjerneverk/execution-anthropic and configure ANTHROPIC_API_KEY',
                    'Install @kjerneverk/execution-openai and configure OPENAI_API_KEY',
                    'Install @kjerneverk/execution-gemini and configure GOOGLE_API_KEY',
                ],
            };
        }
        
        return formatError(error);
    }
}
