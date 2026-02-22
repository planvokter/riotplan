/**
 * Shared utilities for MCP tools
 */

import { resolve, join, basename } from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import type { ToolResult, ToolExecutionContext } from '../types.js';

export function formatTimestamp(): string {
    return new Date().toISOString();
}

export function formatDate(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Resolve directory from args or context
 *
 * Resolution precedence:
 * 1. Explicit path parameter (args.path) - resolved relative to working directory
 * 2. Context working directory (context.workingDirectory)
 * 3. process.cwd() - final fallback
 *
 * Path is always resolved relative to workingDirectory when both are present,
 * ensuring consistent behavior for both stdio (config-derived) and HTTP (plansDir-configured) modes.
 *
 * @param args - Tool arguments, may contain explicit `path` parameter
 * @param context - Tool execution context with workingDirectory
 * @returns Resolved absolute path to the directory
 */
function isPlanDirectorySync(dirPath: string): boolean {
    try {
        const entries = readdirSync(dirPath);
        return (
            entries.includes('LIFECYCLE.md') ||
            entries.includes('STATUS.md') ||
            entries.includes('IDEA.md') ||
            entries.includes('plan.yaml') ||
            entries.includes('plan')
        );
    } catch {
        return false;
    }
}

function findPlanById(baseDir: string, planId: string, maxDepth = 4): string | null {
    const normalized = planId.trim();
    if (!normalized) return null;

    const directCandidates = [
        resolve(baseDir, normalized),
        resolve(baseDir, 'plans', normalized),
        resolve(baseDir, 'done', normalized),
        resolve(baseDir, 'hold', normalized),
        resolve(baseDir, `${normalized}.plan`),
    ];

    for (const candidate of directCandidates) {
        if (existsSync(candidate)) {
            try {
                const stats = statSync(candidate);
                if (stats.isDirectory() && isPlanDirectorySync(candidate)) {
                    return candidate;
                }
                if (stats.isFile() && candidate.endsWith('.plan')) {
                    return candidate;
                }
            } catch {
                // ignore unreadable candidate
            }
        }
    }

    function walk(dir: string, depth: number): string | null {
        if (depth > maxDepth) return null;
        let entries: string[] = [];
        try {
            entries = readdirSync(dir);
        } catch {
            return null;
        }

        for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            const fullPath = join(dir, entry);
            let stats;
            try {
                stats = statSync(fullPath);
            } catch {
                continue;
            }

            if (stats.isFile() && entry.endsWith('.plan')) {
                const name = basename(entry, '.plan');
                if (name === normalized || name.startsWith(`${normalized}-`) || name.endsWith(`-${normalized}`)) {
                    return fullPath;
                }
            }

            if (stats.isDirectory()) {
                if (entry === normalized && isPlanDirectorySync(fullPath)) {
                    return fullPath;
                }
                const nested = walk(fullPath, depth + 1);
                if (nested) return nested;
            }
        }
        return null;
    }

    return walk(baseDir, 0);
}

export function resolveDirectory(args: any, context: ToolExecutionContext): string {
    const base = context.workingDirectory || process.cwd();
    if (args.planId) {
        const resolvedById = findPlanById(base, String(args.planId));
        if (!resolvedById) {
            throw new Error(`Plan not found for planId: ${args.planId}`);
        }
        return resolvedById;
    }
    // Legacy fallback; kept for backward compatibility.
    if (args.path) {
        return resolve(base, args.path);
    }
    return base;
}

/**
 * Format error as ToolResult
 */
export function formatError(error: unknown): ToolResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
        success: false,
        error: message,
    };
}

/**
 * Create success ToolResult
 */
export function createSuccess(data: any, message?: string): ToolResult {
    return {
        success: true,
        data,
        message,
    };
}

/**
 * Check if a directory is an idea or shaping directory
 * 
 * @param path - Path to check
 * @returns Object with detection result and details
 */
export async function isIdeaOrShapingDirectory(path: string): Promise<{
    isIdeaOrShaping: boolean;
    detected: string[];
    stage?: string;
}> {
    const detected: string[] = [];
    let stage: string | undefined;

    // Check for IDEA.md
    try {
        await access(join(path, 'IDEA.md'));
        detected.push('IDEA.md');
    } catch {
        // File doesn't exist
    }

    // Check for SHAPING.md
    try {
        await access(join(path, 'SHAPING.md'));
        detected.push('SHAPING.md');
    } catch {
        // File doesn't exist
    }

    // Check for LIFECYCLE.md and extract stage
    try {
        await access(join(path, 'LIFECYCLE.md'));
        detected.push('LIFECYCLE.md');
        
        // Try to read and extract stage
        try {
            const content = await readFile(join(path, 'LIFECYCLE.md'), 'utf-8');
            const stageMatch = content.match(/\*\*Stage\*\*: `(\w+)`/);
            if (stageMatch) {
                stage = stageMatch[1];
            }
        } catch {
            // Couldn't read file
        }
    } catch {
        // File doesn't exist
    }

    return {
        isIdeaOrShaping: detected.length > 0 && (stage === 'idea' || stage === 'shaping' || !stage),
        detected,
        stage,
    };
}

/**
 * Ensure a plan has a plan.yaml manifest file
 * 
 * If the manifest doesn't exist, creates it with basic plan identity.
 * If it exists, does nothing (preserves existing data).
 * 
 * @param planPath - Absolute path to plan directory
 * @param options - Optional override values for id and title
 * @returns True if manifest was created, false if it already existed
 */
export async function ensurePlanManifest(
    planPath: string,
    options?: { id?: string; title?: string; catalysts?: string[] }
): Promise<boolean> {
    try {
        // Try to import the manifest functions
        const { readPlanManifest, writePlanManifest } = await import('@kjerneverk/riotplan-catalyst');
        
        // Check if manifest already exists
        const existing = await readPlanManifest(planPath);
        if (existing) {
            return false; // Already exists, nothing to do
        }
        
        // Generate id and title from path if not provided
        const planDirName = basename(planPath);
        const id = options?.id || planDirName;
        const title = options?.title || planDirName.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        // Create minimal manifest
        await writePlanManifest(planPath, {
            id,
            title,
            catalysts: options?.catalysts,
            created: new Date().toISOString(),
        });
        
        return true; // Created new manifest
    } catch {
        // If riotplan-catalyst is not available, silently skip
        // This maintains backward compatibility
        return false;
    }
}
