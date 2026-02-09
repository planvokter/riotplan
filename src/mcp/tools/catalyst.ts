/**
 * Catalyst Tools - Manage catalysts for plans
 */

import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { loadConfig, loadConfiguredCatalysts } from '../../config/index.js';
import { loadCatalystSafe } from '@kjerneverk/riotplan-catalyst';
import { readPlanManifest, addCatalystToManifest, removeCatalystFromManifest } from '@kjerneverk/riotplan-catalyst';

// ============================================================================
// riotplan_catalyst_list
// ============================================================================

export const catalystListTool: McpTool = {
    name: 'riotplan_catalyst_list',
    description:
        '[RiotPlan] List all catalysts available to the current project. ' +
        'Returns catalyst ID, name, description, and which facets are provided. ' +
        'Sources include config-declared catalysts and catalystDirectory contents.',
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Optional plan directory (defaults to current directory)',
            },
        },
    },
};

export async function executeCatalystList(
    _args: any,
    _context: ToolExecutionContext
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
        const mergedCatalyst = await loadConfiguredCatalysts(config, process.cwd());
        
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
// riotplan_catalyst_show
// ============================================================================

export const catalystShowTool: McpTool = {
    name: 'riotplan_catalyst_show',
    description:
        '[RiotPlan] Show details of a specific catalyst including manifest and facet summary. ' +
        'Returns full manifest, list of facet files, and content preview.',
    inputSchema: {
        type: 'object',
        properties: {
            catalyst: {
                type: 'string',
                description: 'Catalyst ID or path to show details for',
            },
        },
        required: ['catalyst'],
    },
};

export async function executeCatalystShow(
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
// riotplan_catalyst_associate
// ============================================================================

export const catalystAssociateTool: McpTool = {
    name: 'riotplan_catalyst_associate',
    description:
        '[RiotPlan] Associate one or more catalysts with a specific plan. ' +
        'Writes/updates the plan\'s plan.yaml manifest to include the catalyst IDs. ' +
        'Validates that the catalysts exist and can be loaded before associating.',
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Plan directory path (defaults to current directory)',
            },
            catalysts: {
                type: 'array',
                items: { type: 'string' },
                description: 'Catalyst IDs or paths to associate with the plan',
            },
            action: {
                type: 'string',
                enum: ['add', 'remove', 'set'],
                description: 'Action to perform: add (append), remove (delete), or set (replace all)',
            },
        },
        required: ['catalysts', 'action'],
    },
};

export async function executeCatalystAssociate(
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
                const { writePlanManifest } = await import('@kjerneverk/riotplan-catalyst');
                await writePlanManifest(planPath, manifest);
                updatedCatalysts = catalystIds;
            }
        }
        
        return createSuccess(
            {
                planPath,
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
