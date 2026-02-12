/**
 * Execute Command
 * 
 * LLM-powered plan execution command.
 * Works through plan steps with full file access.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolvePlanPath, withProviderConfig, runAgentSession } from './common.js';
import { executeToolSet } from '../tools/index.js';

/**
 * Load the execute system prompt
 */
function loadSystemPrompt(): string {
    return `# RiotPlan Execute Assistant

You are helping the user execute their plan step by step.

## Your Role

1. **Check plan status** - Start by calling rp_status to see current progress
2. **Read the current step** - Understand what needs to be done
3. **Execute the step** - Make the necessary changes to implement the step
4. **Track progress** - Mark steps as started/completed using RiotPlan tools
5. **Write reflections** - After completing a step, capture what you learned

## Available Tools

You have FULL access to:
- File tools: read_file, write_file, edit_file, list_files, grep
- Command execution: run_command
- RiotPlan tools: rp_status, rp_step_start, rp_step_complete, rp_step_reflect, etc.

## Workflow

1. Call rp_status to see current plan state and identify the next step
2. Call rp_step_start to mark the step as in-progress
3. Read the step file to understand the tasks
4. Execute the tasks - read files, make changes, run commands as needed
5. When all tasks are complete, call rp_step_complete
6. Call rp_step_reflect to capture what you learned
7. Ask the user if they want to continue to the next step

## Important

- ALWAYS call rp_step_start before beginning work on a step
- ALWAYS call rp_step_complete when finishing a step
- ALWAYS write a reflection after completing a step
- If you encounter blockers, discuss with the user before proceeding
- If a task is unclear, ask for clarification

## Step Execution Pattern

\`\`\`
1. rp_status() → identify current step
2. rp_step_start(step: N) → mark as in-progress
3. Read step file, understand tasks
4. Execute tasks (read/write files, run commands)
5. rp_step_complete(step: N) → mark as done
6. rp_step_reflect(step: N, reflection: "...") → capture learnings
\`\`\`

## Anti-Patterns

- Don't skip the step tracking tools
- Don't modify files without understanding the step requirements
- Don't move to the next step without completing the current one
- Don't forget to write reflections`;
}

/**
 * Register the execute command
 */
export function registerExecutePlanCommand(program: Command): void {
    program
        .command('execute-plan [path]')
        .alias('ep')
        .description('Execute a plan step by step with LLM assistance')
        .option('-p, --provider <provider>', 'LLM provider (anthropic, openai)')
        .option('-m, --model <model>', 'Model to use')
        .option('-s, --step <number>', 'Start from a specific step')
        .action(async (planPath?: string, options?: {
            provider?: string;
            model?: string;
            step?: string;
        }) => {
            try {
                await withProviderConfig(options || {}, async (providerConfig) => {
                    // Resolve plan path
                    const resolved = await resolvePlanPath(planPath || '.');
                    
                    if (!resolved) {
                        console.error(chalk.red('Please specify a plan path.'));
                        console.error(chalk.dim('Usage: riotplan execute-plan <path>'));
                        process.exit(1);
                    }

                    if (!resolved.exists) {
                        console.error(chalk.red(`Plan not found: ${resolved.planPath}`));
                        process.exit(1);
                    }

                    // Check if plan has been built (has plan/ directory with steps)
                    const planDir = path.join(resolved.planPath, 'plan');
                    if (!fs.existsSync(planDir)) {
                        console.error(chalk.red('Plan has not been built yet.'));
                        console.error(chalk.dim('Use "riotplan build-plan" to generate the execution plan first.'));
                        process.exit(1);
                    }

                    // Construct initial message
                    let initialMessage = 'I want to execute this plan. Please check the status and help me work through the steps.';
                    if (options?.step) {
                        initialMessage = `I want to execute step ${options.step} of this plan. Please start with that step.`;
                    }

                    // Run the execute session
                    await runAgentSession({
                        planPath: resolved.planPath,
                        planName: resolved.planName,
                        mode: 'execute',
                        systemPrompt: loadSystemPrompt(),
                        tools: executeToolSet,
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
