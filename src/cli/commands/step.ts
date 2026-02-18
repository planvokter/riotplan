/**
 * Step commands for RiotPlan CLI
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadPlan, insertStep, startStep, completeStep, blockStep, unblockStep, skipStep } from "../../index.js";
import { handleInteractiveVerification, handleVerificationError } from "../utils/verification.js";
import { VerificationError } from "../../verification/errors.js";
import { loadConfig } from "../../config/loader.js";

/**
 * Register step commands with the CLI program
 */
export function registerStepCommands(program: Command): void {
    const step = program
        .command("step")
        .description("Manage plan steps");

    step.command("list")
        .description("List all steps in the plan")
        .argument("[path]", "Path to plan directory", process.cwd())
        .action(async (path: string) => {
            try {
                const plan = await loadPlan(path);
                 
                console.log(chalk.bold(`\nSteps for ${plan.metadata.name}:`));
                 
                console.log();

                for (const planStep of plan.steps) {
                    const statusIcon = getStatusIcon(planStep.status);
                     
                    console.log(`${statusIcon} ${planStep.number}. ${planStep.title} (${planStep.status})`);
                }
                 
                console.log();
            } catch (error) {
                 
                console.error(chalk.red("Error listing steps:"), (error as Error).message);
                process.exit(1);
            }
        });

    step.command("add")
        .description("Add a new step to the plan")
        .argument("<title>", "Title of the step")
        .option("-p, --position <number>", "Position to insert step", parseInt)
        .option("-d, --description <text>", "Description of the step")
        .option("--after <number>", "Insert after this step number", parseInt)
        .argument("[path]", "Path to plan directory", process.cwd())
        .action(async (title: string, options: { position?: number; description?: string; after?: number }, path: string) => {
            try {
                const plan = await loadPlan(path);
                const result = await insertStep(plan, {
                    title,
                    position: options.position,
                    description: options.description,
                    after: options.after,
                });
                 
                console.log(chalk.green(`✓ Added step ${result.step.number}: ${result.step.title}`));
                 
                console.log(chalk.dim(`  File: ${result.createdFile}`));
            } catch (error) {
                 
                console.error(chalk.red("Error adding step:"), (error as Error).message);
                process.exit(1);
            }
        });

    step.command("start")
        .description("Start a step")
        .argument("<n>", "Step number to start", parseInt)
        .argument("[path]", "Path to plan directory", process.cwd())
        .action(async (stepNumber: number, path: string) => {
            try {
                const plan = await loadPlan(path);
                const started = startStep(plan, stepNumber);
                 
                console.log(chalk.green(`✓ Started step ${started.number}: ${started.title}`));
            } catch (error) {
                 
                console.error(chalk.red("Error starting step:"), (error as Error).message);
                process.exit(1);
            }
        });

    step.command("complete")
        .description("Mark a step as complete")
        .argument("<n>", "Step number to complete", parseInt)
        .option("-n, --notes <text>", "Completion notes")
        .option("-f, --force", "Force completion even if verification fails")
        .option("--skip-verification", "Skip verification checks entirely")
        .argument("[path]", "Path to plan directory", process.cwd())
        .action(async (stepNumber: number, options: { notes?: string; force?: boolean; skipVerification?: boolean }, path: string) => {
            try {
                const plan = await loadPlan(path);
                const config = await loadConfig();
                
                // Handle interactive verification if configured
                if (config?.verification?.enforcement === 'interactive' && !options.force && !options.skipVerification) {
                    const proceed = await handleInteractiveVerification(plan, stepNumber);
                    if (!proceed) {
                        process.exit(0);
                    }
                }
                
                const completed = await completeStep(plan, stepNumber, {
                    notes: options.notes,
                    force: options.force,
                    skipVerification: options.skipVerification,
                });
                 
                console.log(chalk.green(`✓ Completed step ${completed.number}: ${completed.title}`));
                if (options.notes) {
                     
                    console.log(chalk.dim(`  Notes: ${options.notes}`));
                }
            } catch (error) {
                if (error instanceof VerificationError) {
                    handleVerificationError(error, options.force);
                } else {
                     
                    console.error(chalk.red("Error completing step:"), (error as Error).message);
                }
                process.exit(1);
            }
        });

    step.command("block")
        .description("Block a step")
        .argument("<n>", "Step number to block", parseInt)
        .argument("<reason>", "Reason for blocking")
        .argument("[path]", "Path to plan directory", process.cwd())
        .action(async (stepNumber: number, reason: string, path: string) => {
            try {
                const plan = await loadPlan(path);
                const blocked = blockStep(plan, stepNumber, reason);

                console.log(chalk.yellow(`⏸️  Blocked step ${blocked.number}: ${blocked.title}`));

                console.log(chalk.dim(`  Reason: ${reason}`));
            } catch (error) {

                console.error(chalk.red("Error blocking step:"), (error as Error).message);
                process.exit(1);
            }
        });

    step.command("unblock")
        .description("Unblock a step")
        .argument("<n>", "Step number to unblock", parseInt)
        .argument("[path]", "Path to plan directory", process.cwd())
        .action(async (stepNumber: number, path: string) => {
            try {
                const plan = await loadPlan(path);
                const unblocked = unblockStep(plan, stepNumber);

                console.log(chalk.green(`▶️  Unblocked step ${unblocked.number}: ${unblocked.title}`));
            } catch (error) {

                console.error(chalk.red("Error unblocking step:"), (error as Error).message);
                process.exit(1);
            }
        });

    step.command("skip")
        .description("Skip a step")
        .argument("<n>", "Step number to skip", parseInt)
        .option("-r, --reason <text>", "Reason for skipping")
        .argument("[path]", "Path to plan directory", process.cwd())
        .action(async (stepNumber: number, options: { reason?: string }, path: string) => {
            try {
                const plan = await loadPlan(path);
                const skipped = skipStep(plan, stepNumber, options.reason);

                console.log(chalk.cyan(`⏭️  Skipped step ${skipped.number}: ${skipped.title}`));
                if (options.reason) {

                    console.log(chalk.dim(`  Reason: ${options.reason}`));
                }
            } catch (error) {

                console.error(chalk.red("Error skipping step:"), (error as Error).message);
                process.exit(1);
            }
        });
}

/**
 * Get status icon for a given status
 */
function getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
        pending: "⬜",
        in_progress: "🔄",
        completed: "✅",
        failed: "❌",
        blocked: "⏸️",
        skipped: "⏭️",
    };
    return icons[status] || "⬜";
}
