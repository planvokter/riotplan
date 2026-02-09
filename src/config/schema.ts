/**
 * Configuration Schema for RiotPlan
 *
 * This module defines the Zod schema for RiotPlan configuration validation.
 * The schema is used by CardiganTime for configuration loading and validation.
 */

import { z } from 'zod';

/**
 * Zod schema for RiotPlan configuration
 *
 * Defines all configuration options with validation rules and defaults.
 * This schema is used by CardiganTime to:
 * - Validate configuration files
 * - Provide type-safe configuration access
 * - Handle environment variable overrides
 */
export const RiotPlanConfigSchema = z.object({
    /**
     * Path to the directory where plans are stored
     * Can be relative (resolved from config file location) or absolute
     * Defaults to './plans' if not specified
     */
    planDirectory: z.string().default('./plans'),

    /**
     * Default AI provider to use for plan generation
     * Optional - if not specified, uses system defaults
     */
    defaultProvider: z.enum(['anthropic', 'openai', 'gemini']).optional(),

    /**
     * Default model to use for plan generation
     * Optional - if not specified, uses provider defaults
     */
    defaultModel: z.string().optional(),

    /**
     * Path to custom plan templates directory
     * Can be relative (resolved from config file location) or absolute
     * Optional - if not specified, uses built-in templates
     */
    templateDirectory: z.string().optional(),

    /**
     * Ordered list of catalyst paths or IDs to apply to all plans
     * Can be local paths (relative to config file or absolute) or NPM package names
     * Catalysts are loaded and merged in the order specified
     * Optional - if not specified, no catalysts are applied
     */
    catalysts: z.array(z.string()).optional(),

    /**
     * Directory containing local catalyst packages
     * Can be relative (resolved from config file location) or absolute
     * Optional - if not specified, catalysts are resolved relative to config file
     */
    catalystDirectory: z.string().optional(),
});

/**
 * TypeScript type inferred from the Zod schema
 *
 * This type is exported for use throughout the codebase.
 * It matches the RiotPlanConfig interface in types.ts.
 */
export type RiotPlanConfig = z.infer<typeof RiotPlanConfigSchema>;
