import { z } from 'zod';
import type { McpTool, ToolExecutionContext, ToolResult } from '../types.js';
import {
    ProjectBindingSchema,
    bindProjectToPlan,
    getProjectMatchKeys,
    readProjectBinding,
    resolvePlanPathFromId,
    resolveProjectContext,
    type ProjectBinding,
} from './project-binding-shared.js';

const bindProjectSchema = z.object({
    planId: z.string().describe('Plan identifier to bind (same identifier used by riotplan_list_plans)'),
    project: ProjectBindingSchema.describe('Portable project binding metadata'),
});

const getProjectBindingSchema = z.object({
    planId: z.string().describe('Plan identifier'),
});

const resolveProjectContextSchema = z.object({
    planId: z.string().describe('Plan identifier'),
    cwd: z.string().optional().describe('Current working directory (defaults to tool context workingDirectory)'),
    workspaceMappings: z
        .array(
            z.object({
                projectId: z.string(),
                rootPath: z.string(),
                repoKey: z.string().optional(),
            })
        )
        .optional()
        .describe('Optional local machine project mappings'),
});

async function executeBindProject(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = bindProjectSchema.parse(args);
        const planPath = await resolvePlanPathFromId(validated.planId, context);
        const result = await bindProjectToPlan(planPath, validated.project as ProjectBinding);
        return {
            success: true,
            data: {
                planId: validated.planId,
                project: result.project,
                migration: result.migration,
                matchKeys: getProjectMatchKeys(result.project),
            },
            message: `Bound project '${result.project.id}' to plan '${validated.planId}'.`,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function executeGetProjectBinding(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = getProjectBindingSchema.parse(args);
        const planPath = await resolvePlanPathFromId(validated.planId, context);
        const binding = await readProjectBinding(planPath);
        return {
            success: true,
            data: {
                planId: validated.planId,
                project: binding.project,
                source: binding.source,
                migration: binding.migration,
                matchKeys: getProjectMatchKeys(binding.project),
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function executeResolveProjectContext(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = resolveProjectContextSchema.parse(args);
        const planPath = await resolvePlanPathFromId(validated.planId, context);
        const binding = await readProjectBinding(planPath);
        const resolved = await resolveProjectContext({
            planPath,
            cwd: validated.cwd || context.workingDirectory,
            project: binding.project,
            workspaceMappings: validated.workspaceMappings,
            contextConfig: context.config,
        });

        return {
            success: true,
            data: {
                planId: validated.planId,
                ...resolved,
                source: binding.source,
                migration: binding.migration,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export const bindProjectTool: McpTool = {
    name: 'riotplan_bind_project',
    description:
        'Bind a plan to explicit project metadata. Uses repository identity as canonical key and keeps filesystem paths as optional hints.',
    schema: bindProjectSchema.shape,
    execute: executeBindProject,
};

export const getProjectBindingTool: McpTool = {
    name: 'riotplan_get_project_binding',
    description:
        'Get project binding for a plan, including migration/fallback details for plans that do not yet have explicit project metadata.',
    schema: getProjectBindingSchema.shape,
    execute: executeGetProjectBinding,
};

export const resolveProjectContextTool: McpTool = {
    name: 'riotplan_resolve_project_context',
    description:
        'Resolve a portable project root for a bound plan using repo identity, local workspace mappings, then optional path hints.',
    schema: resolveProjectContextSchema.shape,
    execute: executeResolveProjectContext,
};
