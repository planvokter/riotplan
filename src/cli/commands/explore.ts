/**
 * Explore Command
 * 
 * LLM-powered idea exploration command.
 * Creates or resumes idea exploration with an interactive chat session.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolvePlanPath, isPlanDirectory, withProviderConfig, runAgentSession } from './common.js';
import { exploreToolSet } from '../tools/index.js';
import { loadConfig } from '../../config/index.js';

/**
 * Prompt user for description using their $EDITOR
 */
async function promptForDescription(code: string): Promise<string> {
    console.log(chalk.cyan(`\nDescribe your idea for "${code}":`));
    const { description } = await inquirer.prompt([
        {
            type: 'editor',
            name: 'description',
            message: 'Describe your idea (opens editor):',
            default: `# ${code}\n\nDescribe your idea here...\n`,
        },
    ]);
    return description.trim();
}

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
                        // No arguments - check if current directory is a plan
                        const cwd = process.cwd();
                        if (isPlanDirectory(cwd)) {
                            // Current directory is a plan - explore it
                            planPath = cwd;
                            planName = path.basename(cwd);
                            // Set initial message to resume the existing plan
                            initialMessage = `Resume the existing plan "${planName}" at "${planPath}". Be brief: show key metadata (stage, step count, last activity) in 2-3 lines, then ask ONE question about what to focus on.`;
                        } else {
                            // Not in a plan directory - show usage
                            console.error(chalk.red('Usage: riotplan explore <path|code> [description]'));
                            console.error(chalk.dim('  Resume existing: riotplan explore ./plans/my-idea'));
                            console.error(chalk.dim('  Create new: riotplan explore my-idea "Description of the idea"'));
                            console.error(chalk.dim('  Or run from within a plan directory: cd ./plans/my-idea && riotplan explore'));
                            process.exit(1);
                        }
                    } else {
                        // Try to resolve as existing plan
                        const resolved = await resolvePlanPath(pathOrCode);
                        
                        if (resolved?.exists) {
                            // It's an existing plan - set initial message to resume
                            planPath = resolved.planPath;
                            planName = resolved.planName;
                            initialMessage = `Resume the existing plan "${planName}" at "${planPath}". Be brief: show key metadata (stage, step count, last activity) in 2-3 lines, then ask ONE question about what to focus on.`;
                        } else {
                            // It's a new plan code - prompt for description if not provided
                            let ideaDescription = description;
                            if (!ideaDescription) {
                                ideaDescription = await promptForDescription(pathOrCode);
                                if (!ideaDescription) {
                                    console.error(chalk.red('Description is required for new plan.'));
                                    process.exit(1);
                                }
                            }
                            
                            const config = await loadConfig();
                            const plansDir = config?.planDirectory || './plans';
                            planPath = path.resolve(path.join(plansDir, pathOrCode));
                            planName = pathOrCode;
                            initialMessage = `I want to explore a new idea: "${ideaDescription}"\n\nPlease create the idea using rp_idea_create with code "${pathOrCode}" and then begin the exploration conversation.`;
                        }
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
