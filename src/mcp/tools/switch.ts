/**
 * Switch Plan Tool - Change the current working plan context
 * 
 * This tool allows the LLM to switch between different plans during a conversation.
 * It updates the working directory context so subsequent tool calls operate on the new plan.
 */

import { z } from 'zod';
import { resolve, join, basename } from 'node:path';
import { readdir } from 'node:fs/promises';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';

// Schema for switch plan
export const SwitchPlanSchema = z.object({
    plan: z.string().describe("Plan path or code to switch to. Can be a relative path, absolute path, or plan code (e.g., 'my-plan' or './plans/my-plan')"),
});

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
async function resolvePlanPath(plan: string, context: ToolExecutionContext): Promise<string | null> {
    // Try as absolute path
    if (plan.startsWith('/')) {
        if (await isPlanDirectory(plan)) {
            return plan;
        }
        return null;
    }
    
    // Try as relative path from current working directory
    const fromCwd = resolve(context.workingDirectory, plan);
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
        const directPath = join(basePath, plan);
        if (await isPlanDirectory(directPath)) {
            return directPath;
        }
        
        // Try in plans/ subdirectory
        const plansPath = join(basePath, 'plans', plan);
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
        const planPath = await resolvePlanPath(validated.plan, context);
        
        if (!planPath) {
            return {
                success: false,
                error: `Could not find plan: ${validated.plan}. Make sure the plan exists and contains LIFECYCLE.md, STATUS.md, IDEA.md, or a plan/ directory.`,
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
                message: `✅ Switched to plan: ${planName}\nPath: ${planPath}`,
                planPath,
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
    directory: z.string().optional().describe("Directory to search for plans (defaults to current context)"),
});

/**
 * Read plan.yaml manifest to get metadata
 */
async function readPlanManifest(planPath: string): Promise<{ id?: string; title?: string; stage?: string } | null> {
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
        const plans: Array<{ name: string; path: string; type: string; title?: string; stage?: string }> = [];
        
        // Check if current directory is a plan
        if (await isPlanDirectory(searchDir)) {
            const manifest = await readPlanManifest(searchDir);
            plans.push({
                name: basename(searchDir),
                path: searchDir,
                type: 'current',
                title: manifest?.title,
                stage: manifest?.stage,
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
                        plans.push({
                            name: entry.name,
                            path: subPath,
                            type: 'subdirectory',
                            title: manifest?.title,
                            stage: manifest?.stage,
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
                        plans.push({
                            name: entry.name,
                            path: subPath,
                            type: 'plans/',
                            title: manifest?.title,
                            stage: manifest?.stage,
                        });
                    }
                }
            }
        } catch {
            // Ignore errors reading plans directory
        }
        
        if (plans.length === 0) {
            return {
                success: true,
                data: {
                    message: 'No plans found in the current context.',
                    plans: [],
                },
            };
        }
        
        const planList = plans.map(p => {
            const displayName = p.title || p.name;
            const stage = p.stage ? ` (${p.stage})` : '';
            return `- ${displayName}${stage}: ${p.path}`;
        }).join('\n');
        
        return {
            success: true,
            data: {
                message: `Found ${plans.length} plan(s):\n${planList}`,
                plans,
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
