/**
 * Walk-Up Detection for Plan Directory
 *
 * This module implements tier 3 of the plan directory resolution strategy:
 * walking up the directory tree to find an existing `plans/` subdirectory.
 *
 * This provides zero-config experience - users can run riotplan from any
 * subdirectory and it will automatically find the plans/ directory in their
 * project root.
 *
 * Algorithm:
 * 1. Start from the given path (typically process.cwd())
 * 2. Walk up the directory tree
 * 3. At each level, check if a `plans/` subdirectory exists
 * 4. Return the first match found (parent directory containing plans/)
 * 5. Stop at filesystem root if no match found
 *
 * Example:
 * Running from `/Users/tobrien/gitw/planvokter/riotplan/src/analysis`
 * will find `/Users/tobrien/gitw/planvokter/plans` and return
 * `/Users/tobrien/gitw/planvokter` (the parent directory).
 */
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
/**
 * Cache for walk-up results to avoid repeated filesystem operations
 *
 * Key: starting path (normalized)
 * Value: parent directory containing plans/ (or null if not found)
 */
const walkUpCache = new Map();
/**
 * Find the first directory containing a `plans/` subdirectory by walking up
 * the directory tree from the given starting path.
 *
 * This function implements tier 3 of the plan directory resolution strategy.
 * It walks up from the starting path, checking each level for a `plans/`
 * subdirectory, and returns the parent directory of the first match found.
 *
 * @param startPath - The path to start walking up from (typically process.cwd())
 * @returns The parent directory containing `plans/`, or `null` if not found
 *
 * @example
 * ```typescript
 * // Running from /Users/me/project/src/utils
 * const plansDir = findPlansDirectory(process.cwd());
 * // If /Users/me/project/plans exists, returns '/Users/me/project'
 * // If not found, returns null
 * ```
 */
export function findPlansDirectory(startPath) {
    // Normalize the starting path for cache key
    const normalizedStart = resolve(startPath);
    // Check cache first
    if (walkUpCache.has(normalizedStart)) {
        return walkUpCache.get(normalizedStart) ?? null;
    }
    let currentPath = normalizedStart;
    // Walk up the directory tree until we reach the filesystem root
    while (currentPath !== '/') {
        // Check if plans/ subdirectory exists at this level
        const plansPath = join(currentPath, 'plans');
        if (existsSync(plansPath)) {
            // Verify it's actually a directory (not a file)
            try {
                const stats = statSync(plansPath);
                if (stats.isDirectory()) {
                    // Found it! Cache and return the parent directory
                    walkUpCache.set(normalizedStart, currentPath);
                    return currentPath;
                }
            }
            catch {
                // If stat fails, continue searching
                // (might be permission issue, but we'll try other paths)
            }
        }
        // Move up one directory level
        const parentPath = dirname(currentPath);
        // Check if we've reached the root (dirname('/') returns '/')
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }
    // No plans/ directory found - cache null result
    walkUpCache.set(normalizedStart, null);
    return null;
}
/**
 * Clear the walk-up cache
 *
 * Useful for testing or when the filesystem structure might have changed.
 * This allows the walk-up function to re-scan directories on the next call.
 */
export function clearWalkUpCache() {
    walkUpCache.clear();
}
//# sourceMappingURL=walk-up.js.map