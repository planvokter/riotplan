/**
 * CLI utilities for verification and user interaction
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import type { Plan } from '../../types.js';
import { VerificationEngine } from '../../verification/engine.js';
import { VerificationError } from '../../verification/errors.js';
import { loadConfig } from '../../config/loader.js';

/**
 * Handle interactive verification prompts
 *
 * Shows verification results and prompts user to proceed or cancel
 */
export async function handleInteractiveVerification(
    plan: Plan,
    stepNumber: number
): Promise<boolean> {
    const engine = new VerificationEngine();
    const config = await loadConfig();
    
    if (!config?.verification) {
        return true; // No verification configured
    }

    const result = await engine.verifyStepCompletion(plan, stepNumber, {
        enforcement: config.verification.enforcement,
        checkAcceptanceCriteria: config.verification.checkAcceptanceCriteria,
        checkArtifacts: config.verification.checkArtifacts,
        force: false,
    });

    // Show results
    if (result.level === 'error') {
        console.log(chalk.yellow('\n⚠️  Verification Issues Found:'));
        for (const message of result.messages) {
            console.log(chalk.gray(`   ${message}`));
        }
        
        const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Mark step as complete despite these issues?',
            default: false,
        }]);
        
        if (!proceed) {
            console.log(chalk.yellow('\nStep completion cancelled.'));
            console.log(chalk.dim('Tip: Use --force to bypass verification, or fix the issues and try again.'));
            return false;
        }
    } else if (result.level === 'warning') {
        console.log(chalk.yellow('\n⚠️  Verification Warnings:'));
        for (const message of result.messages) {
            console.log(chalk.gray(`   ${message}`));
        }
        console.log(); // Empty line for spacing
    }

    return true;
}

/**
 * Handle verification errors in CLI
 *
 * Shows error details and suggests --force flag
 */
export function handleVerificationError(
    error: VerificationError,
    force?: boolean
): void {
    console.log(chalk.red('\n❌ Verification Failed:'));
    for (const message of error.details.messages) {
        console.log(chalk.gray(`   ${message}`));
    }
    
    if (!force) {
        console.log(chalk.yellow('\nUse --force to bypass verification checks.'));
    }
}

/**
 * Show verification results summary
 *
 * Displays a summary of what was checked and the results
 */
export function showVerificationSummary(
    result: { isValid: boolean; level: string; messages: string[] }
): void {
    if (result.level === 'passed') {
        console.log(chalk.green('\n✓ Verification passed'));
        if (result.messages.length > 0) {
            for (const message of result.messages) {
                console.log(chalk.dim(`  ${message}`));
            }
        }
    } else if (result.level === 'warning') {
        console.log(chalk.yellow('\n⚠️  Verification warnings:'));
        for (const message of result.messages) {
            console.log(chalk.gray(`  ${message}`));
        }
    } else {
        console.log(chalk.red('\n❌ Verification failed:'));
        for (const message of result.messages) {
            console.log(chalk.gray(`  ${message}`));
        }
    }
}
