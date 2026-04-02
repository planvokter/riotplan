/**
 * Tests for storage factory
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import {
    DefaultStorageProviderFactory,
    createStorageFactory,
    createProvider,
} from '../src/storage/factory.js';
import { SqliteStorageProvider } from '../src/storage/sqlite-provider.js';

describe('Storage Factory', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(tmpdir(), `riotplan-factory-test-${randomUUID()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('DefaultStorageProviderFactory', () => {
        it('should create factory with default config', () => {
            const factory = new DefaultStorageProviderFactory();
            
            expect(factory.defaultFormat).toBe('directory');
            expect(factory.sqliteConfig.extension).toBe('.plan');
        });

        it('should create factory with custom config', () => {
            const factory = new DefaultStorageProviderFactory({
                defaultFormat: 'sqlite',
                sqlite: {
                    extension: '.riotplan',
                },
            });
            
            expect(factory.defaultFormat).toBe('sqlite');
            expect(factory.sqliteConfig.extension).toBe('.riotplan');
        });

        it('should create SQLite provider for .plan path', () => {
            const factory = new DefaultStorageProviderFactory();
            const planPath = join(testDir, 'test.plan');
            
            const provider = factory.createProvider(planPath);
            
            expect(provider).toBeInstanceOf(SqliteStorageProvider);
            expect(provider.format).toBe('sqlite');
        });

        it('should create SQLite provider when format is forced', () => {
            const factory = new DefaultStorageProviderFactory();
            const planPath = join(testDir, 'test');
            
            const provider = factory.createProvider(planPath, { format: 'sqlite' });
            
            expect(provider).toBeInstanceOf(SqliteStorageProvider);
            // Path should have .plan extension added
            expect(provider.path).toBe(join(testDir, 'test.plan'));
        });

        it('should throw for directory format (not yet implemented)', () => {
            const factory = new DefaultStorageProviderFactory();
            const planPath = join(testDir, 'my-plan');
            
            expect(() => factory.createProvider(planPath)).toThrow(
                'Directory storage provider is not yet implemented'
            );
        });

        it('should detect existing SQLite plan', () => {
            const factory = new DefaultStorageProviderFactory();
            const planPath = join(testDir, 'existing.plan');
            
            // Create a real SQLite database
            const db = new Database(planPath);
            db.exec('CREATE TABLE test (id INTEGER)');
            db.close();
            
            const provider = factory.createProvider(planPath);
            
            expect(provider).toBeInstanceOf(SqliteStorageProvider);
        });

        describe('supportsPath', () => {
            it('should support .plan paths', () => {
                const factory = new DefaultStorageProviderFactory();
                
                expect(factory.supportsPath('my-plan.plan')).toBe(true);
            });

            it('should support directory paths', () => {
                const factory = new DefaultStorageProviderFactory();
                const dir = join(testDir, 'my-plan');
                mkdirSync(dir);
                
                expect(factory.supportsPath(dir)).toBe(true);
            });

            it('should support existing SQLite files', () => {
                const factory = new DefaultStorageProviderFactory();
                const dbPath = join(testDir, 'test.plan');
                const db = new Database(dbPath);
                db.exec('CREATE TABLE test (id INTEGER)');
                db.close();
                
                expect(factory.supportsPath(dbPath)).toBe(true);
            });

            it('should support existing directory plans', () => {
                const factory = new DefaultStorageProviderFactory();
                const planDir = join(testDir, 'dir-plan');
                mkdirSync(planDir);
                writeFileSync(join(planDir, 'SUMMARY.md'), '# Summary');
                
                expect(factory.supportsPath(planDir)).toBe(true);
            });
        });
    });

    describe('createStorageFactory', () => {
        it('should create factory with defaults', () => {
            const factory = createStorageFactory();
            
            expect(factory).toBeInstanceOf(DefaultStorageProviderFactory);
            expect(factory.defaultFormat).toBe('directory');
        });

        it('should create factory with custom config', () => {
            const factory = createStorageFactory({ defaultFormat: 'sqlite' });
            
            expect(factory.defaultFormat).toBe('sqlite');
        });
    });

    describe('createProvider', () => {
        it('should create provider with default config', () => {
            const planPath = join(testDir, 'test.plan');
            
            const provider = createProvider(planPath);
            
            expect(provider).toBeInstanceOf(SqliteStorageProvider);
        });

        it('should create provider with custom config', () => {
            const planPath = join(testDir, 'test.riotplan');
            
            const provider = createProvider(planPath, {
                format: 'sqlite',
                config: {
                    sqlite: { extension: '.riotplan' },
                },
            });
            
            expect(provider).toBeInstanceOf(SqliteStorageProvider);
            expect(provider.path).toBe(planPath);
        });
    });
});
