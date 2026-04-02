/**
 * Switch Plan Tool - Change the current working plan context
 * 
 * This tool allows the LLM to switch between different plans during a conversation.
 * It updates the working directory context so subsequent tool calls operate on the new plan.
 */

import { z } from 'zod';
import { resolve, join, basename, dirname, sep } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { mkdir, rename, access, unlink } from 'node:fs/promises';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { createSqliteProvider } from '@planvokter/riotplan-format';
import { executeCreate } from './create.js';
import { assertNoClientDirectoryOverride } from './shared.js';
import { getPlanCategory, type PlanCategory } from '@planvokter/riotplan';
import {
    getProjectMatchKeys,
    getWorkspaceMatchKeys,
    type ProjectBinding,
} from './project-binding-shared.js';
import { listPlansViaIndex } from './plan-index-service.js';

// Schema for switch plan
export const SwitchPlanSchema = z.object({
    planId: z.string().describe("Plan identifier to switch to (from riotplan_list_plans)"),
}).strict();

/**
 * Find all .plan (SQLite) files recursively in a directory
 */
function findAllPlanFiles(dir: string): string[] {
    const planFiles: string[] = [];
    function scan(d: string): void {
        try {
            for (const entry of readdirSync(d)) {
                const fullPath = join(d, entry);
                try {
                    const s = statSync(fullPath);
                    if (s.isDirectory() && !entry.startsWith('.')) {
                        scan(fullPath);
                    } else if (entry.endsWith('.plan')) {
                        planFiles.push(fullPath);
                    }
                } catch {
                    /* skip */
                }
            }
        } catch {
            /* skip */
        }
    }
    scan(dir);
    return planFiles;
}

/**
 * Resolve a plan reference to an absolute path
 */
async function resolvePlanPath(planId: string, context: ToolExecutionContext): Promise<string | null> {
    // Allow explicit absolute sqlite paths from older clients.
    if (planId.startsWith('/') && planId.endsWith('.plan')) {
        try {
            const s = statSync(planId);
            if (s.isFile()) {
                return planId;
            }
        } catch {
            return null;
        }
    }

    const basePaths = [resolve(context.workingDirectory)];

    const normalizedPlanId = planId.trim().toLowerCase();
    for (const basePath of basePaths) {
        const planFiles = findAllPlanFiles(basePath);
        for (const planFile of planFiles) {
            try {
                const provider = createSqliteProvider(planFile);
                const exists = await provider.exists();
                if (!exists) {
                    await provider.close();
                    continue;
                }

                const metaResult = await provider.getMetadata();
                await provider.close();
                if (!metaResult.success || !metaResult.data) {
                    continue;
                }

                const matchesId = (metaResult.data.id || '').toLowerCase() === normalizedPlanId;
                const matchesUuid = (metaResult.data.uuid || '').toLowerCase() === normalizedPlanId;
                const matchesFilename = basename(planFile, '.plan').toLowerCase() === normalizedPlanId;
                if (matchesId || matchesUuid || matchesFilename) {
                    return planFile;
                }
            } catch {
                // skip unreadable sqlite plans
            }
        }
    }

    return null;
}

/**
 * Execute the switch plan tool
 */
async function executeSwitchPlan(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const validated = SwitchPlanSchema.parse(args);
        
        // Resolve the plan path
        const planPath = await resolvePlanPath(validated.planId, context);
        
        if (!planPath) {
            return {
                success: false,
                error: `Could not find plan: ${validated.planId}. Use riotplan_list_plans to discover available plan identifiers.`,
            };
        }
        
        // Update the context to the new plan
        if (context.updateContext) {
            context.updateContext({ workingDirectory: planPath });
        } else {
            return {
                success: false,
                error: 'Context update not available. This tool requires a dynamic context.',
            };
        }
        
        const planName = basename(planPath);
        
        return {
            success: true,
            data: {
                message: `✅ Switched to plan: ${planName}`,
                planId: planName,
                planName,
            },
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * List available plans in the current context
 */
export const ListPlansSchema = z.object({
    filter: z
        .enum(['all', 'active', 'done', 'hold'])
        .optional()
        .describe('Optional category filter'),
    projectId: z
        .string()
        .optional()
        .describe('Optional project filter (matches project.id, owner/repo, or provider:owner/repo)'),
    workspaceId: z
        .string()
        .optional()
        .describe('Optional workspace filter (matches project.workspace.id)'),
}).strict();

function toIsoTimestamp(value: unknown): string | undefined {
    if (!value) {
        return undefined;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }
    return undefined;
}

async function executeListPlans(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        assertNoClientDirectoryOverride(args, context, 'riotplan_list_plans');
        const validated = ListPlansSchema.parse(args);
        const searchDir = context.workingDirectory;
        
        const plans: Array<{
            id: string;
            name: string;
            path: string;
            type: string;
            uuid?: string;
            title?: string;
            stage?: string;
            createdAt?: string;
            updatedAt?: string;
            category: PlanCategory;
            project?: ProjectBinding | null;
            projectSource?: 'explicit' | 'inferred' | 'none';
        }> = [];

        const indexedPlans = await listPlansViaIndex(searchDir);
        for (const plan of indexedPlans) {
            if (validated.filter && validated.filter !== 'all' && validated.filter !== plan.category) {
                continue;
            }
            plans.push({
                id: plan.id || basename(plan.path, '.plan'),
                name: plan.name || basename(plan.path, '.plan'),
                path: plan.path,
                type: 'sqlite',
                uuid: plan.uuid,
                title: plan.title,
                stage: plan.stage,
                createdAt: toIsoTimestamp(plan.createdAt),
                updatedAt: toIsoTimestamp(plan.updatedAt),
                category: plan.category,
                project: plan.project || null,
                projectSource: plan.projectSource || 'none',
            });
        }

        // De-duplicate by plan id.
        const dedupedById = new Map<string, typeof plans[number]>();
        for (const plan of plans) {
            if (!dedupedById.has(plan.id)) {
                dedupedById.set(plan.id, plan);
            }
        }

        const filteredPlans = [...dedupedById.values()].filter((plan) => {
            if (validated.projectId) {
                const projectMatchKeys = getProjectMatchKeys(plan.project);
                if (!projectMatchKeys.includes(validated.projectId.toLowerCase())) {
                    return false;
                }
            }
            if (validated.workspaceId) {
                const workspaceMatchKeys = getWorkspaceMatchKeys(plan.project);
                if (!workspaceMatchKeys.includes(validated.workspaceId.toLowerCase())) {
                    return false;
                }
            }
            return true;
        });

        if (filteredPlans.length === 0) {
            return {
                success: true,
                data: {
                    message: validated.projectId
                        ? `No plans found for project '${validated.projectId}'.`
                        : 'No plans found in the current context.',
                    plans: [],
                },
            };
        }
        
        const planList = filteredPlans.map(p => {
            const displayName = p.title || p.name || p.id;
            const stage = p.stage ? ` (${p.stage})` : '';
            return `- ${displayName}${stage} [id: ${p.id}]`;
        }).join('\n');
        
        return {
            success: true,
            data: {
                message: `Found ${filteredPlans.length} plan(s):\n${planList}`,
                plans: filteredPlans.map(({ id, name, path, type, uuid, title, stage, createdAt, updatedAt, category, project, projectSource }) => ({
                    id,
                    planId: id,
                    name,
                    path,
                    type,
                    uuid,
                    title,
                    stage,
                    createdAt,
                    updatedAt,
                    category,
                    project,
                    projectSource,
                })),
                filter: {
                    ...(validated.projectId ? { projectId: validated.projectId } : {}),
                    ...(validated.workspaceId ? { workspaceId: validated.workspaceId } : {}),
                    ...(validated.filter ? { category: validated.filter } : {}),
                },
            },
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export const MovePlanSchema = z.object({
    planId: z.string().describe('Plan identifier to move (id, uuid, filename, or absolute .plan path)'),
    target: z.enum(['active', 'done', 'hold']).describe('Target category'),
}).strict();

export const RenamePlanSchema = z.object({
    planId: z.string().describe('Plan identifier to rename (id, uuid, filename, or absolute .plan path)'),
    name: z.string().min(1).max(120).describe('New human-readable plan name'),
}).strict();

function resolveDestinationDir(sourcePath: string, target: PlanCategory): string {
    const sourceDir = dirname(sourcePath);
    const parts = sourceDir.split(sep);
    const lowered = parts.map((segment) => segment.toLowerCase());
    const categoryIndex = lowered.findIndex((segment) => segment === 'done' || segment === 'hold');

    if (target === 'active') {
        if (categoryIndex >= 0) {
            const prefix = parts.slice(0, categoryIndex).join(sep) || sep;
            if (basename(prefix).toLowerCase() === 'plans') {
                return prefix;
            }
            const siblingPlans = join(prefix, 'plans');
            try {
                if (statSync(siblingPlans).isDirectory()) {
                    return siblingPlans;
                }
            } catch {
                // fall through
            }
            return prefix;
        }
        return sourceDir;
    }

    if (categoryIndex >= 0) {
        const root = parts.slice(0, categoryIndex).join(sep) || sep;
        return join(root, target);
    }

    const plansIndex = lowered.lastIndexOf('plans');
    if (plansIndex >= 0) {
        const plansRoot = parts.slice(0, plansIndex + 1).join(sep) || sep;
        return join(plansRoot, target);
    }

    return join(sourceDir, target);
}

async function pathExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function uniqueDestinationPath(destinationDir: string, sourcePath: string): Promise<string> {
    const ext = '.plan';
    const base = basename(sourcePath, ext);
    let candidate = join(destinationDir, `${base}${ext}`);
    let suffix = 1;
    while (await pathExists(candidate)) {
        candidate = join(destinationDir, `${base}-${suffix}${ext}`);
        suffix += 1;
    }
    return candidate;
}

async function executeMovePlan(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = MovePlanSchema.parse(args);
        const sourcePath = await resolvePlanPath(validated.planId, context);
        if (!sourcePath) {
            return {
                success: false,
                error: `Could not find plan: ${validated.planId}. Use riotplan_list_plans to discover available plan identifiers.`,
            };
        }

        const currentCategory = getPlanCategory(sourcePath);
        if (currentCategory === validated.target) {
            return {
                success: true,
                data: {
                    moved: false,
                    category: currentCategory,
                    path: sourcePath,
                },
                message: `Plan is already in ${validated.target}.`,
            };
        }

        const destinationDir = resolveDestinationDir(sourcePath, validated.target);
        await mkdir(destinationDir, { recursive: true });
        const destinationPath = await uniqueDestinationPath(destinationDir, sourcePath);
        await rename(sourcePath, destinationPath);

        // Resolve canonical plan id from moved file metadata when possible.
        let canonicalPlanId = validated.planId;
        try {
            const provider = createSqliteProvider(destinationPath);
            const metaResult = await provider.getMetadata();
            await provider.close();
            if (metaResult.success && metaResult.data?.id) {
                canonicalPlanId = metaResult.data.id;
            }
        } catch {
            // best-effort only
        }

        return {
            success: true,
            data: {
                moved: true,
                planId: canonicalPlanId,
                sourcePath,
                destinationPath,
                category: validated.target,
            },
            message: `Moved plan to ${validated.target}.`,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

async function executeRenamePlan(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = RenamePlanSchema.parse(args);
        const sourcePath = await resolvePlanPath(validated.planId, context);
        if (!sourcePath) {
            return {
                success: false,
                error: `Could not find plan: ${validated.planId}. Use riotplan_list_plans to discover available plan identifiers.`,
            };
        }

        const trimmedName = validated.name.trim();
        if (!trimmedName) {
            return {
                success: false,
                error: 'Plan name cannot be empty.',
            };
        }

        const provider = createSqliteProvider(sourcePath);
        try {
            const metadataResult = await provider.getMetadata();
            if (!metadataResult.success || !metadataResult.data) {
                return {
                    success: false,
                    error: metadataResult.error || 'Failed to read plan metadata.',
                };
            }
            const oldName = metadataResult.data.name || metadataResult.data.id;
            if (oldName === trimmedName) {
                return {
                    success: true,
                    data: {
                        renamed: false,
                        planId: metadataResult.data.id,
                        name: oldName,
                    },
                    message: 'Plan name is unchanged.',
                };
            }

            const updateResult = await provider.updateMetadata({ name: trimmedName });
            if (!updateResult.success) {
                return {
                    success: false,
                    error: updateResult.error || 'Failed to update plan name.',
                };
            }

            return {
                success: true,
                data: {
                    renamed: true,
                    planId: metadataResult.data.id,
                    oldName,
                    name: trimmedName,
                    path: sourcePath,
                },
                message: `Renamed plan to "${trimmedName}".`,
            };
        } finally {
            await provider.close();
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export const DeletePlanSchema = z.object({
    planId: z.string().describe('Plan identifier to delete (id, uuid, filename, or absolute .plan path)'),
    confirm: z.boolean().optional().describe('Must be true to confirm deletion'),
}).strict();

async function executeDeletePlan(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = DeletePlanSchema.parse(args);
        const sourcePath = await resolvePlanPath(validated.planId, context);
        if (!sourcePath) {
            return {
                success: false,
                error: `Could not find plan: ${validated.planId}. Use riotplan_list_plans to discover available plan identifiers.`,
            };
        }

        let planId = validated.planId;
        let planName: string | undefined;
        try {
            const provider = createSqliteProvider(sourcePath);
            const metaResult = await provider.getMetadata();
            await provider.close();
            if (metaResult.success && metaResult.data) {
                planId = metaResult.data.id || planId;
                planName = metaResult.data.name || undefined;
            }
        } catch {
            // best-effort metadata read
        }

        await unlink(sourcePath);

        return {
            success: true,
            data: {
                deleted: true,
                planId,
                name: planName,
                path: sourcePath,
            },
            message: `Permanently deleted plan "${planName || planId}".`,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Tool definitions
export const switchPlanTool: McpTool = {
    name: 'riotplan_switch_plan',
    description: 'Switch to a different plan. Use this when the user wants to talk about or work on a different plan. Updates the working context so subsequent tool calls operate on the new plan.',
    schema: SwitchPlanSchema.shape,
    execute: executeSwitchPlan,
};

export const listPlansTool: McpTool = {
    name: 'riotplan_list_plans',
    description: 'List available plans in the current context. Use this to discover what plans exist before switching.',
    schema: ListPlansSchema.shape,
    execute: executeListPlans,
};

export const movePlanTool: McpTool = {
    name: 'riotplan_move_plan',
    description: 'Move a plan between active, done, and hold categories by relocating the underlying .plan file.',
    schema: MovePlanSchema.shape,
    execute: executeMovePlan,
};

export const deletePlanTool: McpTool = {
    name: 'riotplan_delete_plan',
    description: 'Permanently delete a plan by removing the underlying .plan file from the filesystem.',
    schema: DeletePlanSchema.shape,
    execute: executeDeletePlan,
};

const PlanActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('create'),
        code: z.string(),
        name: z.string().optional(),
        description: z.string(),
        steps: z.number().optional(),
        direct: z.boolean().optional(),
        provider: z.string().optional(),
        model: z.string().optional(),
        noAi: z.boolean().optional(),
        catalysts: z.array(z.string()).optional(),
        ideaContent: z.string().optional(),
        idea: z.string().optional(),
        motivation: z.string().optional(),
    }).strict(),
    z.object({
        action: z.literal('switch'),
        planId: z.string(),
    }).strict(),
    z.object({
        action: z.literal('move'),
        planId: z.string(),
        target: z.enum(['active', 'done', 'hold']),
    }).strict(),
    z.object({
        action: z.literal('rename'),
        planId: z.string(),
        name: z.string().min(1).max(120),
    }).strict(),
    z.object({
        action: z.literal('delete'),
        planId: z.string(),
        confirm: z.boolean().optional(),
    }).strict(),
]);

const PlanToolSchema = {
    action: z.enum(['create', 'switch', 'move', 'rename', 'delete']).describe('Plan management action to perform'),
    planId: z.string().optional().describe('Plan identifier for action=switch|move|rename|delete'),
    target: z.enum(['active', 'done', 'hold']).optional().describe('Target category for action=move'),
    name: z.string().optional().describe('Plan display name when action=create|rename'),
    confirm: z.boolean().optional().describe('Confirm permanent deletion when action=delete'),
    code: z.string().optional().describe('Plan code when action=create'),
    description: z.string().optional().describe('Plan description when action=create'),
    steps: z.number().optional().describe('Initial step count when action=create'),
    direct: z.boolean().optional().describe('Forwarded create option'),
    provider: z.string().optional().describe('Forwarded create option'),
    model: z.string().optional().describe('Forwarded create option'),
    noAi: z.boolean().optional().describe('Forwarded create option'),
    catalysts: z.array(z.string()).optional().describe('Catalysts for action=create'),
    ideaContent: z.string().optional().describe('Optional initial idea/motivation content'),
    idea: z.string().optional().describe('Alias for ideaContent'),
    motivation: z.string().optional().describe('Alias for ideaContent'),
} satisfies z.ZodRawShape;

async function executePlan(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        assertNoClientDirectoryOverride(args, context, 'riotplan_plan');
        const validated = PlanActionSchema.parse(args);
        const stripAction = <T extends { action: string }>(value: T): Omit<T, 'action'> => {
            const copy = { ...value };
            delete (copy as { action?: string }).action;
            return copy;
        };
        switch (validated.action) {
            case 'create': {
                const createArgs = stripAction(validated);
                return executeCreate(createArgs, context, 'riotplan_plan');
            }
            case 'switch': {
                const switchArgs = stripAction(validated);
                return executeSwitchPlan(switchArgs, context);
            }
            case 'move': {
                const moveArgs = stripAction(validated);
                return executeMovePlan(moveArgs, context);
            }
            case 'rename': {
                const renameArgs = stripAction(validated);
                return executeRenamePlan(renameArgs, context);
            }
            case 'delete': {
                const deleteArgs = stripAction(validated);
                return executeDeletePlan(deleteArgs, context);
            }
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export const planTool: McpTool = {
    name: 'riotplan_plan',
    description: 'Manage plans with action=create|switch|move|rename|delete.',
    schema: PlanToolSchema,
    execute: executePlan,
};
