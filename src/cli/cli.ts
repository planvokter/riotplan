#!/usr/bin/env node

/**
 * RiotPlan CLI
 *
 * Command-line interface for managing and executing plans.
 * 
 * LLM-Powered Commands (interactive chat sessions):
 * - riotplan explore [path|code] [description]  Explore an idea
 * - riotplan build-plan [path]                  Build execution plan from idea
 * - riotplan execute-plan [path]                Execute plan steps
 * - riotplan chat [path]                        General-purpose chat
 *
 * Utility Commands (quick operations):
 * - riotplan list               List all plans with status
 * - riotplan status [path]        Show current status
 * - riotplan step list [path]     List steps
 * - riotplan step add <title>     Add a step
 * - riotplan step start <n>       Start a step
 * - riotplan step complete <n>    Complete a step
 * - riotplan plan init <name>     Create a new plan
 * - riotplan plan validate [path] Validate plan structure
 * - riotplan render [path]        Render plan to various formats
 * - riotplan check-config         Show configuration
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Import command registration functions
// LLM-powered commands
import { registerExploreCommand } from "./commands/explore.js";
import { registerBuildPlanCommand } from "./commands/build-plan.js";
import { registerExecutePlanCommand } from "./commands/execute-plan.js";
import { registerChatCommand } from "./commands/chat.js";

// Utility commands
import { registerPlanCommands } from "../commands/plan/index.js";
import { registerRenderCommands } from "../commands/render/index.js";
import { registerStatusCommands } from "./commands/status.js";
import { registerStepCommands } from "./commands/step.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerListCommand } from "./commands/list.js";
import { createMigrateCommand } from "../commands/migrate.js";

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let packageJsonPath = join(__dirname, "../package.json");
let VERSION: string;
try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    VERSION = packageJson.version;
} catch {
    // Fallback if path is wrong
    packageJsonPath = join(__dirname, "../../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    VERSION = packageJson.version;
}

/**
 * Create the CLI program with all commands
 */
export function createProgram(): Command {
    const program = new Command();

    program
        .name("riotplan")
        .description("Manage long-lived, stateful AI workflows\n\nLLM-Powered Commands:\n  explore, build-plan, execute-plan, chat\n\nUtility Commands:\n  list, status, step, plan, render, check-config")
        .version(VERSION)
        .configureHelp({
            sortSubcommands: true,
            subcommandTerm: (cmd) => cmd.name(),
        });

    // Register LLM-powered commands
    registerExploreCommand(program);
    registerBuildPlanCommand(program);
    registerExecutePlanCommand(program);
    registerChatCommand(program);

    // Register utility commands
    registerListCommand(program);
    registerPlanCommands(program);
    registerRenderCommands(program);
    registerStatusCommands(program);
    registerStepCommands(program);
    registerConfigCommands(program);
    program.addCommand(createMigrateCommand());

    // Global options
    // Note: --json is intentionally NOT a global option because it conflicts
    // with subcommand-specific --json options. Each command that needs JSON
    // output should define its own --json option.
    program
        .option("-v, --verbose", "Verbose output")
        .option("--no-color", "Disable colored output");

    // Handle unknown commands
    program.on("command:*", () => {
         
        console.error(chalk.red(`Unknown command: ${program.args.join(" ")}`));
         
        console.log(`Run ${chalk.cyan("riotplan --help")} for usage.`);
        process.exit(1);
    });

    return program;
}
