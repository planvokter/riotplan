/**
 * Switch Plan Tool - Change the current working plan context
 * 
 * This tool allows the LLM to switch between different plans during a conversation.
 * It updates the working directory context so subsequent tool calls operate on the new plan.
 */

import { z } from 'zod';
import { resolve, join, basename } from 'node:path';
import { readdir } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import {
    getProjectMatchKeys,
    inferProjectBindingFromPath,
    readProjectBinding,
    type ProjectBinding,
} from './project-binding-shared.js';

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
 * Check if a directory is a valid plan directory
 */
async function isPlanDirectory(dirPath: string): Promise<boolean> {
    try {
        // Check for common plan files
        const files = await readdir(dirPath);
        return files.includes('LIFECYCLE.md') || 
               files.includes('STATUS.md') || 
               files.includes('IDEA.md') ||
               files.includes('plan');
    } catch {
        return false;
    }
}

/**
 * Resolve a plan reference to an absolute path
 */
async function resolvePlanPath(planId: string, context: ToolExecutionContext): Promise<string | null> {
    // Legacy fallback: allow absolute path inputs from older clients.
    if (planId.startsWith('/')) {
        if (await isPlanDirectory(planId)) {
            return planId;
        }
        return null;
    }
    
    // Try as relative path from current working directory
    const fromCwd = resolve(context.workingDirectory, planId);
    if (await isPlanDirectory(fromCwd)) {
        return fromCwd;
    }
    
    // Try as plan code in common locations
    const basePaths = [
        context.workingDirectory,
        resolve(context.workingDirectory, '..'),  // Parent directory
        resolve(context.workingDirectory, '../..'),  // Grandparent
    ];
    
    for (const basePath of basePaths) {
        // Try direct child
        const directPath = join(basePath, planId);
        if (await isPlanDirectory(directPath)) {
            return directPath;
        }
        
        // Try in plans/ subdirectory
        const plansPath = join(basePath, 'plans', planId);
        if (await isPlanDirectory(plansPath)) {
            return plansPath;
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
    projectId: z
        .string()
        .optional()
        .describe('Optional project filter (matches project.id, owner/repo, or provider:owner/repo)'),
});

/**
 * Read plan.yaml manifest to get metadata
 */
async function readPlanManifest(planPath: string): Promise<{ id?: string; title?: string; stage?: string; project?: ProjectBinding } | null> {
    try {
        const { readFile } = await import('node:fs/promises');
        const yaml = await import('yaml');
        
        // Try plan.yaml
        const manifestPath = join(planPath, 'plan.yaml');
        try {
            const content = await readFile(manifestPath, 'utf-8');
            const manifest = yaml.parse(content);
            return manifest || null;
        } catch {
            // No manifest
        }
        
        // Try LIFECYCLE.md for stage
        const lifecyclePath = join(planPath, 'LIFECYCLE.md');
        try {
            const content = await readFile(lifecyclePath, 'utf-8');
            const stageMatch = content.match(/\*\*Stage\*\*:\s*`(\w+)`/);
            if (stageMatch) {
                return { stage: stageMatch[1] };
            }
        } catch {
            // No lifecycle
        }
        
        return null;
    } catch {
        return null;
    }
}

async function executeListPlans(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const validated = ListPlansSchema.parse(args);
        const searchDir = validated.directory || context.workingDirectory;
        
        // Find all plan directories
        const plans: Array<{
            id: string;
            name: string;
            path: string;
            type: string;
            title?: string;
            stage?: string;
            project?: ProjectBinding | null;
            projectSource?: 'manifest' | 'inferred' | 'none';
        }> = [];
        
        // Check if current directory is a plan
        if (await isPlanDirectory(searchDir)) {
            const manifest = await readPlanManifest(searchDir);
            const binding = await readProjectBinding(searchDir);
            plans.push({
                id: basename(searchDir),
                name: basename(searchDir),
                path: searchDir,
                type: 'current',
                title: manifest?.title,
                stage: manifest?.stage,
                project: binding.project,
                projectSource: binding.source,
            });
        }
        
        // Check subdirectories
        try {
            const entries = await readdir(searchDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subPath = join(searchDir, entry.name);
                    if (await isPlanDirectory(subPath)) {
                        const manifest = await readPlanManifest(subPath);
                        const binding = await readProjectBinding(subPath);
                        plans.push({
                            id: entry.name,
                            name: entry.name,
                            path: subPath,
                            type: 'subdirectory',
                            title: manifest?.title,
                            stage: manifest?.stage,
                            project: binding.project,
                            projectSource: binding.source,
                        });
                    }
                }
            }
        } catch {
            // Ignore errors reading subdirectories
        }
        
        // Check plans/ subdirectory
        const plansDir = join(searchDir, 'plans');
        try {
            const entries = await readdir(plansDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subPath = join(plansDir, entry.name);
                    if (await isPlanDirectory(subPath)) {
                        const manifest = await readPlanManifest(subPath);
                        const binding = await readProjectBinding(subPath);
                        plans.push({
                            id: entry.name,
                            name: entry.name,
                            path: subPath,
                            type: 'plans/',
                            title: manifest?.title,
                            stage: manifest?.stage,
                            project: binding.project,
                            projectSource: binding.source,
                        });
                    }
                }
            }
        } catch {
            // Ignore errors reading plans directory
        }

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
                    plans.push({
                        id: m.id || basename(planFile, '.plan'),
                        name: basename(planFile, '.plan'),
                        path: planFile,
                        type: 'sqlite',
                        title: m.name,
                        stage: m.stage,
                        project: inferred,
                        projectSource: inferred ? 'inferred' : 'none',
                    });
                }
            } catch {
                /* skip unreadable .plan files */
            }
        }

        const filteredPlans = validated.projectId
            ? plans.filter((plan) => {
                const matchKeys = getProjectMatchKeys(plan.project);
                return matchKeys.includes(validated.projectId!.toLowerCase());
            })
            : plans;

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
                plans: filteredPlans.map(({ id, name, type, title, stage, project, projectSource }) => ({
                    id,
                    name,
                    type,
                    title,
                    stage,
                    project,
                    projectSource,
                })),
                filter: validated.projectId ? { projectId: validated.projectId } : undefined,
            },
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
