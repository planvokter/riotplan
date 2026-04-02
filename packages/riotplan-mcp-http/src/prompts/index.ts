/**
 * MCP Prompt Handlers
 *
 * Provides workflow templates via MCP prompts.
 * Prompts are loaded from external markdown files in this directory.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpPrompt, McpPromptMessage } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to resolve the prompts directory path
 * When bundled, the MCP server is at dist/mcp-server-http.js and prompts are at dist/mcp/prompts/
 * When running from source, prompts are at src/mcp/prompts/
 */
function getPromptsDir(): string {
    // Check if we're running from a bundled file (dist/mcp-server-http.js)
    const isBundled = __dirname.includes('/dist') || __dirname.endsWith('dist') ||
                      __filename.includes('dist/mcp-server-http.js') || __filename.includes('dist\\mcp-server-http.js');

    if (isBundled) {
        // When bundled, prompts are at dist/mcp/prompts/
        return resolve(__dirname, 'mcp/prompts');
    }
    // When running from source, prompts are in the same directory as this file
    return __dirname;
}

/**
 * Helper to load a prompt template from a markdown file
 */
function loadTemplate(name: string): string {
    const promptsDir = getPromptsDir();
    const path = resolve(promptsDir, `${name}.md`);
    try {
        return readFileSync(path, 'utf-8').trim();
    } catch (error) {
        throw new Error(`Failed to load prompt template "${name}" from ${path}: ${error}`);
    }
}

/**
 * Helper to replace placeholders in a template
 */
function fillTemplate(template: string, args: Record<string, string>): string {
    return template.replace(/\${(\w+)}/g, (_, key) => {
        return args[key] || `[${key}]`;
    });
}

/**
 * Get all available prompts
 */
export function getPrompts(): McpPrompt[] {
    return [
        {
            name: 'explore_idea',
            description: 'Explore a new idea collaboratively without premature commitment. Capture thoughts, constraints, questions, and evidence.',
            arguments: [
                {
                    name: 'code',
                    description: 'Idea identifier (kebab-case, e.g., "real-time-notifications")',
                    required: false,
                },
                {
                    name: 'description',
                    description: 'Initial concept description',
                    required: false,
                },
            ],
        },
        {
            name: 'shape_approach',
            description: 'Compare different approaches and make decisions before building detailed plans. Surface tradeoffs and gather evidence.',
            arguments: [
                {
                    name: 'planId',
                    description: 'Plan identifier to shape',
                    required: false,
                },
            ],
        },
        {
            name: 'create_plan',
            description: 'Create a new plan with AI-generated steps for a complex task (use after shaping)',
            arguments: [
                {
                    name: 'code',
                    description: 'Plan code/identifier (e.g., "auth-system", "dark-mode")',
                    required: false,
                },
                {
                    name: 'description',
                    description: 'Detailed description of what you want to accomplish',
                    required: false,
                },
                {
                    name: 'projectId',
                    description: 'Optional project identifier for the new plan',
                    required: false,
                },
                {
                    name: 'steps',
                    description: 'Number of steps to generate (optional, AI will determine if not specified)',
                    required: false,
                },
            ],
        },
        {
            name: 'develop_plan',
            description: 'Refine a generated plan through conversational feedback. Captures full narrative of plan evolution with checkpoints.',
            arguments: [
                {
                    name: 'planId',
                    description: 'Plan identifier to develop',
                    required: false,
                },
            ],
        },
        {
            name: 'execute_plan',
            description: 'Execute a plan with intelligent state management. Automatically determines next step, guides through tasks, and manages execution state.',
            arguments: [
                {
                    name: 'planId',
                    description: 'Plan identifier to execute',
                    required: false,
                },
            ],
        },
        {
            name: 'execute_step',
            description: 'Execute a single step from a plan with proper status tracking',
            arguments: [
                {
                    name: 'planId',
                    description: 'Plan identifier',
                    required: false,
                },
            ],
        },
        {
            name: 'track_progress',
            description: 'Monitor plan progress and maintain status tracking',
            arguments: [
                {
                    name: 'planId',
                    description: 'Plan identifier',
                    required: false,
                },
            ],
        },
    ];
}

/**
 * Options for getPrompt (used in HTTP/remote mode)
 */
export interface GetPromptOptions {
    /** Base plans directory - used only for internal defaults when needed */
    plansDir?: string;
}

/**
 * Get a prompt by name
 * @param name - Prompt name
 * @param args - Prompt arguments (code, description, planId, etc.)
 * @param options - Optional plansDir for HTTP/remote mode
 */
export async function getPrompt(
    name: string,
    args: Record<string, string>,
    options?: GetPromptOptions
): Promise<McpPromptMessage[]> {
    // Validate prompt exists
    const prompts = getPrompts();
    const prompt = prompts.find(p => p.name === name);
    if (!prompt) {
        throw new Error(`Unknown prompt: ${name}`);
    }

    // Load and fill template
    const template = loadTemplate(name);

    // Set default values for common arguments if missing
    const filledArgs = { ...args };
    void options;

    // For explore_idea, mark missing fields
    if (name === 'explore_idea') {
        if (!filledArgs.code) filledArgs.code = '[idea-code]';
        if (!filledArgs.description) filledArgs.description = '[initial concept]';
    }

    // For create_plan, keep placeholders for optional fields.
    if (name === 'create_plan') {
        if (!filledArgs.code) filledArgs.code = '[code]';
        if (!filledArgs.description) filledArgs.description = '[description]';
        if (!filledArgs.projectId) filledArgs.projectId = '[project-id]';
        if (!filledArgs.steps) filledArgs.steps = '[steps]';
    }

    // For plan-oriented prompts, default to current plan context.
    if (!filledArgs.planId) {
        filledArgs.planId = '[current-plan-id]';
    }

    const content = fillTemplate(template, filledArgs);

    return [
        {
            role: 'user',
            content: {
                type: 'text',
                text: content,
            },
        },
    ];
}
