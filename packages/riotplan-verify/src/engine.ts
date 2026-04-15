/**
 * Verification Engine for RiotPlan
 *
 * Core engine that checks acceptance criteria and enforces completion rules
 * based on configuration settings.
 */

import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { AcceptanceCriterion } from './types.js';

interface PlanStep {
    number: number;
    filePath: string;
}

interface Plan {
    steps: PlanStep[];
}

/**
 * Result of verification check
 */
export interface VerificationResult {
    /** Whether verification passed */
    isValid: boolean;
    /** Severity level of issues found */
    level: 'passed' | 'warning' | 'error';
    /** Human-readable messages about verification results */
    messages: string[];
    /** Acceptance criteria that were checked */
    acceptanceCriteria?: AcceptanceCriterion[];
    /** Artifacts that were verified */
    artifacts?: string[];
}

/**
 * Options for verification
 */
export interface VerificationOptions {
    /** Enforcement level */
    enforcement: 'advisory' | 'interactive' | 'strict';
    /** Whether to check acceptance criteria */
    checkAcceptanceCriteria: boolean;
    /** Whether to check artifacts */
    checkArtifacts: boolean;
    /** Force flag to bypass verification */
    force?: boolean;
}

/**
 * Verification engine for step completion
 */
export class VerificationEngine {
    /**
     * Verify that a step is ready to be marked complete
     *
     * @param plan - The plan containing the step
     * @param stepNumber - The step number to verify
     * @param options - Verification options
     * @returns Verification result with details
     */
    async verifyStepCompletion(
        plan: Plan,
        stepNumber: number,
        options: VerificationOptions
    ): Promise<VerificationResult> {
        const step = plan.steps.find((s) => s.number === stepNumber);
        if (!step) {
            return {
                isValid: false,
                level: 'error',
                messages: [`Step ${stepNumber} not found in plan`],
            };
        }

        const messages: string[] = [];
        let level: 'passed' | 'warning' | 'error' = 'passed';
        let acceptanceCriteria: AcceptanceCriterion[] | undefined;
        let artifacts: string[] | undefined;

        // Check acceptance criteria if enabled
        if (options.checkAcceptanceCriteria) {
            acceptanceCriteria = await this.checkAcceptanceCriteria(step);
            const unchecked = acceptanceCriteria.filter((c) => !c.checked);

            if (unchecked.length > 0) {
                level = 'error';
                messages.push(
                    `${unchecked.length} acceptance criteria not checked:`
                );
                for (const criterion of unchecked) {
                    messages.push(`  - [ ] ${criterion.text}`);
                }
            } else if (acceptanceCriteria.length === 0) {
                level = 'warning';
                messages.push('No acceptance criteria found in step file');
            } else {
                messages.push(
                    `✓ All ${acceptanceCriteria.length} acceptance criteria checked`
                );
            }
        }

        // Check artifacts if enabled
        if (options.checkArtifacts) {
            artifacts = await this.checkArtifacts(step);
            if (artifacts.length > 0) {
                level = level === 'error' ? 'error' : 'warning';
                messages.push(`${artifacts.length} artifacts not found:`);
                for (const artifact of artifacts) {
                    messages.push(`  - ${artifact}`);
                }
            }
        }

        // Determine if verification passed
        const isValid = level === 'passed' || level === 'warning';

        return {
            isValid,
            level,
            messages,
            acceptanceCriteria,
            artifacts,
        };
    }

    /**
     * Check acceptance criteria in step file
     *
     * Parses markdown checkboxes from the step file and returns
     * a list of criteria with their checked status.
     *
     * @param step - The step to check
     * @returns List of acceptance criteria
     */
    private async checkAcceptanceCriteria(
        step: PlanStep
    ): Promise<AcceptanceCriterion[]> {
        try {
            const content = await readFile(step.filePath, 'utf-8');
            const criteria: AcceptanceCriterion[] = [];

            // Find the Acceptance Criteria section (match ## h2 only, not ### h3+)
            const sectionMatch = content.match(
                /##\s+Acceptance Criteria\s*\n([\s\S]*?)(?=\n##(?!\#)|$)/i
            );

            if (!sectionMatch) {
                return criteria;
            }

            const section = sectionMatch[1];

            // Parse markdown checkboxes: - [x] completed, - [ ] pending
            const checkboxRegex = /^\s*-\s*\[([ xX])\]\s*(.+)$/gm;
            let match;

            while ((match = checkboxRegex.exec(section)) !== null) {
                criteria.push({
                    text: match[2].trim(),
                    checked: match[1].toLowerCase() === 'x',
                    stepNumber: step.number,
                });
            }

            return criteria;
        } catch {
            // If we can't read the file, return empty array
            return [];
        }
    }

    /**
     * Check that artifacts mentioned in step file exist
     *
     * Parses the "Files Changed" section and verifies files exist.
     *
     * @param step - The step to check
     * @returns List of missing artifacts
     */
    private async checkArtifacts(step: PlanStep): Promise<string[]> {
        try {
            const content = await readFile(step.filePath, 'utf-8');
            const missing: string[] = [];

            // Find the "Files Changed" section (match ## h2 only, not ### h3+)
            const sectionMatch = content.match(
                /##\s+Files Changed\s*\n([\s\S]*?)(?=\n##(?!\#)|$)/i
            );

            if (!sectionMatch) {
                return missing;
            }

            const section = sectionMatch[1];

            // Extract file paths from list items
            // Matches: - path/to/file.ts or - `path/to/file.ts`
            const fileRegex = /^\s*-\s+`?([^\s`]+\.[a-zA-Z0-9]+)`?/gm;
            let match;

            while ((match = fileRegex.exec(section)) !== null) {
                const filePath = match[1].trim();
                
                // Resolve path relative to plan directory (go up from plan/ to root)
                const planRoot = resolve(dirname(step.filePath), '../..');
                const fullPath = resolve(planRoot, filePath);

                try {
                    await access(fullPath);
                } catch {
                    missing.push(filePath);
                }
            }

            return missing;
        } catch {
            // If we can't read the file, return empty array
            return [];
        }
    }

    /**
     * Determine if verification failure should block completion
     *
     * @param result - The verification result
     * @param options - Verification options
     * @returns True if completion should be blocked
     */
    shouldBlock(
        result: VerificationResult,
        options: VerificationOptions
    ): boolean {
        // Force flag always bypasses
        if (options.force) {
            return false;
        }

        // Advisory mode never blocks
        if (options.enforcement === 'advisory') {
            return false;
        }

        // Strict mode blocks on any error
        if (options.enforcement === 'strict' && result.level === 'error') {
            return true;
        }

        // Interactive mode doesn't block - caller handles prompting
        return false;
    }
}
