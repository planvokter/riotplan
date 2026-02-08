import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { resolve, join } from "node:path";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { loadAnalysis, hasAnalysis } from "../../analysis/index.js";
import { 
    generatePlan, 
    formatSummary, 
    formatStep,
    loadProvider,
    getDefaultProvider,
    getProviderApiKey,
    detectAvailableProviders,
} from "../../ai/index.js";
import type { GenerationContext as AIGenerationContext } from "../../ai/index.js";

export interface GenerateOptions {
    path?: string;
    steps?: number;
    force?: boolean;
    provider?: string;
    model?: string;
    noAi?: boolean;
}

/**
 * Check if plan files already exist
 */
async function planExists(planPath: string): Promise<boolean> {
    try {
        await stat(join(planPath, "EXECUTION_PLAN.md"));
        return true;
    } catch {
        return false;
    }
}

/**
 * Load initial prompt from plan directory
 */
async function loadInitialPrompt(planPath: string, planName: string): Promise<string | null> {
    try {
        const promptPath = join(planPath, `${planName}-prompt.md`);
        const content = await readFile(promptPath, "utf-8");
        // Extract just the prompt content (after the --- separator)
        const separatorIndex = content.indexOf('---\n\n');
        if (separatorIndex !== -1) {
            return content.substring(separatorIndex + 5).trim();
        }
        return content;
    } catch {
        return null;
    }
}

interface GenerationContext {
    source: "analysis" | "prompt";
    content: string;
    elaborations?: string[];
}

/**
 * Build generation context from analysis or prompt
 */
async function buildGenerationContext(planPath: string, planName: string): Promise<GenerationContext> {
    // Try to load analysis first
    if (await hasAnalysis(planPath)) {
        const analysis = await loadAnalysis(planPath);
        if (analysis && analysis.metadata.status === "ready") {
            return {
                source: "analysis",
                content: analysis.requirements,
                elaborations: analysis.elaborations.map(e => e.content),
            };
        } else if (analysis) {
            console.log(chalk.yellow("⚠️  Analysis exists but not marked ready."));
            const { proceed } = await inquirer.prompt([{
                type: "confirm",
                name: "proceed",
                message: "Generate plan from draft analysis?",
                default: false,
            }]);
            if (proceed) {
                return {
                    source: "analysis",
                    content: analysis.requirements,
                    elaborations: analysis.elaborations.map(e => e.content),
                };
            }
        }
    }
    
    // Fall back to initial prompt
    const prompt = await loadInitialPrompt(planPath, planName);
    if (!prompt) {
        throw new Error("No analysis or initial prompt found");
    }
    
    return {
        source: "prompt",
        content: prompt,
    };
}

/**
 * Register the generate command
 */
export function registerGenerateCommand(program: Command): void {
    program
        .command("generate [path]")
        .description("Generate plan files from analysis or prompt")
        .option("-s, --steps <number>", "Number of steps to generate", "5")
        .option("-f, --force", "Overwrite existing plan files")
        .option("--provider <name>", "AI provider (anthropic, openai, gemini)")
        .option("--model <name>", "Model to use for generation")
        .option("--no-ai", "Skip AI generation, use templates only")
        .action(async (pathArg: string | undefined, options: GenerateOptions) => {
            try {
                const planPath = resolve(pathArg || options.path || process.cwd());
                const planName = planPath.split("/").pop() || "plan";
                
                // Check for existing plan
                if (await planExists(planPath) && !options.force) {
                    console.error(chalk.red("Plan already exists. Use --force to overwrite."));
                    process.exit(1);
                }
                
                // Build context
                console.log(chalk.cyan("Loading generation context..."));
                const context = await buildGenerationContext(planPath, planName);
                console.log(chalk.gray(`Source: ${context.source}`));
                
                // Generate plan files
                const stepCount = parseInt(String(options.steps), 10) || 5;
                
                if (options.noAi) {
                    console.log(chalk.cyan("\nGenerating plan from templates..."));
                    await generatePlanFiles(planPath, planName, context, { stepCount });
                } else {
                    console.log(chalk.cyan("\nGenerating plan with AI..."));
                    await generatePlanWithAI(planPath, planName, context, stepCount, options);
                }
                
                console.log(chalk.green("\n✅ Plan generated successfully!"));
                console.log(chalk.cyan("\nNext steps:"));
                console.log(chalk.gray("  - Review: riotplan status"));
                console.log(chalk.gray("  - Amend: riotplan amend"));
                console.log(chalk.gray("  - Start: riotplan step start 01"));
                
            } catch (error) {
                console.error(chalk.red("Failed to generate plan:"), error);
                process.exit(1);
            }
        });
}

/**
 * Generate the plan files
 */
async function generatePlanFiles(
    planPath: string,
    planName: string,
    context: GenerationContext,
    options: { stepCount: number }
): Promise<void> {
    // Create plan directory
    await mkdir(join(planPath, "plan"), { recursive: true });
    
    // Generate SUMMARY.md
    const summaryContent = generateSummary(planName, context);
    await writeFile(join(planPath, "SUMMARY.md"), summaryContent, "utf-8");
    console.log(chalk.gray("  Created: SUMMARY.md"));
    
    // Generate EXECUTION_PLAN.md
    const execContent = generateExecutionPlan(planPath, planName, options.stepCount);
    await writeFile(join(planPath, "EXECUTION_PLAN.md"), execContent, "utf-8");
    console.log(chalk.gray("  Created: EXECUTION_PLAN.md"));
    
    // Generate STATUS.md
    const statusContent = generateStatus(planName, options.stepCount);
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");
    console.log(chalk.gray("  Created: STATUS.md"));
    
    // Generate step files
    for (let i = 1; i <= options.stepCount; i++) {
        const stepNum = String(i).padStart(2, "0");
        const stepContent = generateStepFile(i);
        await writeFile(
            join(planPath, "plan", `${stepNum}-step.md`),
            stepContent,
            "utf-8"
        );
        console.log(chalk.gray(`  Created: plan/${stepNum}-step.md`));
    }
}

function generateSummary(planName: string, context: GenerationContext): string {
    const title = planName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return `# ${title} - Summary

## Executive Summary

> Generated from ${context.source}. Review and edit as needed.

_Summary to be elaborated..._

## Approach

_Approach to be defined..._

## Success Criteria

_Success criteria to be defined..._
`;
}

function generateExecutionPlan(planPath: string, planName: string, stepCount: number): string {
    const title = planName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const steps = Array.from({ length: stepCount }, (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        return `| ${i + 1} | Step ${num} | \`plan/${num}-step.md\` | - |`;
    }).join("\n");
    
    return `# ${title} - Execution Plan

> Execute: "${planPath}/EXECUTION_PLAN.md"

## Execution Sequence

| Order | Step | File | Est. Time |
|-------|------|------|-----------|
${steps}

## How to Execute

1. Read STATUS.md for current state
2. Find next pending step
3. Execute step file
4. Update STATUS.md
5. Continue until complete
`;
}

function generateStatus(planName: string, stepCount: number): string {
    const title = planName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const today = new Date().toISOString().split("T")[0];
    const steps = Array.from({ length: stepCount }, (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        return `| ${num} | Step ${num} | ⬜ Pending | - | - | - |`;
    }).join("\n");
    
    return `# ${title} - Execution Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | \`pending\` |
| **Current Step** | - |
| **Last Completed** | - |
| **Started At** | - |
| **Last Updated** | ${today} |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
${steps}

## Blockers

_No blockers currently._

## Issues

_No issues currently._

## Notes

_Plan generated. Ready for review and execution._
`;
}

function generateStepFile(stepNum: number): string {
    const num = String(stepNum).padStart(2, "0");
    return `# Step ${num}: [Title]

## Objective

_Define the objective of this step..._

## Background

_Provide context..._

## Tasks

### ${num}.1 Task One

_Describe the task..._

## Acceptance Criteria

- [ ] Criterion one
- [ ] Criterion two

## Testing

_How to verify this step is complete..._

## Files Changed

- _List files that will be modified..._

## Notes

_Additional notes..._
`;
}

/**
 * Generate plan with AI
 */
async function generatePlanWithAI(
    planPath: string,
    planName: string,
    context: GenerationContext,
    stepCount: number,
    options: GenerateOptions
): Promise<void> {
    try {
        // Detect available providers
        const available = await detectAvailableProviders();
        
        if (available.length === 0) {
            console.log(chalk.yellow("\n⚠️  No AI providers installed. Falling back to template generation."));
            console.log(chalk.gray("Install a provider with: npm install @kjerneverk/execution-anthropic"));
            await generatePlanFiles(planPath, planName, context, { stepCount });
            return;
        }
        
        // Determine which provider to use
        const providerName = options.provider || getDefaultProvider();
        
        if (!providerName) {
            console.log(chalk.yellow("\n⚠️  No API key found in environment."));
            console.log(chalk.gray("Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY"));
            await generatePlanFiles(planPath, planName, context, { stepCount });
            return;
        }
        
        console.log(chalk.cyan(`🤖 Using ${providerName} for generation...`));
        
        // Load provider
        const provider = await loadProvider({
            name: providerName,
            apiKey: getProviderApiKey(providerName),
            model: options.model,
        });
        
        // Build generation context
        const genContext: AIGenerationContext = {
            planName,
            description: context.content,
            elaborations: context.elaborations,
            stepCount,
        };
        
        const generatedPlan = await generatePlan(genContext, provider, {
            model: options.model,
            apiKey: getProviderApiKey(providerName),
        });
        
        // Create plan directory
        await mkdir(join(planPath, "plan"), { recursive: true });
        
        // Extract plan from generation result
        const plan = generatedPlan.plan;
        
        // Write SUMMARY.md
        const summaryContent = formatSummary(plan, planName);
        await writeFile(join(planPath, "SUMMARY.md"), summaryContent, "utf-8");
        console.log(chalk.gray("  Created: SUMMARY.md"));
        
        // Write EXECUTION_PLAN.md
        const title = planName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const execContent = generateExecutionPlanFromSteps(planPath, title, plan.steps);
        await writeFile(join(planPath, "EXECUTION_PLAN.md"), execContent, "utf-8");
        console.log(chalk.gray("  Created: EXECUTION_PLAN.md"));
        
        // Write STATUS.md
        const statusContent = generateStatusFromSteps(title, plan.steps);
        await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");
        console.log(chalk.gray("  Created: STATUS.md"));
        
        // Write step files
        for (const step of plan.steps) {
            const num = String(step.number).padStart(2, "0");
            const stepContent = formatStep(step);
            await writeFile(join(planPath, "plan", `${num}-step.md`), stepContent, "utf-8");
            console.log(chalk.gray(`  Created: plan/${num}-step.md`));
        }
        
    } catch (error) {
        console.error(chalk.red("\n❌ AI generation failed:"), error instanceof Error ? error.message : error);
        console.log(chalk.yellow("Falling back to template generation..."));
        await generatePlanFiles(planPath, planName, context, { stepCount });
    }
}

function generateExecutionPlanFromSteps(planPath: string, title: string, steps: any[]): string {
    const stepRows = steps.map((step) => {
        const num = String(step.number).padStart(2, "0");
        return `| ${step.number} | ${step.title} | \`plan/${num}-step.md\` | - |`;
    }).join("\n");
    
    return `# ${title} - Execution Plan

> Execute: "${planPath}/EXECUTION_PLAN.md"

## Execution Sequence

| Order | Step | File | Est. Time |
|-------|------|------|-----------|
${stepRows}

## How to Execute

1. Read STATUS.md for current state
2. Find next pending step
3. Execute step file
4. Update STATUS.md
5. Continue until complete
`;
}

function generateStatusFromSteps(title: string, steps: any[]): string {
    const today = new Date().toISOString().split("T")[0];
    const stepRows = steps.map(step => {
        const num = String(step.number).padStart(2, "0");
        return `| ${num} | ${step.title} | ⬜ Pending | - | - | - |`;
    }).join("\n");
    
    return `# ${title} - Execution Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | \`pending\` |
| **Current Step** | - |
| **Last Completed** | - |
| **Started At** | - |
| **Last Updated** | ${today} |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
${stepRows}

## Blockers

_No blockers currently._

## Issues

_No issues currently._

## Notes

_Plan generated. Ready for review and execution._
`;
}
