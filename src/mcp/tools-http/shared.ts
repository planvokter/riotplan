/**
 * Shared utilities for HTTP MCP tools
 *
 * Provides common functionality for tools that work with StorageProvider API
 */

import type { StorageProvider } from '@kjerneverk/riotplan-format';
import type { ServerConfig } from '../server-hono.js';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Context passed to HTTP MCP tools
 */
export interface HttpToolContext {
    /** Plans directory */
    plansDir: string;
    /** Session ID */
    sessionId: string;
    /** Server configuration */
    config: ServerConfig;
}

/**
 * Result of a tool execution
 */
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Find all plan files in the plans directory
 */
export function findAllPlanFiles(plansDir: string): string[] {
    const planFiles: string[] = [];

    function scanDirectory(dir: string): void {
        try {
            const entries = readdirSync(dir);

            for (const entry of entries) {
                const fullPath = join(dir, entry);
                const stat = statSync(fullPath);

                if (stat.isDirectory()) {
                    // Recursively scan subdirectories
                    scanDirectory(fullPath);
                } else if (entry.endsWith('.plan')) {
                    planFiles.push(fullPath);
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
    }

    scanDirectory(plansDir);
    return planFiles;
}

/**
 * Find a plan file by UUID or abbreviation
 */
export function findPlanByUuid(
    plansDir: string,
    uuidOrAbbrev: string
): string | null {
    const planFiles = findAllPlanFiles(plansDir);
    const searchTerm = uuidOrAbbrev.toLowerCase();

    // Try exact UUID match first
    for (const file of planFiles) {
        if (file.toLowerCase().includes(searchTerm)) {
            return file;
        }
    }

    return null;
}

/**
 * Calculate progress from steps
 */
export function calculateProgress(steps: any[]): {
    completed: number;
    total: number;
    percentage: number;
} {
    const total = steps.length;
    const completed = steps.filter(
        (s) => s.status === 'completed' || s.status === 'skipped'
    ).length;

    return {
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
}

/**
 * Derive overall status from steps
 */
export function deriveOverallStatus(steps: any[]): string {
    if (steps.length === 0) {
        return 'pending';
    }

    const hasInProgress = steps.some((s) => s.status === 'in_progress');
    if (hasInProgress) {
        return 'in_progress';
    }

    const allCompleted = steps.every(
        (s) => s.status === 'completed' || s.status === 'skipped'
    );
    if (allCompleted) {
        return 'completed';
    }

    return 'pending';
}
