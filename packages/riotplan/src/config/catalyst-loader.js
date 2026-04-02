/**
 * Catalyst Loading and Resolution for RiotPlan
 *
 * This module handles loading and merging catalysts declared in the RiotPlan
 * configuration. It resolves catalyst identifiers (paths or NPM package names)
 * and uses the @planvokter/riotplan-catalyst package to load and merge them.
 */
import { resolve, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { loadCatalystSafe, mergeCatalysts, } from '@planvokter/riotplan-catalyst';
/**
 * Cache for loaded and merged catalysts to avoid re-reading on every operation
 */
let cachedMergedCatalyst = null;
let catalystCacheKey = null;
/**
 * Generate a cache key from config to detect when catalysts have changed
 */
function generateCacheKey(config) {
    if (!config?.catalysts || config.catalysts.length === 0) {
        return 'no-catalysts';
    }
    return JSON.stringify({
        catalysts: config.catalysts,
        catalystDirectory: config.catalystDirectory,
    });
}
/**
 * Resolve a catalyst identifier to an absolute path
 *
 * Handles three types of identifiers:
 * 1. Absolute paths: used as-is
 * 2. Relative paths: resolved relative to config file location or catalystDirectory
 * 3. NPM package names: resolved from node_modules (Phase 2 - not yet implemented)
 *
 * @param identifier - Catalyst path or NPM package name
 * @param configFileDir - Directory containing the config file (for relative path resolution)
 * @param catalystDirectory - Optional catalyst directory from config
 * @returns Absolute path to the catalyst directory
 * @throws Error if catalyst cannot be resolved
 */
function resolveCatalystPath(identifier, configFileDir, catalystDirectory) {
    // If it's an absolute path, use it directly
    if (isAbsolute(identifier)) {
        if (!existsSync(identifier)) {
            throw new Error(`Catalyst not found at absolute path: ${identifier}`);
        }
        return identifier;
    }
    // If catalystDirectory is specified, try there first
    if (catalystDirectory) {
        const catalystPath = resolve(catalystDirectory, identifier);
        if (existsSync(catalystPath)) {
            return catalystPath;
        }
    }
    // Try relative to config file location
    const relativePath = resolve(configFileDir, identifier);
    if (existsSync(relativePath)) {
        return relativePath;
    }
    // Phase 2: Try to resolve from node_modules
    // For now, we'll throw an error if not found locally
    throw new Error(`Catalyst not found: ${identifier}\n` +
        `Searched in:\n` +
        (catalystDirectory ? `  - ${resolve(catalystDirectory, identifier)}\n` : '') +
        `  - ${relativePath}\n` +
        `\nNote: NPM package resolution is not yet implemented.`);
}
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
export async function loadConfiguredCatalysts(config, configFileDir = process.cwd()) {
    // If no config or no catalysts, return null
    if (!config?.catalysts || config.catalysts.length === 0) {
        return null;
    }
    // Check cache
    const cacheKey = generateCacheKey(config);
    if (catalystCacheKey === cacheKey && cachedMergedCatalyst !== null) {
        return cachedMergedCatalyst;
    }
    try {
        // Resolve all catalyst identifiers to absolute paths
        const catalystPaths = config.catalysts.map((identifier) => resolveCatalystPath(identifier, configFileDir, config.catalystDirectory));
        // Load all catalysts
        const catalysts = [];
        for (const path of catalystPaths) {
            const result = await loadCatalystSafe(path);
            if (result.success && result.catalyst) {
                catalysts.push(result.catalyst);
            }
            else {
                throw new Error(`Failed to load catalyst from ${path}: ${result.error || 'Unknown error'}`);
            }
        }
        // Merge catalysts in order
        const merged = mergeCatalysts(catalysts);
        // Cache the result
        cachedMergedCatalyst = merged;
        catalystCacheKey = cacheKey;
        return merged;
    }
    catch (error) {
        throw new Error(`Failed to load configured catalysts: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Clear the catalyst cache
 *
 * Useful for testing or when configuration might have changed.
 */
export function clearCatalystCache() {
    cachedMergedCatalyst = null;
    catalystCacheKey = null;
}
/**
 * Check if environment variables override catalyst configuration
 *
 * Supports:
 * - RIOTPLAN_CATALYSTS: comma-separated list of catalyst identifiers
 * - RIOTPLAN_CATALYST_DIRECTORY: directory containing local catalysts
 *
 * @returns Partial config with environment variable overrides, or null if no overrides
 */
export function getCatalystEnvOverrides() {
    const overrides = {};
    let hasOverrides = false;
    // Check for RIOTPLAN_CATALYSTS
    const catalystsEnv = process.env.RIOTPLAN_CATALYSTS;
    if (catalystsEnv) {
        overrides.catalysts = catalystsEnv.split(',').map((s) => s.trim()).filter(Boolean);
        hasOverrides = true;
    }
    // Check for RIOTPLAN_CATALYST_DIRECTORY
    const catalystDirEnv = process.env.RIOTPLAN_CATALYST_DIRECTORY;
    if (catalystDirEnv) {
        overrides.catalystDirectory = catalystDirEnv;
        hasOverrides = true;
    }
    return hasOverrides ? overrides : null;
}
//# sourceMappingURL=catalyst-loader.js.map