/**
 * Storage Provider Factory
 * 
 * Creates storage providers based on path and configuration.
 */

import type { StorageProvider, StorageProviderFactory } from './provider.js';
import { SqliteStorageProvider } from './sqlite-provider.js';
import type { FormatConfig, ResolvedFormatConfig } from '../config.js';
import { mergeFormatConfig } from '../config.js';
import {
    detectPlanFormat,
    isSqlitePath,
    isDirectoryPath,
    ensureFormatExtension,
    inferFormatFromPath,
} from './utils.js';
import type { StorageFormat } from '../types.js';

/**
 * Options for creating a storage provider
 */
export interface CreateProviderOptions {
    /** Force a specific format instead of auto-detecting */
    format?: StorageFormat;
    /** Create the plan if it doesn't exist */
    create?: boolean;
}

/**
 * Default storage provider factory implementation
 * 
 * Creates appropriate storage providers based on path characteristics
 * and configuration preferences.
 */
export class DefaultStorageProviderFactory implements StorageProviderFactory {
    private config: ResolvedFormatConfig;

    constructor(config?: Partial<FormatConfig>) {
        this.config = mergeFormatConfig(config);
    }

    /**
     * Create a storage provider for the given path
     * 
     * @param planPath - Path to the plan
     * @param options - Optional creation options
     * @returns A storage provider instance
     */
    createProvider(planPath: string, options?: CreateProviderOptions): StorageProvider {
        const format = this.determineFormat(planPath, options?.format);
        
        if (format === 'sqlite') {
            const finalPath = ensureFormatExtension(planPath, 'sqlite', this.config);
            return new SqliteStorageProvider(finalPath);
        }
        
        // For directory format, we would return a DirectoryStorageProvider
        // This will be implemented when integrating with the main riotplan package
        throw new Error(
            'Directory storage provider is not yet implemented in riotplan-format. ' +
            'Use the main riotplan package for directory-based plans.'
        );
    }

    /**
     * Check if this factory supports the given path
     * 
     * @param planPath - Path to check
     * @returns True if a provider can be created for this path
     */
    supportsPath(planPath: string): boolean {
        const format = detectPlanFormat(planPath);
        if (format !== 'unknown') {
            return true;
        }
        
        // Check if path looks like it could be a plan
        return isSqlitePath(planPath, this.config) || isDirectoryPath(planPath);
    }

    /**
     * Determine the format to use for a path
     * 
     * @param planPath - The plan path
     * @param forcedFormat - Optional format override
     * @returns The format to use
     */
    private determineFormat(planPath: string, forcedFormat?: StorageFormat): StorageFormat {
        // If format is explicitly specified, use it
        if (forcedFormat) {
            return forcedFormat;
        }

        // Try to detect from existing plan
        const detected = detectPlanFormat(planPath);
        if (detected !== 'unknown') {
            return detected;
        }

        // Infer from path characteristics
        return inferFormatFromPath(planPath, this.config);
    }

    /**
     * Get the default format from configuration
     */
    get defaultFormat(): StorageFormat {
        return this.config.defaultFormat;
    }

    /**
     * Get the SQLite configuration
     */
    get sqliteConfig() {
        return this.config.sqlite;
    }

    /**
     * Get the directory configuration
     */
    get directoryConfig() {
        return this.config.directory;
    }
}

/**
 * Create a storage provider factory with the given configuration
 * 
 * @param config - Optional format configuration
 * @returns A storage provider factory
 */
export function createStorageFactory(config?: Partial<FormatConfig>): DefaultStorageProviderFactory {
    return new DefaultStorageProviderFactory(config);
}

/**
 * Create a storage provider for the given path using default configuration
 * 
 * This is a convenience function for simple use cases.
 * 
 * @param planPath - Path to the plan
 * @param options - Optional creation options
 * @returns A storage provider instance
 */
export function createProvider(
    planPath: string,
    options?: CreateProviderOptions & { config?: Partial<FormatConfig> }
): StorageProvider {
    const factory = createStorageFactory(options?.config);
    return factory.createProvider(planPath, options);
}
