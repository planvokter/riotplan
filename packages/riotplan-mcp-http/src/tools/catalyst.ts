/**
 * Catalyst Tools - Manage catalysts for plans
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { loadConfig, loadConfiguredCatalysts } from '@planvokter/riotplan';
import { loadCatalystSafe } from '@planvokter/riotplan-catalyst';
import { readPlanManifest, addCatalystToManifest, removeCatalystFromManifest } from '@planvokter/riotplan-catalyst';

// ============================================================================
// catalyst list action
// ============================================================================

async function executeCatalystList(
    _args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        // Load configuration to get catalyst settings
        const config = await loadConfig();
        
        if (!config?.catalysts || config.catalysts.length === 0) {
            return createSuccess(
                { catalysts: [] },
                'No catalysts configured. Add catalysts to riotplan.config.ts or set RIOTPLAN_CATALYSTS environment variable.'
            );
        }
        
        // Load all configured catalysts
        const configBaseDir = context.workingDirectory || process.cwd();
        const mergedCatalyst = await loadConfiguredCatalysts(config, configBaseDir);
        
        if (!mergedCatalyst) {
            return createSuccess(
                { catalysts: [] },
                'No catalysts could be loaded.'
            );
        }
        
        // Build list of catalyst details
        const catalystList = [];
        
        for (const catalystId of mergedCatalyst.catalystIds) {
            // Find the catalyst contribution info
            const contribution = mergedCatalyst.contributions.get(catalystId);
            
            catalystList.push({
                id: catalystId,
                facets: contribution?.facetTypes || [],
                contentCount: contribution?.contentCount || 0,
            });
        }
        
        return createSuccess(
            {
                catalysts: catalystList,
                totalCatalysts: catalystList.length,
            },
            `Found ${catalystList.length} catalyst(s)`
        );
    } catch (error) {
        return formatError(error);
    }
}


// ============================================================================
// catalyst show action
// ============================================================================

async function executeCatalystShow(
    args: any,
    _context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const catalystPath = args.catalyst;
        
        // Try to load the catalyst
        const result = await loadCatalystSafe(catalystPath);
        
        if (!result.success || !result.catalyst) {
            return formatError(
                new Error(`Failed to load catalyst: ${result.error || 'Unknown error'}`)
            );
        }
        
        const catalyst = result.catalyst;
        
        // Build facet summary
        const facetSummary: Record<string, any> = {};
        
        for (const [facetType, facetContent] of Object.entries(catalyst.facets)) {
            if (facetContent && Array.isArray(facetContent) && facetContent.length > 0) {
                facetSummary[facetType] = {
                    fileCount: facetContent.length,
                    files: facetContent.map(f => f.filename),
                    totalSize: facetContent.reduce((sum, f) => sum + f.content.length, 0),
                };
            }
        }
        
        return createSuccess({
            manifest: catalyst.manifest,
            directory: catalyst.directoryPath,
            facets: facetSummary,
            warnings: result.warnings || [],
        });
    } catch (error) {
        return formatError(error);
    }
}


// ============================================================================
// catalyst associate action
// ============================================================================

async function executeCatalystAssociate(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        const catalystIds: string[] = args.catalysts || [];
        const action: string = args.action || 'add';
        
        if (catalystIds.length === 0) {
            return formatError(new Error('No catalysts specified'));
        }
        
        // Validate that all catalysts can be loaded
        for (const catalystId of catalystIds) {
            const result = await loadCatalystSafe(catalystId);
            if (!result.success) {
                return formatError(
                    new Error(`Catalyst '${catalystId}' cannot be loaded: ${result.error}`)
                );
            }
        }
        
        // Read current plan manifest
        const currentManifest = await readPlanManifest(planPath);
        
        if (!currentManifest) {
            return formatError(
                new Error(
                    `No plan.yaml found at ${planPath}. ` +
                    `This directory may not be a valid plan, or the plan was created before catalyst support was added.`
                )
            );
        }
        
        // Perform the requested action
        let updatedCatalysts: string[] = currentManifest.catalysts || [];
        
        if (action === 'add') {
            // Add catalysts (avoiding duplicates)
            for (const catalystId of catalystIds) {
                if (!updatedCatalysts.includes(catalystId)) {
                    await addCatalystToManifest(planPath, catalystId);
                }
            }
            updatedCatalysts = (await readPlanManifest(planPath))?.catalysts || [];
        } else if (action === 'remove') {
            // Remove catalysts
            for (const catalystId of catalystIds) {
                await removeCatalystFromManifest(planPath, catalystId);
            }
            updatedCatalysts = (await readPlanManifest(planPath))?.catalysts || [];
        } else if (action === 'set') {
            // Replace all catalysts
            const manifest = await readPlanManifest(planPath);
            if (manifest) {
                manifest.catalysts = catalystIds;
                const { writePlanManifest } = await import('@planvokter/riotplan-catalyst');
                await writePlanManifest(planPath, manifest);
                updatedCatalysts = catalystIds;
            }
        }
        
        return createSuccess(
            {
                planId: currentManifest.id || args.planId || 'current',
                catalysts: updatedCatalysts,
                action,
            },
            `Successfully ${action === 'add' ? 'added' : action === 'remove' ? 'removed' : 'set'} catalysts. ` +
            `Plan now has ${updatedCatalysts.length} catalyst(s): ${updatedCatalysts.join(', ')}`
        );
    } catch (error) {
        return formatError(error);
    }
}

const CatalystActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('list'),
        planId: z.string().optional(),
        path: z.string().optional(),
    }),
    z.object({
        action: z.literal('show'),
        catalyst: z.string(),
    }),
    z.object({
        action: z.literal('associate'),
        planId: z.string().optional(),
        path: z.string().optional(),
        catalysts: z.array(z.string()),
        operation: z.enum(['add', 'remove', 'set']),
    }),
]);

const CatalystToolSchema = {
    action: z.enum(['list', 'show', 'associate']).describe('Catalyst action to perform'),
    planId: z.string().optional().describe('Plan identifier (defaults to current plan context)'),
    path: z.string().optional().describe('Optional plan path alias for planId'),
    catalyst: z.string().optional().describe('Catalyst ID or path when action=show'),
    catalysts: z.array(z.string()).optional().describe('Catalyst IDs/paths when action=associate'),
    operation: z.enum(['add', 'remove', 'set']).optional().describe('Association operation when action=associate'),
} satisfies z.ZodRawShape;

async function executeCatalyst(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = CatalystActionSchema.parse(args);
        switch (validated.action) {
            case 'list':
                return executeCatalystList(validated, context);
            case 'show':
                return executeCatalystShow(validated, context);
            case 'associate':
                return executeCatalystAssociate(
                    { ...validated, action: validated.operation },
                    context
                );
        }
    } catch (error) {
        return formatError(error);
    }
}

export const catalystTool: McpTool = {
    name: 'riotplan_catalyst',
    description:
        '[RiotPlan] Manage catalysts with one action-based tool. ' +
        'Use action=list|show|associate.',
    schema: CatalystToolSchema,
    execute: executeCatalyst,
};
