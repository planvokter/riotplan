/**
 * Explore Command
 * 
 * LLM-powered idea exploration command.
 * Creates or resumes idea exploration with an interactive chat session.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolvePlanPath, withProviderConfig, runAgentSession } from './common.js';
import { exploreToolSet } from '../tools/index.js';
import { loadConfig } from '../../config/index.js';

/**
 * Load the explore_idea system prompt
 */
async function loadSystemPrompt(): Promise<string> {
    // Try to load from the MCP prompts directory
    const promptPaths = [
        // Development path
        path.join(import.meta.dirname, '../../mcp/prompts/explore_idea.md'),
        // Production path
        path.join(import.meta.dirname, '../mcp/prompts/explore_idea.md'),
    ];

    for (const promptPath of promptPaths) {
        try {
            if (fs.existsSync(promptPath)) {
                return fs.readFileSync(promptPath, 'utf-8');
            }
        } catch {
            // Try next path
        }
    }

    // Fallback to a basic system prompt
    return `You are a helpful assistant for exploring ideas and planning.
Your role is to help the user explore their idea by:
- Asking clarifying questions
- Capturing notes, constraints, and questions
- Gathering evidence
- Helping them think through the problem

Use the available RiotPlan tools to capture information as you explore.
Be conversational and helpful.`;
}

/**
 * Register the explore command
 */
export function registerExploreCommand(program: Command): void {
    program
        .command('explore [pathOrCode] [description]')
        .description('Explore an idea with an interactive LLM chat session')
        .option('-p, --provider <provider>', 'LLM provider (anthropic, openai)')
        .option('-m, --model <model>', 'Model to use')
        .action(async (pathOrCode?: string, description?: string, options?: {
            provider?: string;
            model?: string;
        }) => {
            try {
                await withProviderConfig(options || {}, async (providerConfig) => {
                    // Determine if this is a new plan or resuming
                    let planPath: string;
                    let planName: string;
                    let initialMessage: string | undefined;

                    if (!pathOrCode) {
                        // No arguments - show usage
                        console.error(chalk.red('Usage: riotplan explore <path|code> [description]'));
                        console.error(chalk.dim('  Resume existing: riotplan explore ./plans/my-idea'));
                        console.error(chalk.dim('  Create new: riotplan explore my-idea "Description of the idea"'));
                        process.exit(1);
                    }

                    // Try to resolve as existing plan
                    const resolved = await resolvePlanPath(pathOrCode);
                    
                    if (resolved?.exists) {
                        // It's an existing plan
                        planPath = resolved.planPath;
                        planName = resolved.planName;
                    } else {
                        // It's a new plan code
                        if (!description) {
                            console.error(chalk.red('Description required for new plan.'));
                            console.error(chalk.dim('Usage: riotplan explore <code> "Description of the idea"'));
                            process.exit(1);
                        }
                        
                        const config = await loadConfig();
                        const plansDir = config?.planDirectory || './plans';
                        planPath = path.resolve(path.join(plansDir, pathOrCode));
                        planName = pathOrCode;
                        initialMessage = `I want to explore a new idea: "${description}"\n\nPlease create the idea using rp_idea_create with code "${pathOrCode}" and then begin the exploration conversation.`;
                    }

                    // Load system prompt
                    const systemPrompt = await loadSystemPrompt();

                    // Run the explore session
                    await runAgentSession({
                        planPath,
                        planName,
                        mode: 'explore',
                        systemPrompt,
                        tools: exploreToolSet,
                        provider: providerConfig,
                        initialMessage,
                    });
                });

            } catch (error) {
                console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });
}
