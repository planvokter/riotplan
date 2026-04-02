/**
 * Storage utility functions
 * 
 * Provides utilities for format detection, path handling, and storage operations.
 */

import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StorageFormat } from '../types.js';
import type { FormatConfig } from '../config.js';
import { DEFAULT_FORMAT_CONFIG } from '../config.js';

/**
 * SQLite file header magic bytes
 * SQLite databases start with "SQLite format 3\0"
 */
const SQLITE_HEADER = Buffer.from('SQLite format 3\0');

/**
 * Known plan file markers for directory format
 */
const DIRECTORY_PLAN_MARKERS = [
    'SUMMARY.md',
    'STATUS.md',
    'IDEA.md',
    'EXECUTION_PLAN.md',
];

/**
 * Detect the format of a plan at the given path
 * 
 * @param planPath - Path to check
 * @returns The detected format or 'unknown' if not a valid plan
 */
export function detectPlanFormat(planPath: string): StorageFormat | 'unknown' {
    if (!existsSync(planPath)) {
        return 'unknown';
    }

    const stats = statSync(planPath);

    if (stats.isDirectory()) {
        // Check if directory contains plan files
        for (const marker of DIRECTORY_PLAN_MARKERS) {
            if (existsSync(join(planPath, marker))) {
                return 'directory';
            }
        }
        // Also check for plan/ subdirectory with step files
        const planDir = join(planPath, 'plan');
        if (existsSync(planDir) && statSync(planDir).isDirectory()) {
            return 'directory';
        }
        return 'unknown';
    }

    if (stats.isFile()) {
        // Check for SQLite header
        if (hasSqliteHeader(planPath)) {
            return 'sqlite';
        }
        // Check file extension
        if (planPath.endsWith('.plan')) {
            // File has .plan extension but isn't SQLite - might be empty or corrupted
            return 'unknown';
        }
    }

    return 'unknown';
}

/**
 * Check if a file has a valid SQLite header
 * 
 * @param filePath - Path to the file
 * @returns True if the file starts with SQLite magic bytes
 */
export function hasSqliteHeader(filePath: string): boolean {
    try {
        const fd = readFileSync(filePath, { flag: 'r' });
        if (fd.length < SQLITE_HEADER.length) {
            return false;
        }
        return fd.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER);
    } catch {
        return false;
    }
}

/**
 * Check if a path looks like it should be a SQLite plan file
 * 
 * @param planPath - Path to check
 * @param config - Optional format configuration
 * @returns True if the path has a SQLite plan extension
 */
export function isSqlitePath(planPath: string, config?: FormatConfig): boolean {
    const extension: string = config?.sqlite?.extension ?? DEFAULT_FORMAT_CONFIG.sqlite.extension;
    return planPath.endsWith(extension);
}

/**
 * Check if a path looks like it should be a directory plan
 * 
 * @param planPath - Path to check
 * @returns True if the path exists and is a directory, or doesn't have a file extension
 */
export function isDirectoryPath(planPath: string): boolean {
    if (existsSync(planPath)) {
        return statSync(planPath).isDirectory();
    }
    // If path doesn't exist, check if it has a file extension
    const ext = extname(planPath);
    return ext === '' || ext === '.';
}

/**
 * Get the appropriate file extension for a format
 * 
 * @param format - The storage format
 * @param config - Optional format configuration
 * @returns The file extension (empty string for directory format)
 */
export function getFormatExtension(format: StorageFormat, config?: FormatConfig): string {
    if (format === 'sqlite') {
        const extension: string = config?.sqlite?.extension ?? DEFAULT_FORMAT_CONFIG.sqlite.extension;
        return extension;
    }
    return ''; // directories don't have extensions
}

/**
 * Ensure a path has the correct extension for the format
 * 
 * @param planPath - The plan path
 * @param format - The storage format
 * @param config - Optional format configuration
 * @returns The path with the correct extension
 */
export function ensureFormatExtension(
    planPath: string,
    format: StorageFormat,
    config?: FormatConfig
): string {
    if (format === 'sqlite') {
        const extension = getFormatExtension(format, config);
        if (!planPath.endsWith(extension)) {
            return `${planPath}${extension}`;
        }
    }
    return planPath;
}

/**
 * Infer the format from a path based on extension and existence
 * 
 * @param planPath - The plan path
 * @param config - Optional format configuration
 * @returns The inferred format
 */
export function inferFormatFromPath(planPath: string, config?: FormatConfig): StorageFormat {
    // First check if it exists and detect actual format
    if (existsSync(planPath)) {
        const detected = detectPlanFormat(planPath);
        if (detected !== 'unknown') {
            return detected;
        }
    }

    // Infer from path characteristics
    if (isSqlitePath(planPath, config)) {
        return 'sqlite';
    }

    if (isDirectoryPath(planPath)) {
        return 'directory';
    }

    // Default to config preference
    return config?.defaultFormat ?? DEFAULT_FORMAT_CONFIG.defaultFormat;
}

/**
 * Validate that a plan path is valid for the given format
 * 
 * @param planPath - The plan path
 * @param format - The expected format
 * @param config - Optional format configuration
 * @returns An error message if invalid, or null if valid
 */
export function validatePlanPath(
    planPath: string,
    format: StorageFormat,
    config?: FormatConfig
): string | null {
    if (!planPath || planPath.trim() === '') {
        return 'Plan path cannot be empty';
    }

    if (format === 'sqlite') {
        const extension = getFormatExtension(format, config);
        if (!planPath.endsWith(extension)) {
            return `SQLite plan path must end with ${extension}`;
        }
    }

    if (format === 'directory') {
        const ext = extname(planPath);
        if (ext && ext !== '.') {
            return `Directory plan path should not have a file extension (got ${ext})`;
        }
    }

    return null;
}

/**
 * Get plan name from path
 * 
 * @param planPath - The plan path
 * @param format - The storage format
 * @param config - Optional format configuration
 * @returns The plan name extracted from the path
 */
export function getPlanNameFromPath(
    planPath: string,
    format: StorageFormat,
    config?: FormatConfig
): string {
    // Remove extension if present
    let name = planPath;
    
    if (format === 'sqlite') {
        const extension = getFormatExtension(format, config);
        if (name.endsWith(extension)) {
            name = name.slice(0, -extension.length);
        }
    }

    // Get the last path component
    const parts = name.split(/[/\\]/);
    return parts[parts.length - 1] || name;
}

/**
 * Generate a new plan UUID
 * 
 * @returns A new UUID v4 string
 */
export function generatePlanUuid(): string {
    return randomUUID();
}

/**
 * Abbreviate a UUID to its first 8 characters
 * 
 * @param uuid - The full UUID
 * @returns The first 8 characters of the UUID
 */
export function abbreviateUuid(uuid: string): string {
    return uuid.substring(0, 8);
}

/**
 * Format a plan filename using UUID abbreviation and slug
 * 
 * @param uuid - The plan UUID
 * @param slug - The plan slug (code)
 * @returns Formatted filename: {uuid-abbrev}-{slug}.plan
 */
export function formatPlanFilename(uuid: string, slug: string): string {
    return `${abbreviateUuid(uuid)}-${slug}.plan`;
}
