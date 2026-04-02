/**
 * Tests for configuration module
 */

import { describe, it, expect } from 'vitest';
import {
    mergeFormatConfig,
    DEFAULT_FORMAT_CONFIG,
    DEFAULT_SQLITE_CONFIG,
    DEFAULT_DIRECTORY_CONFIG,
} from '../src/config.js';
import type { FormatConfig } from '../src/config.js';

describe('Configuration', () => {
    describe('DEFAULT_FORMAT_CONFIG', () => {
        it('should have directory as default format', () => {
            expect(DEFAULT_FORMAT_CONFIG.defaultFormat).toBe('directory');
        });

        it('should have SQLite defaults', () => {
            expect(DEFAULT_SQLITE_CONFIG.walMode).toBe(true);
            expect(DEFAULT_SQLITE_CONFIG.extension).toBe('.plan');
            expect(DEFAULT_SQLITE_CONFIG.pragmas).toBeDefined();
        });

        it('should have directory defaults', () => {
            expect(DEFAULT_DIRECTORY_CONFIG.usePlanSubdir).toBe(true);
            expect(DEFAULT_DIRECTORY_CONFIG.permissions).toBe('0755');
        });
    });

    describe('mergeFormatConfig', () => {
        it('should return defaults when no config provided', () => {
            const result = mergeFormatConfig();
            
            expect(result).toEqual(DEFAULT_FORMAT_CONFIG);
        });

        it('should return defaults when empty config provided', () => {
            const result = mergeFormatConfig({});
            
            expect(result.defaultFormat).toBe('directory');
            expect(result.sqlite.walMode).toBe(true);
            expect(result.directory.usePlanSubdir).toBe(true);
        });

        it('should override defaultFormat', () => {
            const config: Partial<FormatConfig> = {
                defaultFormat: 'sqlite',
            };
            
            const result = mergeFormatConfig(config);
            
            expect(result.defaultFormat).toBe('sqlite');
            // Other defaults should be preserved
            expect(result.sqlite.walMode).toBe(true);
            expect(result.directory.usePlanSubdir).toBe(true);
        });

        it('should merge SQLite config', () => {
            const config: Partial<FormatConfig> = {
                sqlite: {
                    walMode: false,
                    extension: '.riotplan',
                },
            };
            
            const result = mergeFormatConfig(config);
            
            expect(result.sqlite.walMode).toBe(false);
            expect(result.sqlite.extension).toBe('.riotplan');
            // Default pragmas should still be present
            expect(result.sqlite.pragmas['foreign_keys']).toBe(true);
        });

        it('should merge SQLite pragmas', () => {
            const config: Partial<FormatConfig> = {
                sqlite: {
                    pragmas: {
                        'cache_size': 10000,
                        'foreign_keys': false, // Override default
                    },
                },
            };
            
            const result = mergeFormatConfig(config);
            
            expect(result.sqlite.pragmas['cache_size']).toBe(10000);
            expect(result.sqlite.pragmas['foreign_keys']).toBe(false);
            // Other default pragmas should be preserved
            expect(result.sqlite.pragmas['journal_mode']).toBe('WAL');
        });

        it('should merge directory config', () => {
            const config: Partial<FormatConfig> = {
                directory: {
                    usePlanSubdir: false,
                    permissions: '0700',
                },
            };
            
            const result = mergeFormatConfig(config);
            
            expect(result.directory.usePlanSubdir).toBe(false);
            expect(result.directory.permissions).toBe('0700');
        });

        it('should handle partial nested config', () => {
            const config: Partial<FormatConfig> = {
                sqlite: {
                    walMode: false,
                    // extension not specified - should use default
                },
            };
            
            const result = mergeFormatConfig(config);
            
            expect(result.sqlite.walMode).toBe(false);
            expect(result.sqlite.extension).toBe('.plan'); // default
        });
    });
});
