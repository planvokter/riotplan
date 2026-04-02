/**
 * Context Entity Tool - Unified context entity operations
 *
 * Provides list/get/create/update/delete actions over Redaksjon context entities
 * through a single MCP tool surface.
 */

import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { create as createContext } from '@redaksjon/context';
import type { McpTool, ToolExecutionContext, ToolResult } from '../types.js';
import { createSuccess, formatError } from './shared.js';
import {
    findContextEntityFromIndex,
    listContextEntitiesFromIndex,
    markContextEntityIndexDirty,
} from './context-entity-index.js';

const EntityTypeSchema = z.enum(['project']);
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
    entity: z
        .record(z.string(), z.unknown())
        .describe('Full entity payload; entity.id should be a UUID (generated automatically when missing/invalid)'),
});

const UpsertSchema = BaseSchema.extend({
    action: z.literal('upsert'),
    entityType: EntityTypeSchema.describe('Entity type to upsert'),
    entity: z
        .record(z.string(), z.unknown())
        .describe('Full entity payload; entity.id must be a valid UUID (required for upsert / multi-server replication)'),
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
    UpsertSchema,
    UpdateSchema,
    DeleteSchema,
]);

type ContextInstance = Awaited<ReturnType<typeof createContext>>;
const UUID_V4ISH_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
    return UUID_V4ISH_PATTERN.test(value);
}

function resolveContextPath(value: string, context: ToolExecutionContext): string {
    return resolve(context.workingDirectory || process.cwd(), value);
}

async function loadContext(args: z.infer<typeof BaseSchema>, context: ToolExecutionContext): Promise<ContextInstance> {
    const startingDir = args.contextDirectory
        ? resolveContextPath(args.contextDirectory, context)
        : context.contextDir || context.workingDirectory || process.cwd();
    const contextDirectories =
        args.contextDirectories?.map((dir) => resolveContextPath(dir, context)) ||
        (context.contextDir ? [context.contextDir] : undefined);
    return createContext({
        startingDir,
        contextDirectories,
    });
}

function resolveContextRoots(args: z.infer<typeof BaseSchema>, context: ToolExecutionContext): string[] {
    if (args.contextDirectories && args.contextDirectories.length > 0) {
        return args.contextDirectories.map((dir) => resolveContextPath(dir, context));
    }
    if (context.contextDir) {
        return [context.contextDir];
    }
    if (args.contextDirectory) {
        return [resolveContextPath(args.contextDirectory, context)];
    }
    return [context.workingDirectory || process.cwd()];
}

async function canUseContextIndex(contextRoot: string): Promise<boolean> {
    try {
        const projectsDir = resolve(contextRoot, 'projects');
        const s = await stat(projectsDir);
        return s.isDirectory();
    } catch {
        return false;
    }
}

function getEntityByType(ctx: ContextInstance, entityType: EntityType, id: string): any | undefined {
    switch (entityType) {
        case 'project':
            return ctx.getProject(id);
    }
}

function listEntitiesByType(ctx: ContextInstance, entityType: EntityType, includeInactive?: boolean): any[] {
    switch (entityType) {
        case 'project': {
            const projects = ctx.getAllProjects();
            return includeInactive ? projects : projects.filter((p: { active?: boolean }) => p.active !== false);
        }
    }
}

async function executeContextEntity(args: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ActionSchema.parse(args);
        const contextRoots = resolveContextRoots(validated, context);
        const indexRoot = contextRoots.length === 1 ? contextRoots[0] : null;

        if (validated.action === 'list') {
            if (validated.entityType === 'project' && indexRoot && await canUseContextIndex(indexRoot)) {
                const indexed = await listContextEntitiesFromIndex(indexRoot, 'project');
                const entities = validated.includeInactive ? indexed : indexed.filter((e) => e.active !== false);
                return createSuccess({
                    action: validated.action,
                    entityType: validated.entityType,
                    count: entities.length,
                    entities,
                    source: 'index',
                });
            }
            const ctx = await loadContext(validated, context);
            const entities = listEntitiesByType(ctx, validated.entityType, validated.includeInactive);
            return createSuccess({
                action: validated.action,
                entityType: validated.entityType,
                count: entities.length,
                entities,
                source: 'context',
            });
        }

        if (validated.action === 'get') {
            if (validated.entityType === 'project' && indexRoot && await canUseContextIndex(indexRoot)) {
                const entity = await findContextEntityFromIndex(indexRoot, 'project', validated.id);
                if (!entity) {
                    throw new Error(`${validated.entityType} with id "${validated.id}" not found`);
                }
                return createSuccess({
                    action: validated.action,
                    entityType: validated.entityType,
                    entity,
                    source: 'index',
                });
            }
            const ctx = await loadContext(validated, context);
            const entity = getEntityByType(ctx, validated.entityType, validated.id);
            if (!entity) {
                throw new Error(`${validated.entityType} with id "${validated.id}" not found`);
            }
            return createSuccess({
                action: validated.action,
                entityType: validated.entityType,
                entity,
                source: 'context',
            });
        }

        const ctx = await loadContext(validated, context);
        if (validated.action === 'create') {
            const rawId = typeof validated.entity.id === 'string' ? validated.entity.id.trim() : '';
            const resolvedId = isUuid(rawId) ? rawId : randomUUID();
            const existing = getEntityByType(ctx, validated.entityType, resolvedId);
            if (existing) {
                throw new Error(`${validated.entityType} with id "${resolvedId}" already exists`);
            }
            const nextEntity = {
                ...validated.entity,
                id: resolvedId,
                type: validated.entityType,
            };
            await ctx.saveEntity(nextEntity as any);
            if (validated.entityType === 'project' && indexRoot) {
                markContextEntityIndexDirty(indexRoot, 'project');
            }
            return createSuccess({
                action: validated.action,
                entityType: validated.entityType,
                entity: nextEntity,
            });
        }

        if (validated.action === 'upsert') {
            const rawId = typeof validated.entity.id === 'string' ? validated.entity.id.trim() : '';
            if (!isUuid(rawId)) {
                throw new Error(`upsert requires entity.id to be a valid UUID (got "${rawId}")`);
            }
            const existing = getEntityByType(ctx, validated.entityType, rawId);
            const nextEntity = {
                ...(existing || {}),
                ...validated.entity,
                id: rawId,
                type: validated.entityType,
            };
            await ctx.saveEntity(nextEntity as any, Boolean(existing));
            if (validated.entityType === 'project' && indexRoot) {
                markContextEntityIndexDirty(indexRoot, 'project');
            }
            return createSuccess({
                action: validated.action,
                entityType: validated.entityType,
                entity: nextEntity,
                created: !existing,
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
            if (validated.entityType === 'project' && indexRoot) {
                markContextEntityIndexDirty(indexRoot, 'project');
            }
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
        if (validated.entityType === 'project' && indexRoot) {
            markContextEntityIndexDirty(indexRoot, 'project');
        }
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
        'Unified context entity operations using action=list|get|create|upsert|update|delete. ' +
        'Use upsert to create-or-replace by UUID (multi-server replication). Supports entity type: project.',
    schema: {
        action: z
            .enum(['list', 'get', 'create', 'upsert', 'update', 'delete'])
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
