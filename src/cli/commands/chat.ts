/**
 * Chat Command
 * 
 * General-purpose LLM chat with optional plan context.
 * Full access to all tools for flexible conversations.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'node:path';
import { resolvePlanPath, withProviderConfig, runAgentSession } from './common.js';
import { chatToolSet } from '../tools/index.js';

/**
 * Load the chat system prompt
 */
function loadSystemPrompt(hasPlan: boolean): string {
    const basePrompt = `# RiotPlan Chat Assistant

You are a helpful assistant with access to file system tools and RiotPlan planning tools.

## Your Role

Help the user with whatever they need. You can:
- Read and write files
- Search the codebase
- Run commands
- Manage RiotPlan plans (create ideas, add notes, build plans, execute steps)

## Available Tools

You have access to ALL tools:
- File tools: read_file, write_file, edit_file, list_files, grep
- Command execution: run_command
- All RiotPlan tools for plan management

## Guidelines

- Be helpful and conversational
- Use tools proactively to answer questions
- If asked about code, read the relevant files
- If asked to make changes, use the file editing tools
- If working with a plan, use the RiotPlan tools appropriately`;

    if (hasPlan) {
        return basePrompt + `

## Current Context

You are working in the context of a RiotPlan plan. You can:
- Check plan status with rp_status
- Read plan artifacts with rp_read_context
- Modify the plan as needed

Start by understanding what the user wants to do.`;
    }

    return basePrompt + `

## No Plan Context

No specific plan is loaded. You can:
- Help with general coding tasks
- Create new plans with rp_idea_create
- Navigate to existing plans

Ask the user what they'd like to work on.`;
}

/**
 * Register the chat command
 */
export function registerChatCommand(program: Command): void {
    program
        .command('chat [path]')
        .description('Start a general-purpose chat session with optional plan context')
        .option('-p, --provider <provider>', 'LLM provider (anthropic, openai)')
        .option('-m, --model <model>', 'Model to use')
        .action(async (planPath?: string, options?: {
            provider?: string;
            model?: string;
        }) => {
            try {
                await withProviderConfig(options || {}, async (providerConfig) => {
                    // Resolve plan path if provided
                    const resolved = planPath ? await resolvePlanPath(planPath) : null;
                    
                    // If no path provided, use current directory
                    const workingPath = resolved?.planPath || process.cwd();
                    const hasPlan = resolved?.exists || false;

                    // Run the chat session
                    await runAgentSession({
                        planPath: workingPath,
                        planName: resolved?.planName || path.basename(workingPath),
                        mode: 'chat',
                        systemPrompt: loadSystemPrompt(hasPlan),
                        tools: chatToolSet,
                        provider: providerConfig,
                    });
                });

            } catch (error) {
                console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });
}
