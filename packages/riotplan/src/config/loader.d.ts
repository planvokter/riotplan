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
import type { RiotPlanConfig } from './schema.js';
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
export declare function loadConfig(): Promise<RiotPlanConfig | null>;
/**
 * Run CardiganTime's built-in configuration diagnostics output.
 *
 * This prints source-tracked configuration details directly via CardiganTime.
 */
export declare function checkConfigWithCardiganTime(args?: Record<string, unknown>): Promise<void>;
/**
 * Clear the configuration cache
 *
 * Useful for testing or when configuration might have changed.
 */
export declare function clearConfigCache(): void;
//# sourceMappingURL=loader.d.ts.map