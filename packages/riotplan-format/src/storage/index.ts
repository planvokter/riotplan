/**
 * Storage module exports
 */

export { type StorageProvider, type SearchResult, type StorageProviderFactory, type StorageProviderFactoryFn } from './provider.js';
// StorageResult is exported from types.ts
export { SqliteStorageProvider, createSqliteProvider } from './sqlite-provider.js';
export { DirectoryStorageProvider, createDirectoryProvider } from './directory-provider.js';
export {
    DefaultStorageProviderFactory,
    createStorageFactory,
    createProvider,
    type CreateProviderOptions,
} from './factory.js';
export {
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
    formatPlanFilename,
} from './utils.js';
