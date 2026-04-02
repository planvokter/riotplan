/**
 * Plan Directory Resolver
 *
 * This module implements the main four-tier plan directory resolution strategy:
 *
 * 1. **Environment Variable** (Tier 1) - RIOTPLAN_PLAN_DIRECTORY
 *    Handled by CardiganTime automatically
 *
 * 2. **Configuration File** (Tier 2) - riotplan.config.*, .riotplan/config.*, etc.
 *    Handled by CardiganTime with hierarchical discovery
 *
 * 3. **Walk-Up Detection** (Tier 3) - Find existing plans/ directory
 *    Custom logic to walk up directory tree
 *
 * 4. **Fallback** (Tier 4) - Default to ./plans in current directory
 *    Ensures zero-config experience always works
 *
 * This is the main entry point for resolving the plan directory throughout riotplan.
 */

import { resolve, join } from 'node:path';
import { loadConfig } from './loader.js';
import { findPlansDirectory } from './walk-up.js';

/**
 * Cache for resolved plan directory to avoid repeated resolution
 */
let cachedPlanDirectory: string | null = null;
let resolutionAttempted = false;

/**
 * Resolve the plan directory using the four-tier strategy
 *
 * This function orchestrates all four tiers of plan directory resolution:
 *
 * 1. **Tier 1 & 2**: Check CardiganTime config (env var + config files)
 *    - If `planDirectory` is set in config, use it (resolved relative to config file)
 *    - CardiganTime handles environment variable RIOTPLAN_PLAN_DIRECTORY
 *
 * 2. **Tier 3**: Walk up directory tree looking for existing `plans/` directory
 *    - Starts from `process.cwd()`
 *    - Returns first `plans/` directory found
 *
 * 3. **Tier 4**: Fallback to `./plans` relative to current directory
 *    - Ensures zero-config experience always works
 *    - Directory will be created on first use if needed
 *
 * @returns Absolute path to the plan directory
 *
 * @example
 * ```typescript
 * // With RIOTPLAN_PLAN_DIRECTORY=/custom/plans
 * resolvePlanDirectory() // Returns '/custom/plans'
 *
 * // With config file: planDirectory: './my-plans'
 * resolvePlanDirectory() // Returns '/path/to/config/my-plans'
 *
 * // With plans/ in project root
 * resolvePlanDirectory() // Returns '/path/to/project/plans'
 *
 * // No config, no plans/ found
 * resolvePlanDirectory() // Returns '/current/dir/plans'
 * ```
 */
export async function resolvePlanDirectory(): Promise<string> {
    // Return cached result if available
    if (cachedPlanDirectory !== null) {
        return cachedPlanDirectory;
    }

    // If we've already attempted resolution and got a result, return it
    // (This prevents re-running async operations)
    if (resolutionAttempted && cachedPlanDirectory === null) {
        // This shouldn't happen, but handle it gracefully
        return join(process.cwd(), 'plans');
    }

    resolutionAttempted = true;

    try {
        // Tier 1 & 2: Check CardiganTime config (env var + config files)
        const config = await loadConfig();
        if (config?.planDirectory) {
            // Resolve the path (handles both relative and absolute)
            // If relative, it's relative to the config file location (handled by CardiganTime)
            // If absolute, resolve() will return it as-is
            const resolvedPath = resolve(config.planDirectory);
            cachedPlanDirectory = resolvedPath;
            return resolvedPath;
        }
    } catch (error) {
        // If config loading fails (e.g., invalid config file), continue
        // to lower tiers for graceful degradation
        // Error is silently ignored - user can check config with --check-config if needed
        void error; // Suppress unused variable warning
    }

    // Tier 3: Walk up looking for existing plans/ directory
    const foundPlansParent = findPlansDirectory(process.cwd());
    if (foundPlansParent) {
        const plansPath = join(foundPlansParent, 'plans');
        cachedPlanDirectory = resolve(plansPath);
        return cachedPlanDirectory;
    }

    // Tier 4: Fallback to ./plans in current directory
    const fallbackPath = join(process.cwd(), 'plans');
    cachedPlanDirectory = resolve(fallbackPath);
    return cachedPlanDirectory;
}

/**
 * Synchronous version of resolvePlanDirectory for cases where async isn't possible
 *
 * This uses cached results if available, otherwise falls back to tier 3 and 4
 * (which are synchronous). Tier 1-2 require async config loading.
 *
 * @returns Absolute path to the plan directory
 */
export function resolvePlanDirectorySync(): string {
    // If we have a cached result, use it
    if (cachedPlanDirectory !== null) {
        return cachedPlanDirectory;
    }

    // Tier 3: Walk up looking for existing plans/ directory
    const foundPlansParent = findPlansDirectory(process.cwd());
    if (foundPlansParent) {
        const plansPath = join(foundPlansParent, 'plans');
        cachedPlanDirectory = resolve(plansPath);
        return cachedPlanDirectory;
    }

    // Tier 4: Fallback to ./plans in current directory
    const fallbackPath = join(process.cwd(), 'plans');
    cachedPlanDirectory = resolve(fallbackPath);
    return cachedPlanDirectory;
}

/**
 * Clear the resolver cache
 *
 * Useful for testing or when configuration or filesystem structure might have changed.
 * This forces the resolver to re-run the four-tier resolution on the next call.
 */
export function clearResolverCache(): void {
    cachedPlanDirectory = null;
    resolutionAttempted = false;
}
