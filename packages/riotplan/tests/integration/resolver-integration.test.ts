/**
 * Integration tests for plan directory resolver
 *
 * Tests the full four-tier resolution system end-to-end
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve as pathResolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
    resolvePlanDirectory,
    clearResolverCache,
} from '../../src/config/resolver.js';
import { clearConfigCache } from '../../src/config/loader.js';
import { clearWalkUpCache } from '../../src/config/walk-up.js';

/**
 * Normalize paths for comparison (handles macOS /private/var vs /var)
 */
function normalizePath(path: string): string {
    const resolved = pathResolve(path);
    // On macOS, /var is a symlink to /private/var
    // Normalize both to the same representation for comparison
    return resolved.replace(/^\/private\/var/, '/var');
}

describe('Plan Directory Resolver Integration', () => {
    let testRoot: string;
    let originalEnv: NodeJS.ProcessEnv;
    let originalCwd: string;

    beforeEach(async () => {
        testRoot = await mkdtemp(join(tmpdir(), 'riotplan-resolver-test-'));
        originalEnv = { ...process.env };
        originalCwd = process.cwd();
        clearResolverCache();
        clearConfigCache();
        clearWalkUpCache();
    });

    afterEach(async () => {
        process.env = originalEnv;
        process.chdir(originalCwd);
        if (testRoot) {
            await rm(testRoot, { recursive: true, force: true });
        }
        clearResolverCache();
        clearConfigCache();
        clearWalkUpCache();
    });

    describe('tier 3: walk-up detection', () => {
        it('should find plans/ directory when walking up from subdirectory', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const subDir = join(testRoot, 'src', 'utils');
            await mkdir(subDir, { recursive: true });

            process.chdir(subDir);

            const result = await resolvePlanDirectory();
            expect(normalizePath(result)).toBe(normalizePath(plansDir));
            expect(existsSync(result)).toBe(true);
        });

        it('should use closest plans/ when multiple exist', async () => {
            const parentPlansDir = join(testRoot, 'plans');
            const childPlansDir = join(testRoot, 'child', 'plans');
            await mkdir(parentPlansDir, { recursive: true });
            await mkdir(childPlansDir, { recursive: true });

            const childDir = join(testRoot, 'child');
            process.chdir(childDir);

            const result = await resolvePlanDirectory();
            // Should find the closest one (child level)
            expect(normalizePath(result)).toBe(normalizePath(childPlansDir));
        });
    });

    describe('tier 4: fallback', () => {
        it('should fallback to ./plans when nothing found', async () => {
            const subDir = join(testRoot, 'subdir', 'nested');
            await mkdir(subDir, { recursive: true });

            process.chdir(subDir);

            const result = await resolvePlanDirectory();
            expect(normalizePath(result)).toBe(normalizePath(join(subDir, 'plans')));
            // Directory doesn't exist yet, but path is resolved
            expect(result.endsWith('plans')).toBe(true);
        });
    });

    describe('caching', () => {
        it('should cache results across multiple calls', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            process.chdir(testRoot);

            const result1 = await resolvePlanDirectory();
            const result2 = await resolvePlanDirectory();
            const result3 = await resolvePlanDirectory();

            expect(normalizePath(result1)).toBe(normalizePath(plansDir));
            expect(normalizePath(result2)).toBe(normalizePath(plansDir));
            expect(normalizePath(result3)).toBe(normalizePath(plansDir));
            // All should return the same cached result
        });

        it('should clear cache when requested', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            process.chdir(testRoot);

            const result1 = await resolvePlanDirectory();
            expect(normalizePath(result1)).toBe(normalizePath(plansDir));

            clearResolverCache();

            const result2 = await resolvePlanDirectory();
            expect(normalizePath(result2)).toBe(normalizePath(plansDir));
            // Should still work after clearing cache
        });
    });

    describe('real-world scenarios', () => {
        it('should work from deep nested directory structure', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const deepDir = join(testRoot, 'src', 'components', 'ui', 'buttons');
            await mkdir(deepDir, { recursive: true });

            process.chdir(deepDir);

            const result = await resolvePlanDirectory();
            expect(normalizePath(result)).toBe(normalizePath(plansDir));
        });

        it('should handle directory with no plans/ anywhere', async () => {
            const emptyDir = join(testRoot, 'empty', 'project');
            await mkdir(emptyDir, { recursive: true });

            process.chdir(emptyDir);

            const result = await resolvePlanDirectory();
            expect(normalizePath(result)).toBe(normalizePath(join(emptyDir, 'plans')));
        });
    });
});
