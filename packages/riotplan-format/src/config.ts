/**
 * Configuration types for RiotPlan format selection
 * 
 * These types define the configuration options for storage format selection
 * and format-specific settings.
 */

import type { StorageFormat } from './types.js';

/**
 * Configuration options for SQLite storage
 */
export interface SqliteConfig {
    /** Enable WAL mode for better concurrency (default: true) */
    walMode?: boolean;
    
    /** SQLite pragma settings */
    pragmas?: Record<string, string | number | boolean>;
    
    /** File extension for SQLite plan files (default: '.plan') */
    extension?: string;
}

/**
 * Configuration options for directory storage
 */
export interface DirectoryConfig {
    /** Create plan subdirectory by default (default: true) */
    usePlanSubdir?: boolean;
    
    /** Default directory permissions (default: '0755') */
    permissions?: string;
}

/**
 * Format-related configuration for RiotPlan
 */
export interface FormatConfig {
    /** Default plan storage format (default: 'directory') */
    defaultFormat?: StorageFormat;
    
    /** SQLite-specific options */
    sqlite?: SqliteConfig;
    
    /** Directory-specific options */
    directory?: DirectoryConfig;
}

/**
 * Default SQLite configuration
 */
export const DEFAULT_SQLITE_CONFIG: Required<SqliteConfig> = {
    walMode: true,
    pragmas: {
        'journal_mode': 'WAL',
        'synchronous': 'NORMAL',
        'foreign_keys': true,
        'temp_store': 'memory',
    },
    extension: '.plan',
};

/**
 * Default directory configuration
 */
export const DEFAULT_DIRECTORY_CONFIG: Required<DirectoryConfig> = {
    usePlanSubdir: true,
    permissions: '0755',
};

/**
 * Resolved format configuration with all fields required
 */
export interface ResolvedFormatConfig {
    defaultFormat: StorageFormat;
    sqlite: Required<SqliteConfig>;
    directory: Required<DirectoryConfig>;
}

/**
 * Default format configuration
 */
export const DEFAULT_FORMAT_CONFIG: ResolvedFormatConfig = {
    defaultFormat: 'directory',
    sqlite: DEFAULT_SQLITE_CONFIG,
    directory: DEFAULT_DIRECTORY_CONFIG,
};

/**
 * Merge user config with defaults
 */
export function mergeFormatConfig(userConfig?: Partial<FormatConfig>): ResolvedFormatConfig {
    if (!userConfig) {
        return DEFAULT_FORMAT_CONFIG;
    }

    return {
        defaultFormat: userConfig.defaultFormat ?? DEFAULT_FORMAT_CONFIG.defaultFormat,
        sqlite: {
            ...DEFAULT_SQLITE_CONFIG,
            ...userConfig.sqlite,
            pragmas: {
                ...DEFAULT_SQLITE_CONFIG.pragmas,
                ...userConfig.sqlite?.pragmas,
            },
        },
        directory: {
            ...DEFAULT_DIRECTORY_CONFIG,
            ...userConfig.directory,
        },
    };
}
