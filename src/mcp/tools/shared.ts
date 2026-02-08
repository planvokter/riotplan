/**
 * Shared utilities for MCP tools
 */

import { resolve, join } from 'node:path';
import { access } from 'node:fs/promises';
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
 * 1. Explicit path parameter (args.path) - highest priority, backward compatible
 * 2. Context working directory (context.workingDirectory) - uses four-tier resolver:
 *    - Environment variable (RIOTPLAN_PLAN_DIRECTORY)
 *    - Configuration file (riotplan.config.*, .riotplan/config.*, etc.)
 *    - Walk-up detection (find existing plans/ directory)
 *    - Fallback to ./plans in current directory
 * 3. process.cwd() - final fallback
 *
 * @param args - Tool arguments, may contain explicit `path` parameter
 * @param context - Tool execution context with workingDirectory from resolver
 * @returns Resolved absolute path to the directory
 */
export function resolveDirectory(args: any, context: ToolExecutionContext): string {
    // Explicit path parameter takes highest precedence (backward compatibility)
    if (args.path) {
        return resolve(args.path);
    }
    // Use context working directory (now resolved via four-tier strategy)
    if (context.workingDirectory) {
        return context.workingDirectory;
    }
    // Final fallback to current working directory
    return process.cwd();
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
            const { readFile } = await import('node:fs/promises');
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
