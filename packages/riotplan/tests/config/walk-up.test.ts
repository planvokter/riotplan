/**
 * Tests for walk-up detection logic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findPlansDirectory, clearWalkUpCache } from '../../src/config/walk-up.js';

describe('findPlansDirectory', () => {
    let testRoot: string;

    beforeEach(async () => {
        // Create a temporary directory for each test
        testRoot = await mkdtemp(join(tmpdir(), 'riotplan-test-'));
        clearWalkUpCache();
    });

    afterEach(async () => {
        // Clean up temporary directory
        if (testRoot) {
            await rm(testRoot, { recursive: true, force: true });
        }
        clearWalkUpCache();
    });

    describe('finding plans/ directory', () => {
        it('should find plans/ in current directory', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const result = findPlansDirectory(testRoot);
            expect(result).toBe(testRoot);
        });

        it('should find plans/ one level up', async () => {
            const parentDir = join(testRoot, 'parent');
            const childDir = join(parentDir, 'child');
            const plansDir = join(parentDir, 'plans');

            await mkdir(childDir, { recursive: true });
            await mkdir(plansDir, { recursive: true });

            const result = findPlansDirectory(childDir);
            expect(result).toBe(parentDir);
        });

        it('should find plans/ two levels up', async () => {
            const grandparentDir = join(testRoot, 'grandparent');
            const parentDir = join(grandparentDir, 'parent');
            const childDir = join(parentDir, 'child');
            const plansDir = join(grandparentDir, 'plans');

            await mkdir(childDir, { recursive: true });
            await mkdir(plansDir, { recursive: true });

            const result = findPlansDirectory(childDir);
            expect(result).toBe(grandparentDir);
        });

        it('should use closest plans/ when multiple exist', async () => {
            const parentDir = join(testRoot, 'parent');
            const childDir = join(parentDir, 'child');
            const parentPlansDir = join(parentDir, 'plans');
            const childPlansDir = join(childDir, 'plans');

            await mkdir(childPlansDir, { recursive: true });
            await mkdir(parentPlansDir, { recursive: true });

            // Should find the closest one (child level)
            const result = findPlansDirectory(childDir);
            expect(result).toBe(childDir);
        });
    });

    describe('not finding plans/ directory', () => {
        it('should return null when plans/ does not exist', async () => {
            const someDir = join(testRoot, 'some', 'nested', 'directory');
            await mkdir(someDir, { recursive: true });

            const result = findPlansDirectory(someDir);
            expect(result).toBeNull();
        });

        it('should return null when plans/ is a file, not a directory', async () => {
            const plansFile = join(testRoot, 'plans');
            await writeFile(plansFile, 'not a directory');

            const result = findPlansDirectory(testRoot);
            expect(result).toBeNull();
        });
    });

    describe('caching', () => {
        it('should cache results for the same starting path', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const result1 = findPlansDirectory(testRoot);
            const result2 = findPlansDirectory(testRoot);

            expect(result1).toBe(testRoot);
            expect(result2).toBe(testRoot);
            // Should use cache (we can't directly verify, but it should be faster)
        });

        it('should cache null results', async () => {
            const someDir = join(testRoot, 'some', 'directory');
            await mkdir(someDir, { recursive: true });

            const result1 = findPlansDirectory(someDir);
            const result2 = findPlansDirectory(someDir);

            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });

        it('should clear cache when clearWalkUpCache is called', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const result1 = findPlansDirectory(testRoot);
            expect(result1).toBe(testRoot);

            clearWalkUpCache();

            // After clearing, should still find it (but cache was cleared)
            const result2 = findPlansDirectory(testRoot);
            expect(result2).toBe(testRoot);
        });
    });

    describe('edge cases', () => {
        it('should handle absolute paths', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const result = findPlansDirectory(testRoot);
            expect(result).toBe(testRoot);
        });

        it('should handle paths with trailing slashes', async () => {
            const plansDir = join(testRoot, 'plans');
            await mkdir(plansDir, { recursive: true });

            const result = findPlansDirectory(testRoot + '/');
            expect(result).toBe(testRoot);
        });
    });
});
