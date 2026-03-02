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

    /**
     * Verification and enforcement settings
     * Controls how RiotPlan verifies step completion and enforces quality gates
     * Optional - if not specified, uses sensible defaults
     */
    verification: z.object({
        /**
         * Verification enforcement level
         * - advisory: Show warnings but allow completion
         * - interactive: Prompt user for confirmation when issues found
         * - strict: Block completion unless --force flag is used
         * Defaults to 'interactive' (balanced safety and flexibility)
         */
        enforcement: z.enum(['advisory', 'interactive', 'strict']).default('interactive'),
        
        /**
         * Enable acceptance criteria checking
         * Parses step files for markdown checkboxes and verifies they're checked
         * Defaults to true
         */
        checkAcceptanceCriteria: z.boolean().default(true),
        
        /**
         * Enable artifact verification
         * Checks that files mentioned in "Files Changed" section actually exist
         * Defaults to false (opt-in due to complexity)
         */
        checkArtifacts: z.boolean().default(false),
        
        /**
         * Auto-generate retrospectives when transitioning to completed
         * Automatically calls riotplan_generate_retrospective on plan completion
         * Defaults to true
         */
        autoRetrospective: z.boolean().default(true),
        
        /**
         * Require evidence links in reflections
         * Warns or blocks if reflections don't include evidence (commits, test output, etc.)
         * Defaults to false (encouraged but not required)
         */
        requireEvidence: z.boolean().default(false)
    }).default({
        enforcement: 'interactive',
        checkAcceptanceCriteria: true,
        checkArtifacts: false,
        autoRetrospective: true,
        requireEvidence: false,
    }),

    /**
     * Optional cloud storage mode for MCP plan/context operations.
     *
     * Cloud mode is opt-in and never replaces local mode by default.
     * When enabled, RiotPlan MCP mirrors plan and context data between GCS buckets
     * and a local cache directory.
     */
    cloud: z.object({
        enabled: z.boolean().default(false),
        incrementalSyncEnabled: z.boolean().default(true),
        syncFreshnessTtlMs: z.number().int().min(0).default(0),
        syncTimeoutMs: z.number().int().min(1).default(120000),
        planBucket: z.string().optional(),
        planPrefix: z.string().optional(),
        contextBucket: z.string().optional(),
        contextPrefix: z.string().optional(),
        projectId: z.string().optional(),
        keyFilename: z.string().optional(),
        credentialsJson: z.string().optional(),
        cacheDirectory: z.string().optional(),
    }).optional(),
});

/**
 * TypeScript type inferred from the Zod schema
 *
 * This type is exported for use throughout the codebase.
 * It matches the RiotPlanConfig interface in types.ts.
 */
export type RiotPlanConfig = z.infer<typeof RiotPlanConfigSchema>;
