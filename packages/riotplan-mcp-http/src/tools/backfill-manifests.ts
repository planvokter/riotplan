/**
 * Backfill Manifests Tool - Add plan.yaml to existing plans
 */

import { z } from 'zod';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess, ensurePlanManifest } from './shared.js';

/**
 * Check if a directory looks like a plan directory
 */
async function isPlanDirectory(dirPath: string): Promise<boolean> {
    try {
        const files = await readdir(dirPath);
        // A plan directory should have either:
        // - LIFECYCLE.md (idea/shaping/built stages)
        // - STATUS.md (built/executing stages)
        // - plan/ subdirectory (built/executing stages)
        return files.includes('LIFECYCLE.md') || 
               files.includes('STATUS.md') || 
               files.includes('plan');
    } catch {
        return false;
    }
}

/**
 * Recursively find all plan directories
 */
async function findPlanDirectories(basePath: string, maxDepth: number = 3): Promise<string[]> {
    const plans: string[] = [];
    
    async function scan(dirPath: string, depth: number) {
        if (depth > maxDepth) return;
        
        try {
            const entries = await readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                
                // Skip hidden directories and node_modules
                if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                    continue;
                }
                
                const fullPath = join(dirPath, entry.name);
                
                // Check if this is a plan directory
                if (await isPlanDirectory(fullPath)) {
                    plans.push(fullPath);
                    // Don't recurse into plan directories
                    continue;
                }
                
                // Recurse into subdirectories
                await scan(fullPath, depth + 1);
            }
        } catch {
            // Skip directories we can't read
        }
    }
    
    await scan(basePath, 0);
    return plans;
}

async function executeBackfillManifests(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const basePath = resolveDirectory(args, context);
        
        // Find all plan directories
        const planDirs = await findPlanDirectories(basePath);
        
        if (planDirs.length === 0) {
            return createSuccess(
                { plansFound: 0, manifestsCreated: 0 },
                `No plan directories found in ${basePath}`
            );
        }
        
        // Process each plan
        const results = [];
        let manifestsCreated = 0;
        
        for (const planDir of planDirs) {
            try {
                const created = await ensurePlanManifest(planDir);
                results.push({
                    path: planDir,
                    manifestCreated: created,
                });
                if (created) {
                    manifestsCreated++;
                }
            } catch (error) {
                results.push({
                    path: planDir,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        
        const summary = args.dryRun
            ? `Would create ${manifestsCreated} manifests in ${planDirs.length} plans`
            : `Created ${manifestsCreated} new manifests in ${planDirs.length} plans`;
        
        return createSuccess(
            {
                plansFound: planDirs.length,
                manifestsCreated,
                results: args.verbose ? results : undefined,
            },
            summary
        );
    } catch (error) {
        return formatError(error);
    }
}

export const backfillManifestsTool: McpTool = {
    name: 'riotplan_backfill_manifests',
    description:
        'Add plan.yaml manifest files to existing plans that lack them. ' +
        'Recursively scans a directory tree for plan directories and ensures each has a manifest. ' +
        'Safe to run multiple times - only creates manifests for plans that lack them.',
    schema: {
        planId: z.string().optional().describe('Optional scope identifier (defaults to current context)'),
        verbose: z.boolean().optional().describe('Include detailed results for each plan (default: false)'),
        dryRun: z.boolean().optional().describe('Show what would be done without making changes (default: false)'),
    },
    execute: executeBackfillManifests,
};
