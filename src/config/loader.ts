/**
 * Configuration Loader for RiotPlan
 *
 * This module integrates with CardiganTime to load and validate RiotPlan
 * configuration from multiple sources (environment variables, config files).
 *
 * CardiganTime handles:
 * - Environment variable discovery (RIOTPLAN_PLAN_DIRECTORY, etc.)
 * - Config file discovery (riotplan.config.*, .riotplan/config.*, etc.)
 * - Hierarchical discovery (walking up directory tree)
 * - Multi-format support (YAML, JSON, JS, TS)
 * - Validation against Zod schema
 */

import { create } from '@utilarium/cardigantime';
import type { RiotPlanConfig } from './schema.js';
import { RiotPlanConfigSchema } from './schema.js';

/**
 * CardiganTime instance for RiotPlan configuration
 *
 * Configured with:
 * - App name: 'riotplan'
 * - Hierarchical discovery: enabled (walks up directory tree)
 * - Config file naming: supports all CardiganTime conventions
 * - Schema: RiotPlanConfigSchema for validation
 */
const cardigantime = create({
    defaults: {
        configDirectory: process.cwd(),
        isRequired: false, // Config file is optional
        pathResolution: {
            pathFields: ['planDirectory', 'templateDirectory'],
        },
    },
    configShape: RiotPlanConfigSchema.shape,
    features: ['config'],
    // Hierarchical discovery is enabled by default in CardiganTime
});

/**
 * Cache for loaded configuration to avoid repeated filesystem operations
 */
let cachedConfig: RiotPlanConfig | null = null;
let configLoadAttempted = false;

/**
 * Load and validate RiotPlan configuration
 *
 * Uses CardiganTime to:
 * 1. Check environment variables (RIOTPLAN_PLAN_DIRECTORY, etc.)
 * 2. Search for config files (riotplan.config.*, .riotplan/config.*, etc.)
 * 3. Walk up directory tree (hierarchical discovery)
 * 4. Validate against Zod schema
 * 5. Apply defaults
 *
 * @returns Validated configuration, or null if no config found and defaults applied
 * @throws Error if config file exists but is invalid
 */
export async function loadConfig(): Promise<RiotPlanConfig | null> {
    // Return cached config if available
    if (cachedConfig !== null) {
        return cachedConfig;
    }

    // If we've already tried to load and got null, don't try again
    if (configLoadAttempted) {
        return null;
    }

    try {
        configLoadAttempted = true;

        // Use CardiganTime to read configuration
        // Pass empty args since we're not using CLI integration
        const args = {};
        const config = await cardigantime.read(args);

        // Validate the configuration
        await cardigantime.validate(config);

        // Cache the result
        cachedConfig = config as RiotPlanConfig;
        return cachedConfig;
    } catch (error) {
        // If config file doesn't exist, that's fine - return null
        // CardiganTime will throw if config is invalid, which we should propagate
        if (error instanceof Error && error.message.includes('not found')) {
            return null;
        }

        // Enhance error message for better debugging
        if (error instanceof Error) {
            // Check if it's a JSON parsing error
            if (error.message.includes('JSON') || error.message.includes('parse')) {
                throw new Error(
                    `Failed to parse RiotPlan configuration file: ${error.message}\n\n` +
                    `Please check that your config file (riotplan.config.* or .riotplan/config.*) contains valid JSON/YAML/JS.\n` +
                    `Common issues:\n` +
                    `- Missing quotes around strings\n` +
                    `- Trailing commas in JSON\n` +
                    `- Invalid YAML indentation\n\n` +
                    `Original error: ${error.message}`
                );
            }
            
            // Check if it's a validation error
            if (error.message.includes('validation') || error.message.includes('schema')) {
                throw new Error(
                    `RiotPlan configuration validation failed: ${error.message}\n\n` +
                    `Valid configuration options:\n` +
                    `- planDirectory: string (path to plans directory)\n` +
                    `- defaultProvider: 'anthropic' | 'openai' | 'gemini'\n` +
                    `- defaultModel: string\n` +
                    `- templateDirectory: string (path to custom templates)\n\n` +
                    `Original error: ${error.message}`
                );
            }
        }

        // Re-throw other errors with context
        throw new Error(
            `Failed to load RiotPlan configuration: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Clear the configuration cache
 *
 * Useful for testing or when configuration might have changed.
 */
export function clearConfigCache(): void {
    cachedConfig = null;
    configLoadAttempted = false;
}
