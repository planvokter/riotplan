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
export declare const RiotPlanConfigSchema: z.ZodObject<{
    planDirectory: z.ZodDefault<z.ZodString>;
    defaultProvider: z.ZodOptional<z.ZodEnum<{
        anthropic: "anthropic";
        openai: "openai";
        gemini: "gemini";
    }>>;
    defaultModel: z.ZodOptional<z.ZodString>;
    templateDirectory: z.ZodOptional<z.ZodString>;
    catalysts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    catalystDirectory: z.ZodOptional<z.ZodString>;
    verification: z.ZodDefault<z.ZodObject<{
        enforcement: z.ZodDefault<z.ZodEnum<{
            advisory: "advisory";
            interactive: "interactive";
            strict: "strict";
        }>>;
        checkAcceptanceCriteria: z.ZodDefault<z.ZodBoolean>;
        checkArtifacts: z.ZodDefault<z.ZodBoolean>;
        autoRetrospective: z.ZodDefault<z.ZodBoolean>;
        requireEvidence: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    cloud: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        incrementalSyncEnabled: z.ZodDefault<z.ZodBoolean>;
        syncFreshnessTtlMs: z.ZodDefault<z.ZodNumber>;
        syncTimeoutMs: z.ZodDefault<z.ZodNumber>;
        planBucket: z.ZodOptional<z.ZodString>;
        planPrefix: z.ZodOptional<z.ZodString>;
        contextBucket: z.ZodOptional<z.ZodString>;
        contextPrefix: z.ZodOptional<z.ZodString>;
        projectId: z.ZodOptional<z.ZodString>;
        keyFilename: z.ZodOptional<z.ZodString>;
        credentialsJson: z.ZodOptional<z.ZodString>;
        cacheDirectory: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * TypeScript type inferred from the Zod schema
 *
 * This type is exported for use throughout the codebase.
 * It matches the RiotPlanConfig interface in types.ts.
 */
export type RiotPlanConfig = z.infer<typeof RiotPlanConfigSchema>;
//# sourceMappingURL=schema.d.ts.map