/**
 * Shared utilities for MCP tools
 */

import { resolve, join, basename, relative, isAbsolute, dirname } from 'node:path';
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import type { ToolResult, ToolExecutionContext } from '../types.js';

const CLIENT_DIRECTORY_OVERRIDE_KEYS = ['directory', 'path', 'root', 'planDirectory'] as const;
const CLIENT_DIRECTORY_OVERRIDE_ERROR = 'E_INVALID_ARGUMENT: directory is server-managed and cannot be provided by client';

function toCanonicalPath(path: string): string {
    const resolved = resolve(path);
    try {
        return realpathSync(resolved);
    } catch {
        return resolved;
    }
}

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
 * Path is always resolved relative to workingDirectory when both are present.
 *
 * @param args - Tool arguments, may contain explicit `path` parameter
 * @param context - Tool execution context with workingDirectory
 * @returns Resolved absolute path to the directory
 */
function findPlanById(baseDir: string, planId: string, maxDepth = 4): string | null {
    const root = resolve(baseDir);
    const normalized = planId.trim();
    if (!normalized) return null;
    const normalizedLower = normalized.toLowerCase();

    if (normalized.startsWith('/') && normalized.endsWith('.plan')) {
        if (existsSync(normalized)) {
            try {
                const stats = statSync(normalized);
                if (stats.isFile()) {
                    return normalized;
                }
            } catch {
                // ignore unreadable path
            }
        }
    }

    const directCandidates = [
        resolve(root, `${normalized}.plan`),
        resolve(root, normalized),
        resolve(root, 'plans', normalized),
        resolve(root, 'done', normalized),
        resolve(root, 'hold', normalized),
    ];

    for (const candidate of directCandidates) {
        if (existsSync(candidate)) {
            try {
                const stats = statSync(candidate);
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
                const lowerName = name.toLowerCase();
                if (
                    lowerName === normalizedLower ||
                    lowerName.startsWith(`${normalizedLower}-`) ||
                    lowerName.endsWith(`-${normalizedLower}`)
                ) {
                    return fullPath;
                }
            }

            if (stats.isDirectory()) {
                const nested = walk(fullPath, depth + 1);
                if (nested) return nested;
            }
        }
        return null;
    }

    return walk(root, 0);
}

export function resolveDirectory(args: any, context: ToolExecutionContext): string {
    const rawBase = context.workingDirectory || process.cwd();
    const logicalBase = rawBase.endsWith('.plan') ? dirname(rawBase) : rawBase;
    const base = toCanonicalPath(logicalBase);
    if (args.planId) {
        const resolvedById = findPlanById(base, String(args.planId));
        if (!resolvedById) {
            throw new Error(`Plan not found for planId: ${args.planId}`);
        }
        const planPath = toCanonicalPath(resolvedById);
        const rel = relative(base, planPath);
        const withinBase = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
        if (!withinBase) {
            throw new Error(`Plan not found for planId: ${args.planId}`);
        }
        return planPath;
    }
    return base;
}

export function resolveSqlitePlanPath(args: any, context: ToolExecutionContext): string {
    const resolvedPath = resolveDirectory(args, context);
    if (!resolvedPath.endsWith('.plan')) {
        throw new Error(
            'Directory-based plans are no longer supported. Use a SQLite .plan identifier/path.'
        );
    }
    return resolvedPath;
}

export function assertNoClientDirectoryOverride(
    args: unknown,
    context: ToolExecutionContext,
    toolName: string
): void {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
        return;
    }

    const record = args as Record<string, unknown>;
    const blockedKey = CLIENT_DIRECTORY_OVERRIDE_KEYS.find((key) =>
        Object.prototype.hasOwnProperty.call(record, key)
    );

    if (!blockedKey) {
        return;
    }

    const metadata = {
        code: 'E_INVALID_ARGUMENT',
        tool: toolName,
        argument: blockedKey,
    };
    if (context.logger && typeof context.logger.warn === 'function') {
        context.logger.warn('mcp.directory_override_blocked', metadata);
    }

    throw new Error(CLIENT_DIRECTORY_OVERRIDE_ERROR);
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
        const { readPlanManifest, writePlanManifest } = await import('@planvokter/riotplan-catalyst');
        
        const existing = await readPlanManifest(planPath);
        if (existing) {
            return false;
        }
        
        const planDirName = basename(planPath);
        const id = options?.id || planDirName;
        const title = options?.title || planDirName.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        await writePlanManifest(planPath, {
            id,
            title,
            catalysts: options?.catalysts,
            created: new Date().toISOString(),
        });
        
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if a plan is in idea or shaping stage (SQLite .plan files only)
 */
export async function isIdeaOrShapingDirectory(path: string): Promise<{
    isIdeaOrShaping: boolean;
    detected: string[];
    stage?: string;
}> {
    try {
        const { createSqliteProvider } = await import('@planvokter/riotplan-format');
        const provider = createSqliteProvider(path);
        const metadataResult = await provider.getMetadata();
        const stage = metadataResult.data?.stage;
        const filesResult = await provider.getFiles();
        await provider.close();

        const detected: string[] = [];
        const files = filesResult.success ? filesResult.data || [] : [];
        if (files.some((f) => f.type === 'idea')) { detected.push('IDEA.md'); }
        if (files.some((f) => f.type === 'shaping')) { detected.push('SHAPING.md'); }

        return {
            isIdeaOrShaping: (stage === 'idea' || stage === 'shaping') || (detected.length > 0 && !stage),
            detected,
            stage,
        };
    } catch {
        return { isIdeaOrShaping: false, detected: [] };
    }
}
