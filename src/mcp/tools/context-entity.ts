/**
 * Context Entity Tool - Unified context entity operations
 *
 * Provides list/get/create/update/delete actions over Redaksjon context entities
 * through a single MCP tool surface.
 */

import { resolve } from 'node:path';
import { z } from 'zod';
import { create as createContext } from '@redaksjon/context';
import type { McpTool, ToolExecutionContext, ToolResult } from '../types.js';
import { createSuccess, formatError } from './shared.js';

const EntityTypeSchema = z.enum(['project', 'person', 'term', 'company', 'ignored']);
type EntityType = z.infer<typeof EntityTypeSchema>;

const BaseSchema = z.object({
    contextDirectory: z
        .string()
        .optional()
        .describe('Optional directory used as context discovery starting point (defaults to tool working directory)'),
    contextDirectories: z
        .array(z.string())
        .optional()
        .describe('Optional explicit context directories (resolved relative to working directory when not absolute)'),
});

const ListSchema = BaseSchema.extend({
    action: z.literal('list'),
    entityType: EntityTypeSchema.describe('Entity type to list'),
    includeInactive: z
        .boolean()
        .optional()
        .describe('Include inactive projects when entityType=project (default: false)'),
});

const GetSchema = BaseSchema.extend({
    action: z.literal('get'),
    entityType: EntityTypeSchema.describe('Entity type to fetch'),
    id: z.string().min(1).describe('Entity id'),
});

const CreateSchema = BaseSchema.extend({
    action: z.literal('create'),
    entityType: EntityTypeSchema.describe('Entity type to create'),
    entity: z.record(z.string(), z.unknown()).describe('Full entity payload; id is required'),
});

const UpdateSchema = BaseSchema.extend({
    action: z.literal('update'),
    entityType: EntityTypeSchema.describe('Entity type to update'),
    id: z.string().min(1).describe('Entity id to update'),
    changes: z.record(z.string(), z.unknown()).describe('Partial entity changes'),
});

const DeleteSchema = BaseSchema.extend({
    action: z.literal('delete'),
    entityType: EntityTypeSchema.describe('Entity type to delete'),
    id: z.string().min(1).describe('Entity id to delete'),
});

const ActionSchema = z.discriminatedUnion('action', [
    ListSchema,
    GetSchema,
    CreateSchema,
    UpdateSchema,
    DeleteSchema,
]);

type ContextInstance = Awaited<ReturnType<typeof createContext>>;

function resolveContextPath(value: string, context: ToolExecutionContext): string {
    return resolve(context.workingDirectory || process.cwd(), value);
}

async function loadContext(args: z.infer<typeof BaseSchema>, context: ToolExecutionContext): Promise<ContextInstance> {
    const startingDir = args.contextDirectory
        ? resolveContextPath(args.contextDirectory, context)
        : context.workingDirectory || process.cwd();
    const contextDirectories = args.contextDirectories?.map((dir) => resolveContextPath(dir, context));
    return createContext({
        startingDir,
        contextDirectories,
    });
}

function getEntityByType(ctx: ContextInstance, entityType: EntityType, id: string): any | undefined {
    switch (entityType) {
        case 'project':
            return ctx.getProject(id);
        case 'person':
            return ctx.getPerson(id);
        case 'term':
            return ctx.getTerm(id);
        case 'company':
            return ctx.getCompany(id);
        case 'ignored':
            return ctx.getIgnored(id);
    }
}

function listEntitiesByType(ctx: ContextInstance, entityType: EntityType, includeInactive?: boolean): any[] {
    switch (entityType) {
        case 'project': {
            const projects = ctx.getAllProjects();
            return includeInactive ? projects : projects.filter((p) => p.active !== false);
        }
        case 'person':
            return ctx.getAllPeople();
        case 'term':
            return ctx.getAllTerms();
        case 'company':
            return ctx.getAllCompanies();
        case 'ignored':
            return ctx.getAllIgnored();
    }
}

async function executeContextEntity(args: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ActionSchema.parse(args);
        const ctx = await loadContext(validated, context);

        if (validated.action === 'list') {
            const entities = listEntitiesByType(ctx, validated.entityType, validated.includeInactive);
            return createSuccess({
                action: validated.action,
                entityType: validated.entityType,
                count: entities.length,
                entities,
            });
        }

        if (validated.action === 'get') {
            const entity = getEntityByType(ctx, validated.entityType, validated.id);
            if (!entity) {
                throw new Error(`${validated.entityType} with id "${validated.id}" not found`);
            }
            return createSuccess({
                action: validated.action,
                entityType: validated.entityType,
                entity,
            });
        }

        if (validated.action === 'create') {
            const rawId = validated.entity.id;
            if (typeof rawId !== 'string' || rawId.trim() === '') {
                throw new Error('entity.id is required for create action');
            }
            const existing = getEntityByType(ctx, validated.entityType, rawId);
            if (existing) {
                throw new Error(`${validated.entityType} with id "${rawId}" already exists`);
            }
            const nextEntity = {
                ...validated.entity,
                id: rawId,
                type: validated.entityType,
            };
            await ctx.saveEntity(nextEntity as any);
            return createSuccess({
                action: validated.action,
                entityType: validated.entityType,
                entity: nextEntity,
            });
        }

        if (validated.action === 'update') {
            const existing = getEntityByType(ctx, validated.entityType, validated.id);
            if (!existing) {
                throw new Error(`${validated.entityType} with id "${validated.id}" not found`);
            }
            const nextEntity = {
                ...existing,
                ...validated.changes,
                id: validated.id,
                type: validated.entityType,
            };
            await ctx.saveEntity(nextEntity as any, true);
            return createSuccess({
                action: validated.action,
                entityType: validated.entityType,
                entity: nextEntity,
            });
        }

        const existing = getEntityByType(ctx, validated.entityType, validated.id);
        if (!existing) {
            throw new Error(`${validated.entityType} with id "${validated.id}" not found`);
        }
        const deleted = await ctx.deleteEntity(existing as any);
        return createSuccess({
            action: validated.action,
            entityType: validated.entityType,
            id: validated.id,
            deleted,
        });
    } catch (error) {
        return formatError(error);
    }
}

export const contextEntityTool: McpTool = {
    name: 'riotplan_context',
    description:
        'Unified context entity operations using action=list|get|create|update|delete. ' +
        'Supports entity types: project, person, term, company, ignored.',
    schema: {
        action: z
            .enum(['list', 'get', 'create', 'update', 'delete'])
            .describe('Context operation action'),
        entityType: EntityTypeSchema.optional().describe('Entity type for action'),
        id: z.string().optional().describe('Entity id for get/update/delete'),
        entity: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Full entity payload for create'),
        changes: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Partial changes payload for update'),
        includeInactive: z
            .boolean()
            .optional()
            .describe('Include inactive projects for list action'),
        contextDirectory: z.string().optional().describe('Optional context discovery start directory'),
        contextDirectories: z
            .array(z.string())
            .optional()
            .describe('Optional explicit context directories'),
    },
    execute: executeContextEntity,
};
