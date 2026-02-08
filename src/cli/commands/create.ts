import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { join } from "node:path";
import { stat, readFile, writeFile, mkdir } from "node:fs/promises";
import { saveInitialPrompt, saveElaborationPrompt } from "../../plan/prompts.js";
import { createAnalysisDirectory } from "../../analysis/index.js";
import { 
    generatePlan, 
    formatSummary, 
    formatStep,
    loadProvider,
    getDefaultProvider,
    getProviderApiKey,
    detectAvailableProviders,
    type GenerationContext,
} from "../../ai/index.js";

export interface CreateOptions {
    direct?: boolean;
    analyze?: boolean;
    path?: string;
    provider?: string;
    model?: string;
    noAi?: boolean;
}

/**
 * Prompt user for plan name if not provided
 */
async function promptForName(): Promise<string> {
    const { name } = await inquirer.prompt([
        {
            type: "input",
            name: "name",
            message: "Plan name (kebab-case):",
            validate: (input: string) => {
                if (!input.trim()) return "Name is required";
                if (!/^[a-z0-9-]+$/.test(input)) {
                    return "Use lowercase letters, numbers, and hyphens only";
                }
                return true;
            },
        },
    ]);
    return name;
}

/**
 * Prompt user for initial plan description
 */
async function promptForDescription(): Promise<string> {
    const { description } = await inquirer.prompt([
        {
            type: "editor",
            name: "description",
            message: "Describe what you want to accomplish (opens editor):",
        },
    ]);
    return description;
}

/**
 * Ask user whether to analyze first or generate directly
 */
async function promptForMode(): Promise<"analyze" | "direct"> {
    console.log(chalk.cyan("\nHow would you like to proceed?"));
    console.log(chalk.gray("  1) Create an analysis first (recommended for complex plans)"));
    console.log(chalk.gray("  2) Generate the plan directly"));
    
    const { mode } = await inquirer.prompt([
        {
            type: "list",
            name: "mode",
            message: "Select mode:",
            choices: [
                {
                    name: "1) Create an analysis first",
                    value: "analyze",
                },
                {
                    name: "2) Generate the plan directly",
                    value: "direct",
                },
            ],
            default: "direct",
        },
    ]);
    return mode;
}

/**
 * Prompt for elaboration feedback
 */
async function promptForElaboration(): Promise<string> {
    const { feedback } = await inquirer.prompt([{
        type: "editor",
        name: "feedback",
        message: "Enter your elaboration feedback (opens editor):",
    }]);
    return feedback;
}

/**
 * Mark analysis as ready
 */
async function markAnalysisReady(planPath: string): Promise<void> {
    const reqPath = join(planPath, "analysis", "REQUIREMENTS.md");
    let content = await readFile(reqPath, "utf-8");
    content = content.replace(
        /\*\*Status\*\*\s*\|\s*`\w+`/,
        "**Status** | `ready`"
    );
    await writeFile(reqPath, content, "utf-8");
}

/**
 * Check if plan already exists
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
 * Generate plan files with AI
 */
async function generatePlanWithAI(
    planPath: string,
    planName: string,
    description: string,
    elaborations: string[],
    stepCount: number,
    options: CreateOptions
): Promise<void> {
    // Create plan directory
    await mkdir(join(planPath, "plan"), { recursive: true });
    
    const title = planName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const today = new Date().toISOString().split("T")[0];
    
    try {
        // Detect available providers
        const available = await detectAvailableProviders();
        
        if (available.length === 0) {
            console.log(chalk.yellow("\n⚠️  No AI providers installed. Falling back to template generation."));
            console.log(chalk.gray("Install a provider with: npm install @kjerneverk/execution-anthropic"));
            await generatePlanTemplate(planPath, planName, description, stepCount);
            return;
        }
        
        // Determine which provider to use
        const providerName = options.provider || getDefaultProvider();
        
        if (!providerName) {
            console.log(chalk.yellow("\n⚠️  No API key found in environment."));
            console.log(chalk.gray("Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY"));
            await generatePlanTemplate(planPath, planName, description, stepCount);
            return;
        }
        
        console.log(chalk.cyan(`\n🤖 Generating plan with ${providerName}...`));
        
        // Load provider
        const provider = await loadProvider({
            name: providerName,
            apiKey: getProviderApiKey(providerName),
            model: options.model,
        });
        
        // Generate plan with AI
        const context: GenerationContext = {
            planName,
            description,
            elaborations,
            stepCount,
        };
        
        const generatedPlan = await generatePlan(context, provider, {
            model: options.model,
            apiKey: getProviderApiKey(providerName),
        });
        
        // Extract plan from generation result
        const plan = generatedPlan.plan;
        
        // Write SUMMARY.md
        const summaryContent = formatSummary(plan, planName);
        await writeFile(join(planPath, "SUMMARY.md"), summaryContent, "utf-8");
        console.log(chalk.gray("  Created: SUMMARY.md"));
        
        // Write EXECUTION_PLAN.md
        const execContent = generateExecutionPlan(planPath, title, plan.steps);
        await writeFile(join(planPath, "EXECUTION_PLAN.md"), execContent, "utf-8");
        console.log(chalk.gray("  Created: EXECUTION_PLAN.md"));
        
        // Write STATUS.md
        const statusContent = generateStatus(title, plan.steps, today);
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
        await generatePlanTemplate(planPath, planName, description, stepCount);
    }
}

/**
 * Generate plan files from templates (fallback)
 */
async function generatePlanTemplate(
    planPath: string,
    planName: string,
    description: string,
    stepCount: number = 5
): Promise<void> {
    const title = planName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const today = new Date().toISOString().split("T")[0];
    
    // Generate SUMMARY.md
    const summaryContent = `# ${title} - Summary

## Executive Summary

> Generated from initial prompt. Review and edit as needed.

${description}

## Approach

_Approach to be defined..._

## Success Criteria

_Success criteria to be defined..._
`;
    await writeFile(join(planPath, "SUMMARY.md"), summaryContent, "utf-8");
    console.log(chalk.gray("  Created: SUMMARY.md"));
    
    // Generate EXECUTION_PLAN.md
    const steps = Array.from({ length: stepCount }, (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        return `| ${i + 1} | Step ${num} | \`plan/${num}-step.md\` | - |`;
    }).join("\n");
    
    const execContent = `# ${title} - Execution Plan

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
    await writeFile(join(planPath, "EXECUTION_PLAN.md"), execContent, "utf-8");
    console.log(chalk.gray("  Created: EXECUTION_PLAN.md"));
    
    // Generate STATUS.md
    const statusSteps = Array.from({ length: stepCount }, (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        return `| ${num} | Step ${num} | ⬜ Pending | - | - | - |`;
    }).join("\n");
    
    const statusContent = `# ${title} - Execution Status

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
${statusSteps}

## Blockers

_No blockers currently._

## Issues

_No issues currently._

## Notes

_Plan generated. Ready for review and execution._
`;
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");
    console.log(chalk.gray("  Created: STATUS.md"));
    
    // Generate step files
    for (let i = 1; i <= stepCount; i++) {
        const num = String(i).padStart(2, "0");
        const stepContent = `# Step ${num}: [Title]

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
        await writeFile(join(planPath, "plan", `${num}-step.md`), stepContent, "utf-8");
        console.log(chalk.gray(`  Created: plan/${num}-step.md`));
    }
}

function generateExecutionPlan(planPath: string, title: string, steps: any[]): string {
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

function generateStatus(title: string, steps: any[], today: string): string {
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

/**
 * Register the create command
 */
export function registerCreateCommand(program: Command): void {
    program
        .command("create [name]")
        .description("Interactively create a new plan")
        .option("-d, --direct", "Skip analysis, generate plan directly")
        .option("-a, --analyze", "Force analysis phase")
        .option("-p, --path <path>", "Output directory (default: current)")
        .option("-s, --steps <number>", "Number of steps to generate", "5")
        .option("--provider <name>", "AI provider (anthropic, openai, gemini)")
        .option("--model <name>", "Model to use for generation")
        .option("--no-ai", "Skip AI generation, use templates only")
        .action(async (name: string | undefined, options: CreateOptions & { steps?: string }) => {
            try {
                // Get name if not provided
                const planName = name || (await promptForName());
                
                // Get description
                console.log(chalk.cyan("\nDescribe your plan:"));
                const description = await promptForDescription();
                
                // Determine mode
                let mode: "analyze" | "direct";
                if (options.direct) {
                    mode = "direct";
                } else if (options.analyze) {
                    mode = "analyze";
                } else {
                    mode = await promptForMode();
                }
                
                // Output path
                const basePath = options.path || process.cwd();
                const planPath = join(basePath, planName);
                const stepCount = parseInt(options.steps || "5", 10);
                
                console.log(chalk.green(`\nCreating plan: ${planName}`));
                console.log(chalk.gray(`Path: ${planPath}`));
                console.log(chalk.gray(`Mode: ${mode}`));
                
                // Save the initial prompt
                const promptPath = await saveInitialPrompt(planPath, planName, description);
                console.log(chalk.gray(`Prompt saved: ${promptPath}`));
                
                if (mode === "analyze") {
                    // Create analysis directory structure
                    const analysisPath = await createAnalysisDirectory({
                        planPath,
                        planName,
                        initialPrompt: description,
                    });
                    console.log(chalk.green(`\n✅ Analysis created: ${analysisPath}`));
                    
                    // Ask if they want to elaborate now
                    const { elaborateNow } = await inquirer.prompt([{
                        type: "confirm",
                        name: "elaborateNow",
                        message: "Would you like to add elaboration feedback now?",
                        default: true,
                    }]);
                    
                    if (elaborateNow) {
                        let continueElaborating = true;
                        while (continueElaborating) {
                            const feedback = await promptForElaboration();
                            if (feedback.trim()) {
                                await saveElaborationPrompt(planPath, feedback);
                                console.log(chalk.green("✅ Elaboration saved."));
                            }
                            
                            const { more } = await inquirer.prompt([{
                                type: "confirm",
                                name: "more",
                                message: "Add more elaboration?",
                                default: false,
                            }]);
                            continueElaborating = more;
                        }
                    }
                    
                    // Ask if ready to generate
                    const { generateNow } = await inquirer.prompt([{
                        type: "confirm",
                        name: "generateNow",
                        message: "Ready to generate plan from analysis?",
                        default: false,
                    }]);
                    
                    if (generateNow) {
                        await markAnalysisReady(planPath);
                        const elaborations: string[] = [];
                        // TODO: Load elaborations from analysis
                        await generatePlanWithAI(planPath, planName, description, elaborations, stepCount, options);
                        console.log(chalk.green("\n✅ Plan generated!"));
                    } else {
                        console.log(chalk.cyan("\nWhen ready:"));
                        console.log(chalk.gray("  - Add more: riotplan elaborate"));
                        console.log(chalk.gray("  - Generate: riotplan analysis ready && riotplan generate"));
                    }
                } else {
                    // Direct mode - generate immediately
                    if (options.noAi) {
                        console.log(chalk.cyan("\nGenerating plan from templates..."));
                        await generatePlanTemplate(planPath, planName, description, stepCount);
                    } else {
                        await generatePlanWithAI(planPath, planName, description, [], stepCount, options);
                    }
                    console.log(chalk.green("\n✅ Plan generated!"));
                }
                
                // Show completion message
                if (await planExists(planPath)) {
                    console.log(chalk.green("\n🎉 Plan creation complete!"));
                    console.log(chalk.cyan("\nNext steps:"));
                    console.log(chalk.gray(`  cd ${planPath}`));
                    console.log(chalk.gray("  riotplan status"));
                    console.log(chalk.gray("  riotplan step start 01"));
                }
                
            } catch (error) {
                console.error(chalk.red("Failed to create plan:"), error);
                process.exit(1);
            }
        });
}
