/**
 * Tests for storage utility functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import {
    detectPlanFormat,
    hasSqliteHeader,
    isSqlitePath,
    isDirectoryPath,
    getFormatExtension,
    ensureFormatExtension,
    inferFormatFromPath,
    validatePlanPath,
    getPlanNameFromPath,
    generatePlanUuid,
    abbreviateUuid,
    formatPlanFilename,
} from '../src/storage/utils.js';

describe('Storage utilities', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(tmpdir(), `riotplan-utils-test-${randomUUID()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('detectPlanFormat', () => {
        it('should return unknown for non-existent path', () => {
            const result = detectPlanFormat('/nonexistent/path');
            expect(result).toBe('unknown');
        });

        it('should detect directory format with SUMMARY.md', () => {
            const planDir = join(testDir, 'my-plan');
            mkdirSync(planDir);
            writeFileSync(join(planDir, 'SUMMARY.md'), '# Summary');

            const result = detectPlanFormat(planDir);
            expect(result).toBe('directory');
        });

        it('should detect directory format with STATUS.md', () => {
            const planDir = join(testDir, 'my-plan');
            mkdirSync(planDir);
            writeFileSync(join(planDir, 'STATUS.md'), '# Status');

            const result = detectPlanFormat(planDir);
            expect(result).toBe('directory');
        });

        it('should detect directory format with IDEA.md', () => {
            const planDir = join(testDir, 'my-plan');
            mkdirSync(planDir);
            writeFileSync(join(planDir, 'IDEA.md'), '# Idea');

            const result = detectPlanFormat(planDir);
            expect(result).toBe('directory');
        });

        it('should detect directory format with plan/ subdirectory', () => {
            const planDir = join(testDir, 'my-plan');
            mkdirSync(join(planDir, 'plan'), { recursive: true });

            const result = detectPlanFormat(planDir);
            expect(result).toBe('directory');
        });

        it('should return unknown for empty directory', () => {
            const emptyDir = join(testDir, 'empty');
            mkdirSync(emptyDir);

            const result = detectPlanFormat(emptyDir);
            expect(result).toBe('unknown');
        });

        it('should detect SQLite format', () => {
            const dbPath = join(testDir, 'test.plan');
            const db = new Database(dbPath);
            db.exec('CREATE TABLE test (id INTEGER)');
            db.close();

            const result = detectPlanFormat(dbPath);
            expect(result).toBe('sqlite');
        });

        it('should return unknown for .plan file without SQLite header', () => {
            const fakePlan = join(testDir, 'fake.plan');
            writeFileSync(fakePlan, 'not a sqlite file');

            const result = detectPlanFormat(fakePlan);
            expect(result).toBe('unknown');
        });
    });

    describe('hasSqliteHeader', () => {
        it('should return true for valid SQLite file', () => {
            const dbPath = join(testDir, 'test.db');
            const db = new Database(dbPath);
            db.exec('CREATE TABLE test (id INTEGER)');
            db.close();

            expect(hasSqliteHeader(dbPath)).toBe(true);
        });

        it('should return false for non-SQLite file', () => {
            const textFile = join(testDir, 'test.txt');
            writeFileSync(textFile, 'Hello world');

            expect(hasSqliteHeader(textFile)).toBe(false);
        });

        it('should return false for empty file', () => {
            const emptyFile = join(testDir, 'empty.txt');
            writeFileSync(emptyFile, '');

            expect(hasSqliteHeader(emptyFile)).toBe(false);
        });

        it('should return false for non-existent file', () => {
            expect(hasSqliteHeader('/nonexistent/file')).toBe(false);
        });
    });

    describe('isSqlitePath', () => {
        it('should return true for .plan extension', () => {
            expect(isSqlitePath('my-plan.plan')).toBe(true);
        });

        it('should return false for directory path', () => {
            expect(isSqlitePath('my-plan')).toBe(false);
        });

        it('should respect custom extension in config', () => {
            expect(isSqlitePath('my-plan.riotplan', { sqlite: { extension: '.riotplan' } })).toBe(true);
            expect(isSqlitePath('my-plan.plan', { sqlite: { extension: '.riotplan' } })).toBe(false);
        });
    });

    describe('isDirectoryPath', () => {
        it('should return true for existing directory', () => {
            const dir = join(testDir, 'subdir');
            mkdirSync(dir);

            expect(isDirectoryPath(dir)).toBe(true);
        });

        it('should return false for existing file', () => {
            const file = join(testDir, 'file.txt');
            writeFileSync(file, 'content');

            expect(isDirectoryPath(file)).toBe(false);
        });

        it('should return true for non-existent path without extension', () => {
            expect(isDirectoryPath('/nonexistent/my-plan')).toBe(true);
        });

        it('should return false for non-existent path with extension', () => {
            expect(isDirectoryPath('/nonexistent/my-plan.plan')).toBe(false);
        });
    });

    describe('getFormatExtension', () => {
        it('should return .plan for sqlite format', () => {
            expect(getFormatExtension('sqlite')).toBe('.plan');
        });

        it('should return empty string for directory format', () => {
            expect(getFormatExtension('directory')).toBe('');
        });

        it('should respect custom extension in config', () => {
            expect(getFormatExtension('sqlite', { sqlite: { extension: '.riotplan' } })).toBe('.riotplan');
        });
    });

    describe('ensureFormatExtension', () => {
        it('should add .plan extension for sqlite format', () => {
            expect(ensureFormatExtension('my-plan', 'sqlite')).toBe('my-plan.plan');
        });

        it('should not duplicate extension', () => {
            expect(ensureFormatExtension('my-plan.plan', 'sqlite')).toBe('my-plan.plan');
        });

        it('should not modify path for directory format', () => {
            expect(ensureFormatExtension('my-plan', 'directory')).toBe('my-plan');
        });
    });

    describe('inferFormatFromPath', () => {
        it('should infer sqlite from .plan extension', () => {
            expect(inferFormatFromPath('my-plan.plan')).toBe('sqlite');
        });

        it('should infer directory from path without extension', () => {
            expect(inferFormatFromPath('my-plan')).toBe('directory');
        });

        it('should detect actual format for existing paths', () => {
            // Create a directory plan
            const planDir = join(testDir, 'dir-plan');
            mkdirSync(planDir);
            writeFileSync(join(planDir, 'SUMMARY.md'), '# Summary');

            expect(inferFormatFromPath(planDir)).toBe('directory');

            // Create a SQLite plan
            const dbPath = join(testDir, 'sqlite.plan');
            const db = new Database(dbPath);
            db.exec('CREATE TABLE test (id INTEGER)');
            db.close();

            expect(inferFormatFromPath(dbPath)).toBe('sqlite');
        });

        it('should use config default for truly ambiguous paths', () => {
            // A path without extension is inferred as directory (not ambiguous)
            expect(inferFormatFromPath('ambiguous', { defaultFormat: 'sqlite' })).toBe('directory');
            expect(inferFormatFromPath('ambiguous', { defaultFormat: 'directory' })).toBe('directory');
            
            // A path with .plan extension is inferred as sqlite
            expect(inferFormatFromPath('ambiguous.plan', { defaultFormat: 'directory' })).toBe('sqlite');
        });
    });

    describe('validatePlanPath', () => {
        it('should reject empty path', () => {
            expect(validatePlanPath('', 'directory')).toBe('Plan path cannot be empty');
            expect(validatePlanPath('  ', 'sqlite')).toBe('Plan path cannot be empty');
        });

        it('should reject sqlite path without extension', () => {
            const error = validatePlanPath('my-plan', 'sqlite');
            expect(error).toContain('.plan');
        });

        it('should accept sqlite path with extension', () => {
            expect(validatePlanPath('my-plan.plan', 'sqlite')).toBeNull();
        });

        it('should reject directory path with extension', () => {
            const error = validatePlanPath('my-plan.txt', 'directory');
            expect(error).toContain('should not have a file extension');
        });

        it('should accept directory path without extension', () => {
            expect(validatePlanPath('my-plan', 'directory')).toBeNull();
        });
    });

    describe('getPlanNameFromPath', () => {
        it('should extract name from sqlite path', () => {
            expect(getPlanNameFromPath('my-plan.plan', 'sqlite')).toBe('my-plan');
        });

        it('should extract name from directory path', () => {
            expect(getPlanNameFromPath('my-plan', 'directory')).toBe('my-plan');
        });

        it('should handle paths with directories', () => {
            expect(getPlanNameFromPath('/path/to/my-plan.plan', 'sqlite')).toBe('my-plan');
            expect(getPlanNameFromPath('/path/to/my-plan', 'directory')).toBe('my-plan');
        });

        it('should handle Windows-style paths', () => {
            expect(getPlanNameFromPath('C:\\path\\to\\my-plan.plan', 'sqlite')).toBe('my-plan');
        });
    });

    describe('UUID utilities', () => {
        describe('generatePlanUuid', () => {
            it('should generate a valid UUID v4', () => {
                const uuid = generatePlanUuid();
                
                // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                expect(uuid).toMatch(uuidRegex);
            });

            it('should generate unique UUIDs', () => {
                const uuid1 = generatePlanUuid();
                const uuid2 = generatePlanUuid();
                
                expect(uuid1).not.toBe(uuid2);
            });
        });

        describe('abbreviateUuid', () => {
            it('should return first 8 characters', () => {
                const uuid = 'a3f7b2c1-1234-4567-89ab-cdef01234567';
                expect(abbreviateUuid(uuid)).toBe('a3f7b2c1');
            });

            it('should handle short UUIDs', () => {
                const shortUuid = 'abc123';
                expect(abbreviateUuid(shortUuid)).toBe('abc123');
            });
        });

        describe('formatPlanFilename', () => {
            it('should format filename with UUID abbreviation and slug', () => {
                const uuid = 'a3f7b2c1-1234-4567-89ab-cdef01234567';
                const slug = 'riotplan-http-mcp';
                
                expect(formatPlanFilename(uuid, slug)).toBe('a3f7b2c1-riotplan-http-mcp.plan');
            });

            it('should handle different slugs', () => {
                const uuid = 'b1c2d3e4-5678-4901-89ab-cdef01234567';
                
                expect(formatPlanFilename(uuid, 'my-feature')).toBe('b1c2d3e4-my-feature.plan');
                expect(formatPlanFilename(uuid, 'another-plan')).toBe('b1c2d3e4-another-plan.plan');
            });
        });
    });
});
