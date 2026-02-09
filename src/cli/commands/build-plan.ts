/**
 * Build Command
 * 
 * LLM-powered plan building command.
 * Takes a developed idea and generates a detailed execution plan.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolvePlanPath, withProviderConfig, runAgentSession } from './common.js';
import { buildToolSet } from '../tools/index.js';

/**
 * Load the build system prompt
 */
function loadSystemPrompt(): string {
    return `# RiotPlan Build Assistant

You are helping the user build a detailed execution plan from their explored idea.

## Your Role

1. **Read the plan artifacts** - Start by reading IDEA.md, SHAPING.md (if exists), and any evidence files
2. **Understand the context** - Summarize what you've learned about the idea
3. **Ask clarifying questions** - If anything is unclear, ask before proceeding
4. **Generate the plan** - When ready, use rp_build to generate the detailed plan

## Available Tools

You have access to:
- File reading tools (read_file, list_files, grep) to understand the codebase
- RiotPlan tools to read plan context and build the plan
- rp_read_context to load all plan artifacts at once
- rp_build to generate the detailed execution plan

## Workflow

1. First, call rp_read_context to load all plan artifacts
2. Review the idea, constraints, questions, and any evidence
3. If the idea is in "shaping" stage, review the selected approach
4. Ask the user any clarifying questions
5. When ready, call rp_build to generate the plan

## Important

- Do NOT skip reading the artifacts - they contain important context
- Do NOT generate the plan until you understand the idea fully
- The plan should be grounded in the artifacts, not made up
- After building, summarize what was created

## Anti-Patterns

- Don't start building without reading IDEA.md first
- Don't ignore evidence files - they contain important research
- Don't skip the shaping stage if it exists`;
}

/**
 * Register the build command
 */
export function registerBuildPlanCommand(program: Command): void {
    program
        .command('build-plan [path]')
        .alias('bp')
        .description('Build a detailed execution plan from an explored idea')
        .option('-p, --provider <provider>', 'LLM provider (anthropic, openai)')
        .option('-m, --model <model>', 'Model to use')
        .action(async (planPath?: string, options?: {
            provider?: string;
            model?: string;
        }) => {
            try {
                await withProviderConfig(options || {}, async (providerConfig) => {
                    // Resolve plan path
                    const resolved = await resolvePlanPath(planPath || '.');
                    
                    if (!resolved) {
                        console.error(chalk.red('Please specify a plan path.'));
                        console.error(chalk.dim('Usage: riotplan build-plan <path>'));
                        process.exit(1);
                    }

                    if (!resolved.exists) {
                        console.error(chalk.red(`Plan not found: ${resolved.planPath}`));
                        console.error(chalk.dim('The plan must exist before building. Use "riotplan explore" first.'));
                        process.exit(1);
                    }

                    // Check if IDEA.md exists
                    const ideaPath = path.join(resolved.planPath, 'IDEA.md');
                    if (!fs.existsSync(ideaPath)) {
                        console.error(chalk.red('No IDEA.md found in plan directory.'));
                        console.error(chalk.dim('Use "riotplan explore" to develop the idea first.'));
                        process.exit(1);
                    }

                    // Run the build session
                    await runAgentSession({
                        planPath: resolved.planPath,
                        planName: resolved.planName,
                        mode: 'build',
                        systemPrompt: loadSystemPrompt(),
                        tools: buildToolSet,
                        provider: providerConfig,
                        initialMessage: 'I want to build a detailed execution plan from this idea. Please start by reading the plan artifacts.',
                    });
                });

            } catch (error) {
                console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });
}
