/**
 * @planvokter/riotplan-format
 * 
 * SQLite-based storage format for RiotPlan with dual format support.
 * 
 * This package provides a storage abstraction layer that supports both
 * directory-based and SQLite .plan formats for RiotPlan plans.
 * 
 * @packageDocumentation
 */

// Export all types
export * from './types.js';

// Export configuration types and utilities
export * from './config.js';

// Export storage provider interface and types
export * from './storage/index.js';

// Export migration utilities
export * from './migration/index.js';

// Export renderer utilities
export * from './renderer/index.js';

/**
 * Package version
 */
export const VERSION = '1.0.0-dev.0';

/**
 * Current SQLite schema version
 */
export const SCHEMA_VERSION = 1;

/**
 * File extension for SQLite plan files
 */
export const PLAN_FILE_EXTENSION = '.plan';
