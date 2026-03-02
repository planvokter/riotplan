/**
 * Configuration commands for RiotPlan CLI
 *
 * Provides commands for managing RiotPlan configuration:
 * - --init-config: Create initial configuration file
 * - --check-config: Show current configuration resolution
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkConfigWithCardiganTime } from '../../config/index.js';

/**
 * Register configuration commands
 */
export function registerConfigCommands(program: Command): void {
    // --init-config flag
    program
        .option('--init-config', 'Create initial riotplan.config.yaml file')
        .option('--check-config', 'Show current configuration resolution and validation')
        .hook('preAction', async (thisCommand) => {
            if (thisCommand.opts().initConfig) {
                await handleInitConfig();
                process.exit(0);
            }
            if (thisCommand.opts().checkConfig) {
                await handleCheckConfig(thisCommand.opts());
                process.exit(0);
            }
        });

    // --check-config command
    program
        .command('check-config')
        .description('Show current configuration resolution and validation')
        .action(async () => {
            await handleCheckConfig(program.opts());
        });
}

/**
 * Handle --init-config flag
 * Creates a riotplan.config.yaml file with sensible defaults
 */
async function handleInitConfig(): Promise<void> {
    const configPath = resolve(process.cwd(), 'riotplan.config.yaml');

    // Check if config file already exists
    if (existsSync(configPath)) {
        console.log(chalk.yellow(`⚠ Configuration file already exists: ${configPath}`));
        console.log(chalk.dim('Use --check-config to view current configuration.'));
        return;
    }

    // Create config file with defaults
    const configContent = `# RiotPlan Configuration
# See https://github.com/kjerneverk/riotplan for documentation

# Directory where plans are stored (relative or absolute)
# Relative paths are resolved from this config file's location
planDirectory: ./plans

# Optional: Default AI provider for plan generation
# Options: anthropic, openai, gemini
# defaultProvider: anthropic

# Optional: Default model to use for plan generation
# Examples: claude-3-5-sonnet-20241022, gpt-4, gemini-pro
# defaultModel: claude-3-5-sonnet-20241022

# Optional: Custom template directory
# templateDirectory: ./.riotplan/templates
`;

    try {
        writeFileSync(configPath, configContent, 'utf-8');
        console.log(chalk.green(`✓ Created configuration file: ${configPath}`));
        console.log(chalk.dim('\nEdit this file to customize your RiotPlan configuration.'));
        console.log(chalk.dim('Run "riotplan check-config" to verify your configuration.'));
    } catch (error) {
        console.error(chalk.red(`✗ Failed to create config file: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
}

/**
 * Handle check-config command
 * Shows current configuration resolution and validation
 */
async function handleCheckConfig(args: Record<string, unknown> = {}): Promise<void> {
    try {
        await checkConfigWithCardiganTime(args);
    } catch (error) {
        console.log(chalk.red('✗ Configuration error\n'));
        console.log(`Error: ${chalk.red(error instanceof Error ? error.message : String(error))}`);
        console.log(chalk.dim('\nFix the configuration error and try again.'));
        process.exit(1);
    }
}
