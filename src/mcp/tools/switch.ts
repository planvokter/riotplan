/**
 * Switch Plan Tool - Change the current working plan context
 * 
 * This tool allows the LLM to switch between different plans during a conversation.
 * It updates the working directory context so subsequent tool calls operate on the new plan.
 */

import { z } from 'zod';
import { resolve, join, basename, dirname, sep } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { mkdir, rename, access } from 'node:fs/promises';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { executeCreate } from './create.js';
import {
    getProjectMatchKeys,
    inferProjectBindingFromPath,
    readProjectBinding,
    type ProjectBinding,
} from './project-binding-shared.js';

type PlanCategory = 'active' | 'done' | 'hold';

// Schema for switch plan
export const SwitchPlanSchema = z.object({
    planId: z.string().describe("Plan identifier to switch to (from riotplan_list_plans)"),
});

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
 * Find legacy directory-based plans recursively.
 * A directory is considered a legacy plan when it contains STATUS.md.
 */
function findAllLegacyPlanDirs(dir: string): string[] {
    const planDirs: string[] = [];
    function scan(d: string): void {
        try {
            const entries = readdirSync(d);
            const hasStatus = entries.includes('STATUS.md');
            if (hasStatus) {
                planDirs.push(d);
                return;
            }
            for (const entry of entries) {
                if (entry.startsWith('.')) {
                    continue;
                }
                const fullPath = join(d, entry);
                try {
                    const s = statSync(fullPath);
                    if (s.isDirectory()) {
                        scan(fullPath);
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
    return planDirs;
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

    const basePaths = [
        context.workingDirectory,
        resolve(context.workingDirectory, '..'),
        resolve(context.workingDirectory, '../..'),
    ];

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
    // Legacy compatibility only; clients should not send filesystem paths.
    directory: z.string().optional().describe("Optional legacy search scope"),
    filter: z
        .enum(['all', 'active', 'done', 'hold'])
        .optional()
        .describe('Optional category filter'),
    projectId: z
        .string()
        .optional()
        .describe('Optional project filter (matches project.id, owner/repo, or provider:owner/repo)'),
});

function getPlanCategory(planFile: string): PlanCategory {
    const segments = planFile.split(/[\\/]+/).map((segment) => segment.toLowerCase());
    if (segments.includes('done')) {
        return 'done';
    }
    if (segments.includes('hold')) {
        return 'hold';
    }
    return 'active';
}

async function executeListPlans(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const validated = ListPlansSchema.parse(args);
        const searchDir = validated.directory || context.workingDirectory;
        
        // SQLite and legacy directory plans
        const plans: Array<{
            id: string;
            name: string;
            path: string;
            type: string;
            uuid?: string;
            title?: string;
            stage?: string;
            category: PlanCategory;
            project?: ProjectBinding | null;
            projectSource?: 'manifest' | 'inferred' | 'none';
        }> = [];

        // Scan for .plan (SQLite) files
        for (const planFile of findAllPlanFiles(searchDir)) {
            try {
                const provider = createSqliteProvider(planFile);
                const exists = await provider.exists();
                if (!exists) {
                    await provider.close();
                    continue;
                }
                const metaResult = await provider.getMetadata();
                await provider.close();
                if (metaResult.success && metaResult.data) {
                    const m = metaResult.data;
                    const inferred = await inferProjectBindingFromPath(planFile);
                    const category = getPlanCategory(planFile);
                    if (validated.filter && validated.filter !== 'all' && validated.filter !== category) {
                        continue;
                    }
                    plans.push({
                        id: m.id || basename(planFile, '.plan'),
                        name: basename(planFile, '.plan'),
                        path: planFile,
                        type: 'sqlite',
                        uuid: m.uuid,
                        title: m.name,
                        stage: m.stage,
                        category,
                        project: inferred,
                        projectSource: inferred ? 'inferred' : 'none',
                    });
                }
            } catch {
                /* skip unreadable .plan files */
            }
        }

        // Legacy directory-based plans (STATUS.md present).
        for (const legacyPlanDir of findAllLegacyPlanDirs(searchDir)) {
            try {
                const binding = await readProjectBinding(legacyPlanDir, {
                    createManifestIfMissing: false,
                });
                const category = getPlanCategory(legacyPlanDir);
                if (validated.filter && validated.filter !== 'all' && validated.filter !== category) {
                    continue;
                }
                plans.push({
                    id: basename(legacyPlanDir),
                    name: basename(legacyPlanDir),
                    path: legacyPlanDir,
                    type: 'directory',
                    category,
                    project: binding.project,
                    projectSource: binding.source,
                });
            } catch {
                /* skip unreadable directories */
            }
        }

        // De-duplicate by plan id.
        const dedupedById = new Map<string, typeof plans[number]>();
        for (const plan of plans) {
            if (!dedupedById.has(plan.id)) {
                dedupedById.set(plan.id, plan);
            }
        }

        const filteredPlans = validated.projectId
            ? [...dedupedById.values()].filter((plan) => {
                const matchKeys = getProjectMatchKeys(plan.project);
                return matchKeys.includes(validated.projectId!.toLowerCase());
            })
            : [...dedupedById.values()];

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
                plans: filteredPlans.map(({ id, name, path, type, uuid, title, stage, category, project, projectSource }) => ({
                    id,
                    planId: id,
                    name,
                    path,
                    type,
                    uuid,
                    title,
                    stage,
                    category,
                    project,
                    projectSource,
                })),
                filter: {
                    ...(validated.projectId ? { projectId: validated.projectId } : {}),
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
});

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

const PlanActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('create'),
        code: z.string(),
        name: z.string().optional(),
        description: z.string(),
        directory: z.string().optional(),
        steps: z.number().optional(),
        direct: z.boolean().optional(),
        provider: z.string().optional(),
        model: z.string().optional(),
        noAi: z.boolean().optional(),
        catalysts: z.array(z.string()).optional(),
    }),
    z.object({
        action: z.literal('switch'),
        planId: z.string(),
    }),
    z.object({
        action: z.literal('move'),
        planId: z.string(),
        target: z.enum(['active', 'done', 'hold']),
    }),
]);

const PlanToolSchema = {
    action: z.enum(['create', 'switch', 'move']).describe('Plan management action to perform'),
    planId: z.string().optional().describe('Plan identifier for action=switch|move'),
    target: z.enum(['active', 'done', 'hold']).optional().describe('Target category for action=move'),
    code: z.string().optional().describe('Plan code when action=create'),
    name: z.string().optional().describe('Plan display name when action=create'),
    description: z.string().optional().describe('Plan description when action=create'),
    directory: z.string().optional().describe('Parent directory when action=create'),
    steps: z.number().optional().describe('Initial step count when action=create'),
    direct: z.boolean().optional().describe('Forwarded create option'),
    provider: z.string().optional().describe('Forwarded create option'),
    model: z.string().optional().describe('Forwarded create option'),
    noAi: z.boolean().optional().describe('Forwarded create option'),
    catalysts: z.array(z.string()).optional().describe('Catalysts for action=create'),
} satisfies z.ZodRawShape;

async function executePlan(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = PlanActionSchema.parse(args);
        switch (validated.action) {
            case 'create':
                return executeCreate(validated, context);
            case 'switch':
                return executeSwitchPlan(validated, context);
            case 'move':
                return executeMovePlan(validated, context);
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export const planTool: McpTool = {
    name: 'riotplan_plan',
    description: 'Manage plans with action=create|switch|move.',
    schema: PlanToolSchema,
    execute: executePlan,
};
