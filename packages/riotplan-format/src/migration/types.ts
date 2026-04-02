/**
 * Migration types
 * 
 * Types for plan format migration operations.
 */

import type { StorageFormat } from '../types.js';

/**
 * Options for migration operations
 */
export interface MigrationOptions {
    /** Overwrite destination if it exists */
    force?: boolean;
    
    /** Preserve source after migration */
    keepSource?: boolean;
    
    /** Validate data integrity after migration */
    validate?: boolean;
    
    /** Progress callback */
    onProgress?: (progress: MigrationProgress) => void;
}

/**
 * Progress information during migration
 */
export interface MigrationProgress {
    /** Current phase */
    phase: 'reading' | 'converting' | 'writing' | 'validating';
    
    /** Progress percentage (0-100) */
    percentage: number;
    
    /** Current item being processed */
    currentItem?: string;
    
    /** Total items to process */
    totalItems?: number;
    
    /** Items processed so far */
    processedItems?: number;
}

/**
 * Statistics from a migration operation
 */
export interface MigrationStats {
    /** Number of steps converted */
    stepsConverted: number;
    
    /** Number of files converted */
    filesConverted: number;
    
    /** Number of timeline events converted */
    timelineEventsConverted: number;
    
    /** Number of evidence records converted */
    evidenceConverted: number;
    
    /** Number of feedback records converted */
    feedbackConverted: number;
    
    /** Number of checkpoints converted */
    checkpointsConverted: number;
}

/**
 * Result of a migration operation
 */
export interface MigrationResult {
    /** Whether the migration succeeded */
    success: boolean;
    
    /** Source format */
    sourceFormat: StorageFormat;
    
    /** Target format */
    targetFormat: StorageFormat;
    
    /** Source path */
    sourcePath: string;
    
    /** Target path */
    targetPath: string;
    
    /** Error message if failed */
    error?: string;
    
    /** Warning messages */
    warnings: string[];
    
    /** Migration statistics */
    stats: MigrationStats;
    
    /** Duration in milliseconds */
    duration: number;
}

/**
 * Validation error during migration
 */
export interface ValidationError {
    /** Type of validation error */
    type: 'missing_step' | 'content_mismatch' | 'metadata_difference' | 'missing_file' | 'missing_event';
    
    /** Path or identifier of the problematic item */
    path: string;
    
    /** Expected value */
    expected: unknown;
    
    /** Actual value */
    actual: unknown;
    
    /** Human-readable error message */
    message: string;
}

/**
 * Result of migration validation
 */
export interface ValidationResult {
    /** Whether validation passed */
    valid: boolean;
    
    /** Validation errors */
    errors: ValidationError[];
    
    /** Warning messages */
    warnings: string[];
    
    /** Validation statistics */
    stats: {
        stepsCompared: number;
        filesCompared: number;
        timelineEventsCompared: number;
        evidenceCompared: number;
        feedbackCompared: number;
    };
}

/**
 * Options for batch migration
 */
export interface BatchMigrationOptions extends MigrationOptions {
    /** Glob pattern for source plans */
    pattern?: string;
    
    /** Maximum concurrent migrations */
    concurrency?: number;
    
    /** Continue on individual failures */
    continueOnError?: boolean;
    
    /** Target format for all migrations */
    targetFormat?: StorageFormat;
}

/**
 * Result of batch migration
 */
export interface BatchMigrationResult {
    /** Total number of plans found */
    totalPlans: number;
    
    /** Number of successful migrations */
    successful: number;
    
    /** Number of failed migrations */
    failed: number;
    
    /** Number of skipped migrations */
    skipped: number;
    
    /** Individual migration results */
    results: MigrationResult[];
    
    /** Total duration in milliseconds */
    duration: number;
}
