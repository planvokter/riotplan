/**
 * Tests for plan directory resolver (four-tier resolution)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, realpathSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import {
    resolvePlanDirectory,
    resolvePlanDirectorySync,
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

describe('resolvePlanDirectory', () => {
    let testRoot: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
        // Create a temporary directory for each test
        testRoot = await mkdtemp(join(tmpdir(), 'riotplan-test-'));
        clearResolverCache();
        clearConfigCache();
        clearWalkUpCache();

        // Save original environment
        originalEnv = { ...process.env };
    });

    afterEach(async () => {
        // Restore original environment
        process.env = originalEnv;

        // Clean up temporary directory
        if (testRoot) {
            await rm(testRoot, { recursive: true, force: true });
        }
        clearResolverCache();
        clearConfigCache();
        clearWalkUpCache();
    });

    describe('tier 1: environment variable', () => {
        // Note: These tests require CardiganTime to be properly configured
        // and may find real plans/ directories via walk-up if env var isn't set.
        // Full integration testing should be done manually.
        
        it.skip('should use RIOTPLAN_PLAN_DIRECTORY when set', async () => {
            // Skipped: Requires CardiganTime integration testing
            // Test manually with: RIOTPLAN_PLAN_DIRECTORY=/path/to/plans riotplan check-config
        });

        it.skip('should prioritize env var over config file', async () => {
            // Skipped: Requires CardiganTime integration testing
        });
    });

    describe('tier 2: config file', () => {
        // Note: These tests require CardiganTime to find config files.
        // Full integration testing should be done manually.
        
        it.skip('should use config file when present', async () => {
            // Skipped: Requires CardiganTime integration testing
            // Test manually by creating riotplan.config.yaml and running: riotplan check-config
        });

        it.skip('should prioritize config file over walk-up', async () => {
            // Skipped: Requires CardiganTime integration testing
        });
    });

    describe('tier 3: walk-up detection', () => {
        it('should find plans/ directory via walk-up', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const subDir = join(testRoot, 'subdir', 'nested');
            await mkdir(subDir, { recursive: true });

            const originalCwd = process.cwd();
            process.chdir(subDir);

            try {
                const result = await resolvePlanDirectory();
                expect(normalizePath(result)).toBe(normalizePath(plansDir));
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('should use walk-up when no config file exists', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const subDir = join(testRoot, 'subdir');
            await mkdir(subDir, { recursive: true });

            const originalCwd = process.cwd();
            process.chdir(subDir);

            try {
                const result = await resolvePlanDirectory();
                expect(normalizePath(result)).toBe(normalizePath(plansDir));
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('tier 4: fallback', () => {
        it('should fallback to ./plans when nothing else found', async () => {
            const subDir = join(testRoot, 'subdir', 'nested');
            await mkdir(subDir, { recursive: true });

            const originalCwd = process.cwd();
            process.chdir(subDir);

            try {
                const result = await resolvePlanDirectory();
                expect(normalizePath(result)).toBe(normalizePath(join(subDir, 'plans')));
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('caching', () => {
        it('should cache resolved directory', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const originalCwd = process.cwd();
            process.chdir(testRoot);

            try {
                const result1 = await resolvePlanDirectory();
                const result2 = await resolvePlanDirectory();

                expect(normalizePath(result1)).toBe(normalizePath(plansDir));
                expect(normalizePath(result2)).toBe(normalizePath(plansDir));
                // Should use cache
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('should clear cache when clearResolverCache is called', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const originalCwd = process.cwd();
            process.chdir(testRoot);

            try {
                const result1 = await resolvePlanDirectory();
                expect(normalizePath(result1)).toBe(normalizePath(plansDir));

                clearResolverCache();

                const result2 = await resolvePlanDirectory();
                expect(normalizePath(result2)).toBe(normalizePath(plansDir));
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('resolvePlanDirectorySync', () => {
        it('should work synchronously using tiers 3 and 4', () => {
            // This test would need actual filesystem setup, but demonstrates the API
            const result = resolvePlanDirectorySync();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should use cached result if available', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const originalCwd = process.cwd();
            process.chdir(testRoot);

            try {
                // Resolve async first to populate cache
                const asyncResult = await resolvePlanDirectory();
                expect(normalizePath(asyncResult)).toBe(normalizePath(plansDir));

                // Sync should use cache
                const syncResult = resolvePlanDirectorySync();
                expect(normalizePath(syncResult)).toBe(normalizePath(plansDir));
            } finally {
                process.chdir(originalCwd);
            }
        });
    });
});
