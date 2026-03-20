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
 * Running from `/Users/tobrien/gitw/kjerneverk/riotplan/src/analysis`
 * will find `/Users/tobrien/gitw/kjerneverk/plans` and return
 * `/Users/tobrien/gitw/kjerneverk` (the parent directory).
 */
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
export declare function findPlansDirectory(startPath: string): string | null;
/**
 * Clear the walk-up cache
 *
 * Useful for testing or when the filesystem structure might have changed.
 * This allows the walk-up function to re-scan directories on the next call.
 */
export declare function clearWalkUpCache(): void;
//# sourceMappingURL=walk-up.d.ts.map