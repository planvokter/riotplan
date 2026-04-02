/**
 * Catalyst Loading and Resolution for RiotPlan
 *
 * This module handles loading and merging catalysts declared in the RiotPlan
 * configuration. It resolves catalyst identifiers (paths or NPM package names)
 * and uses the @planvokter/riotplan-catalyst package to load and merge them.
 */
import { type MergedCatalyst } from '@planvokter/riotplan-catalyst';
import type { RiotPlanConfig } from './schema.js';
/**
 * Load and merge catalysts declared in the configuration
 *
 * This function:
 * 1. Resolves catalyst identifiers to absolute paths
 * 2. Loads each catalyst using @planvokter/riotplan-catalyst
 * 3. Merges catalysts in the order specified
 * 4. Caches the result to avoid re-reading
 *
 * @param config - RiotPlan configuration
 * @param configFileDir - Directory containing the config file (for path resolution)
 * @returns Merged catalyst, or null if no catalysts configured
 * @throws Error if any catalyst fails to load or is invalid
 */
export declare function loadConfiguredCatalysts(config: RiotPlanConfig | null, configFileDir?: string): Promise<MergedCatalyst | null>;
/**
 * Clear the catalyst cache
 *
 * Useful for testing or when configuration might have changed.
 */
export declare function clearCatalystCache(): void;
/**
 * Check if environment variables override catalyst configuration
 *
 * Supports:
 * - RIOTPLAN_CATALYSTS: comma-separated list of catalyst identifiers
 * - RIOTPLAN_CATALYST_DIRECTORY: directory containing local catalysts
 *
 * @returns Partial config with environment variable overrides, or null if no overrides
 */
export declare function getCatalystEnvOverrides(): Partial<RiotPlanConfig> | null;
//# sourceMappingURL=catalyst-loader.d.ts.map