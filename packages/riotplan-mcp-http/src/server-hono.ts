/**
 * RiotPlan HTTP MCP Server
 *
 * Standalone HTTP MCP server using Hono framework.
 * Provides the authoritative MCP server runtime with all tools, resources, and prompts.
 *
 * CRITICAL: In HTTP/remote mode, everything flows from plansDir configuration.
 * No config discovery or directory derivation - tools only process plan information.
 */
import { z } from 'zod';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { StreamableHTTPTransport } from '@hono/mcp';
import { HTTPException } from 'hono/http-exception';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Context } from 'hono';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { PerformanceObserver, constants as PerfConstants } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';
import { executeTool, tools } from './tools/index.js';
import { getResources, readResource } from './resources/index.js';
import { parseUri } from './uri.js';
import { getPrompts, getPrompt } from './prompts/index.js';
import { resolveDirectory } from './tools/shared.js';
import { bindProjectToPlan, getProjectMatchKeys, readProjectBinding } from './tools/project-binding-shared.js';
import { extractApiKeyFromHeaders, type AuthContext, RbacEngine, type RouteRequirement } from './rbac.js';
import Logging from '@fjell/logging';

/**
 * Server configuration
 */
export interface ServerConfig {
    /** Port to listen on */
    port: number;
    /** Plans directory path - single source of truth for all plan operations */
    plansDir: string;
    /** Optional context directory root (falls back to plansDir) */
    contextDir?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Enable CORS (default: true) */
    cors?: boolean;
    /** Session timeout in milliseconds (default: 1 hour) */
    sessionTimeout?: number;
    /** Optional cloud storage settings (opt-in). */
    cloud?: {
        enabled?: boolean;
        incrementalSyncEnabled?: boolean;
        syncFreshnessTtlMs?: number;
        syncTimeoutMs?: number;
        planBucket?: string;
        planPrefix?: string;
        contextBucket?: string;
        contextPrefix?: string;
        projectId?: string;
        keyFilename?: string;
        credentialsJson?: string;
        cacheDirectory?: string;
    };
    security?: {
        secured?: boolean;
        rbacUsersPath?: string;
        rbacKeysPath?: string;
        rbacPolicyPath?: string;
        rbacReloadSeconds?: number;
    };
}

/**
 * Session context for each connection
 */
interface SessionContext {
    /** Unique session ID */
    id: string;
    /** MCP Server instance */
    server: Server;
    /** HTTP transport for this session */
    transport: StreamableHTTPTransport;
    /** Plans directory for this session */
    plansDir: string;
    /** Context directory for this session */
    contextDir: string;
    /** Session creation time */
    createdAt: Date;
    /** Last activity time */
    lastActivity: Date;
    /** Subscribed resource URIs */
    subscriptions: Set<string>;
}

/**
 * Active sessions map
 */
const sessions = new Map<string, SessionContext>();
const TRUTHY_RE = /^(1|true|yes|on)$/i;
const HttpLogger = Logging.getLogger('@planvokter/riotplan-http');
const logger = HttpLogger.get('server');
const requestLogger = HttpLogger.get('request');
const toolLogger = HttpLogger.get('tool');
const resourceLogger = HttpLogger.get('resource');
const sessionLogger = HttpLogger.get('session');
const startupLogger = HttpLogger.get('startup');
const gcLogger = HttpLogger.get('gc');
const authLogger = HttpLogger.get('auth');
const SLOW_PHASE_MS = 200;
const MEMORY_SNAPSHOT_INTERVAL_MS = 30_000;

type CloudRuntimeLike = {
    enabled: boolean;
    workingDirectory: string;
    contextDirectory: string;
    syncDown: (opts?: { forceRefresh?: boolean }) => Promise<{
        plan: { downloadedCount: number; changedCount?: number; remoteIncludedCount: number; skippedUnchangedCount?: number } | null;
        context: { downloadedCount: number; changedCount?: number; remoteIncludedCount: number; skippedUnchangedCount?: number } | null;
        syncFreshHit: boolean;
        coalescedWaiterCount: number;
    }>;
    syncUpPlans: () => Promise<void>;
    syncUpContext: () => Promise<void>;
};

function createDisabledCloudRuntime(plansDir: string, contextDir: string): CloudRuntimeLike {
    return {
        enabled: false,
        workingDirectory: plansDir,
        contextDirectory: contextDir,
        syncDown: async () => ({
            plan: null,
            context: null,
            syncFreshHit: true,
            coalescedWaiterCount: 0,
        }),
        syncUpPlans: async () => {},
        syncUpContext: async () => {},
    };
}

async function createCloudRuntimeCompat(
    rawConfig: unknown,
    plansDir: string,
    contextDir: string,
    hooks?: { debug?: (event: string, details?: Record<string, unknown>) => void }
): Promise<CloudRuntimeLike> {
    try {
        const mod = await import('@planvokter/riotplan-cloud');
        const runtime = await mod.createCloudRuntime(rawConfig as any, plansDir, hooks as any);
        return runtime as unknown as CloudRuntimeLike;
    } catch {
        return createDisabledCloudRuntime(plansDir, contextDir);
    }
}

type AppVariables = {
    requestId: string;
    authContext?: AuthContext;
};

type AppContext = Context<{ Variables: AppVariables }>;

function summarizeSyncOutcome(sync: {
    plan: { downloadedCount: number; changedCount?: number; remoteIncludedCount: number; skippedUnchangedCount?: number } | null;
    context: { downloadedCount: number; changedCount?: number; remoteIncludedCount: number; skippedUnchangedCount?: number } | null;
    syncFreshHit: boolean;
    coalescedWaiterCount: number;
}): {
    syncOutcome: 'fresh-hit' | 'incremental' | 'full';
    remoteIncludedCount: number;
    changedCount: number;
    skippedUnchangedCount: number;
    downloadedCount: number;
    downloadedBytes: number;
    coalescedWaiterCount: number;
    syncFreshHit: boolean;
} {
    const plan = sync.plan;
    const context = sync.context;
    const remoteIncludedCount = (plan?.remoteIncludedCount || 0) + (context?.remoteIncludedCount || 0);
    const changedCount = (plan?.changedCount || 0) + (context?.changedCount || 0);
    const skippedUnchangedCount = (plan?.skippedUnchangedCount || 0) + (context?.skippedUnchangedCount || 0);
    const downloadedCount = (plan?.downloadedCount || 0) + (context?.downloadedCount || 0);
    const downloadedBytes = ((plan as any)?.downloadedBytes || 0) + ((context as any)?.downloadedBytes || 0);

    let syncOutcome: 'fresh-hit' | 'incremental' | 'full' = 'full';
    if (sync.syncFreshHit || downloadedCount === 0) {
        syncOutcome = 'fresh-hit';
    } else if (downloadedCount < remoteIncludedCount) {
        syncOutcome = 'incremental';
    }

    return {
        syncOutcome,
        remoteIncludedCount,
        changedCount,
        skippedUnchangedCount,
        downloadedCount,
        downloadedBytes,
        coalescedWaiterCount: sync.coalescedWaiterCount,
        syncFreshHit: sync.syncFreshHit,
    };
}

function shouldForceRefreshForResourceUri(uri: string): boolean {
    const lower = uri.toLowerCase();
    return lower.includes('forcerefresh=true') || lower.includes('refresh=force');
}

function gcKindToName(kind: number): string {
    if (kind === PerfConstants.NODE_PERFORMANCE_GC_MAJOR) return 'major';
    if (kind === PerfConstants.NODE_PERFORMANCE_GC_MINOR) return 'minor';
    if (kind === PerfConstants.NODE_PERFORMANCE_GC_INCREMENTAL) return 'incremental';
    if (kind === PerfConstants.NODE_PERFORMANCE_GC_WEAKCB) return 'weakcb';
    return `unknown(${kind})`;
}

function installGcDiagnostics(debugEnabled: boolean): void {
    if (!debugEnabled) {
        return;
    }

    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const gcEntry = entry as unknown as { kind?: number; flags?: number; detail?: unknown };
                gcLogger.info('event', {
                    eventType: entry.entryType,
                    kind: typeof gcEntry.kind === 'number' ? gcKindToName(gcEntry.kind) : 'unknown',
                    kindCode: gcEntry.kind ?? null,
                    flags: gcEntry.flags ?? null,
                    durationMs: Number(entry.duration.toFixed(3)),
                    heapUsedBytes: process.memoryUsage().heapUsed,
                    heapTotalBytes: process.memoryUsage().heapTotal,
                    totalHeapSizeBytes: getHeapStatistics().total_heap_size,
                    usedHeapSizeBytes: getHeapStatistics().used_heap_size,
                });
            }
        });
        observer.observe({ entryTypes: ['gc'] });
        startupLogger.info('gc.observer.installed', { pid: process.pid });
    } catch (error) {
        startupLogger.warning('gc.observer.unavailable', {
            error: error instanceof Error ? error.message : String(error),
        });
    }

    const snapshotTimer = setInterval(() => {
        const memory = process.memoryUsage();
        const heap = getHeapStatistics();
        gcLogger.debug('memory.snapshot', {
            rssBytes: memory.rss,
            heapUsedBytes: memory.heapUsed,
            heapTotalBytes: memory.heapTotal,
            externalBytes: memory.external,
            arrayBuffersBytes: memory.arrayBuffers,
            totalHeapSizeBytes: heap.total_heap_size,
            usedHeapSizeBytes: heap.used_heap_size,
            heapSizeLimitBytes: heap.heap_size_limit,
        });
    }, MEMORY_SNAPSHOT_INTERVAL_MS);
    snapshotTimer.unref?.();
}

function envDebugEnabled(): boolean {
    return TRUTHY_RE.test(process.env.RIOTPLAN_DEBUG || '') || TRUTHY_RE.test(process.env.RIOTPLAN_HTTP_DEBUG || '');
}

function debugLog(enabled: boolean, event: string, details?: Record<string, unknown>): void {
    if (enabled) {
        toolLogger.debug(event, details ?? {});
    }
}

function logPhaseTiming(
    component: { debug: (event: string, details?: Record<string, unknown>) => void; info: (event: string, details?: Record<string, unknown>) => void },
    debugEnabled: boolean,
    event: string,
    details: Record<string, unknown>
): void {
    if (debugEnabled) {
        component.debug(event, details);
        return;
    }
    const elapsed = typeof details.elapsedMs === 'number' ? details.elapsedMs : undefined;
    if (elapsed !== undefined && elapsed >= SLOW_PHASE_MS) {
        component.info(`${event}.slow`, details);
    }
}

function normalizePlanRef(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('/')) {
        return null;
    }
    return trimmed;
}

function isMutatingTool(toolName: string, args?: Record<string, unknown>): boolean {
    if (toolName === 'riotplan_plan') {
        const action = typeof args?.action === 'string' ? args.action : '';
        return action !== 'switch';
    }
    if (toolName === 'riotplan_context') {
        const action = typeof args?.action === 'string' ? args.action : '';
        return action !== 'list' && action !== 'get';
    }
    if (toolName === 'riotplan_catalyst') {
        const action = typeof args?.action === 'string' ? args.action : '';
        return action === 'associate';
    }
    if (toolName === 'riotplan_checkpoint') {
        const action = typeof args?.action === 'string' ? args.action : '';
        return action === 'create' || action === 'restore';
    }
    const nonMutating = new Set([
        'riotplan_status',
        'riotplan_read_context',
        'riotplan_list_plans',
        'riotplan_history_show',
        'riotplan_validate',
        'riotplan_resolve_project_context',
        'riotplan_get_project_binding',
    ]);
    if (nonMutating.has(toolName)) {
        return false;
    }
    return true;
}

const authContextStore = new AsyncLocalStorage<AuthContext | null>();

function getActiveAuthContext(): AuthContext | null {
    return authContextStore.getStore() ?? null;
}

function normalizeAllowedProjects(auth: AuthContext | null): string[] {
    if (!auth?.allowed_projects || auth.allowed_projects.length === 0) {
        return [];
    }
    return auth.allowed_projects
        .map((value) => value.trim())
        .filter(Boolean);
}

function hasProjectScope(auth: AuthContext | null): boolean {
    return normalizeAllowedProjects(auth).length > 0;
}

function isProjectAllowed(projectId: string | null | undefined, allowedProjects: string[]): boolean {
    if (!projectId) return false;
    const normalized = projectId.trim().toLowerCase();
    return allowedProjects.some((allowed) => allowed.toLowerCase() === normalized);
}

function projectBindingAllowed(project: unknown, allowedProjects: string[]): boolean {
    const matchKeys = getProjectMatchKeys(project as any);
    return matchKeys.some((key) => isProjectAllowed(key, allowedProjects));
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
        ? value as Record<string, unknown>
        : {};
}

async function assertPlanRefAllowed(
    planRef: string,
    workingDirectory: string,
    allowedProjects: string[]
): Promise<void> {
    const planPath = resolveDirectory({ planId: planRef }, { workingDirectory } as any);
    const binding = await readProjectBinding(planPath);
    if (!binding.project) {
        throw new Error(`Project-scoped key cannot access plan "${planRef}" because it is not bound to a project.`);
    }
    if (!projectBindingAllowed(binding.project, allowedProjects)) {
        throw new Error(`Project-scoped key cannot access plan "${planRef}".`);
    }
}

async function enforceProjectScopeForTool(
    toolName: string,
    args: unknown,
    workingDirectory: string,
    authContext: AuthContext | null
): Promise<Record<string, unknown>> {
    const scopedArgs = asRecord(args);
    const allowedProjects = normalizeAllowedProjects(authContext);
    if (allowedProjects.length === 0) {
        return scopedArgs;
    }

    if (toolName === 'riotplan_list_plans') {
        const providedProject = typeof scopedArgs.projectId === 'string' ? scopedArgs.projectId.trim() : '';
        if (providedProject.length > 0 && !isProjectAllowed(providedProject, allowedProjects)) {
            throw new Error(`Project-scoped key cannot list plans for project "${providedProject}".`);
        }
        if (!providedProject && allowedProjects.length === 1) {
            return {
                ...scopedArgs,
                projectId: allowedProjects[0],
            };
        }
        return scopedArgs;
    }

    if (toolName === 'riotplan_context') {
        const action = typeof scopedArgs.action === 'string' ? scopedArgs.action.trim() : '';
        const id = typeof scopedArgs.id === 'string' ? scopedArgs.id.trim() : '';
        const entityRecord = asRecord(scopedArgs.entity);
        const entityId = typeof entityRecord.id === 'string' ? entityRecord.id.trim() : '';

        if (action === 'get' || action === 'update' || action === 'delete') {
            if (!id || !isProjectAllowed(id, allowedProjects)) {
                throw new Error(`Project-scoped key cannot ${action} project "${id || '(missing)'}".`);
            }
        }
        if (action === 'create') {
            if (!entityId || !isProjectAllowed(entityId, allowedProjects)) {
                throw new Error(`Project-scoped key cannot create project "${entityId || '(missing)'}".`);
            }
        }
    }

    if (toolName === 'riotplan_bind_project') {
        const project = asRecord(scopedArgs.project);
        const projectId = typeof project.id === 'string' ? project.id.trim() : '';
        if (!projectId || !isProjectAllowed(projectId, allowedProjects)) {
            throw new Error(`Project-scoped key cannot bind plan to project "${projectId || '(missing)'}".`);
        }
    }

    if (toolName === 'riotplan_create') {
        if (allowedProjects.length > 1) {
            throw new Error('Project-scoped key is mapped to multiple projects. Create is only allowed when exactly one project is in scope.');
        }
    }

    if (toolName === 'riotplan_plan') {
        const action = typeof scopedArgs.action === 'string' ? scopedArgs.action.trim() : '';
        if (action === 'create' && allowedProjects.length > 1) {
            throw new Error('Project-scoped key is mapped to multiple projects. Plan create is only allowed when exactly one project is in scope.');
        }
    }

    const planRef = typeof scopedArgs.planId === 'string'
        ? scopedArgs.planId.trim()
        : typeof scopedArgs.path === 'string'
            ? scopedArgs.path.trim()
            : '';
    if (planRef) {
        await assertPlanRefAllowed(planRef, workingDirectory, allowedProjects);
    }

    return scopedArgs;
}

function filterProjectScopedToolResult(
    toolName: string,
    args: Record<string, unknown>,
    data: unknown,
    authContext: AuthContext | null
): unknown {
    const allowedProjects = normalizeAllowedProjects(authContext);
    if (allowedProjects.length === 0) {
        return data;
    }

    const payload = asRecord(data);
    if (toolName === 'riotplan_context' && args.action === 'list' && Array.isArray(payload.entities)) {
        return {
            ...payload,
            entities: payload.entities.filter((entity) => {
                const project = asRecord(entity);
                const id = typeof project.id === 'string' ? project.id.trim() : '';
                return isProjectAllowed(id, allowedProjects);
            }),
        };
    }

    if (Array.isArray(payload.plans)) {
        return {
            ...payload,
            plans: payload.plans.filter((plan) => {
                const planRecord = asRecord(plan);
                return projectBindingAllowed(planRecord.project, allowedProjects);
            }),
        };
    }

    return data;
}

async function postProcessProjectScopedCreate(
    toolName: string,
    args: Record<string, unknown>,
    result: { success: boolean; data?: unknown },
    workingDirectory: string,
    authContext: AuthContext | null
): Promise<void> {
    const allowedProjects = normalizeAllowedProjects(authContext);
    if (allowedProjects.length !== 1 || !result.success) {
        return;
    }
    const action = typeof args.action === 'string' ? args.action.trim() : '';
    const isCreate = toolName === 'riotplan_create' || (toolName === 'riotplan_plan' && action === 'create');
    if (!isCreate) {
        return;
    }

    const data = asRecord(result.data);
    const planRef = typeof data.planId === 'string'
        ? data.planId.trim()
        : typeof data.code === 'string'
            ? data.code.trim()
            : '';
    if (!planRef) {
        return;
    }

    const planPath = resolveDirectory({ planId: planRef }, { workingDirectory } as any);
    const binding = await readProjectBinding(planPath);
    if (binding.project && projectBindingAllowed(binding.project, allowedProjects)) {
        return;
    }

    await bindProjectToPlan(planPath, {
        id: allowedProjects[0],
        name: allowedProjects[0],
        relationship: 'primary',
    });
}

async function notifyPlanResourceChanged(planRef: string): Promise<void> {
    const uri = `riotplan://plan/${planRef}`;
    for (const session of sessions.values()) {
        if (!session.subscriptions.has(uri)) {
            continue;
        }
        try {
            await session.transport.send({
                jsonrpc: '2.0',
                method: 'notifications/resource_changed',
                params: { uri },
            } as any);
        } catch {
            // Ignore stale transports/sse streams.
        }
    }
}

/**
 * Default session timeout (1 hour)
 */
const DEFAULT_SESSION_TIMEOUT = 60 * 60 * 1000;

/**
 * Generate a new session ID
 */
function generateSessionId(): string {
    return randomUUID();
}

/**
 * Convert Zod raw shape to JSON Schema for MCP tool inputSchema
 * Uses Zod v4 built-in toJSONSchema (zod-to-json-schema is incompatible with Zod v4)
 */
function schemaToJsonSchema(schema: z.ZodRawShape): Record<string, unknown> {
    const zodSchema = z.object(schema);
    const jsonSchema = z.toJSONSchema(zodSchema) as Record<string, unknown>;
    // MCP expects type/object at minimum; ensure we have it
    if (!jsonSchema.type) jsonSchema.type = 'object';
    return jsonSchema;
}

/**
 * Create a new MCP server instance for a session
 * All operations use plansDir - no config discovery
 */
function createMcpServer(plansDir: string, contextDir: string, sessionId: string, config: ServerConfig): Server {
    const debugEnabled = config.debug === true || envDebugEnabled();
    const server = new Server(
        {
            name: 'riotplan-http',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
                resources: {
                    subscribe: true,
                    listChanged: true,
                },
                prompts: {
                    listChanged: false,
                },
            },
        }
    );

    // ========================================================================
    // Tools - context.workingDirectory = plansDir
    // ========================================================================

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const tool = tools.find((t) => t.name === toolName);
        const authContext = getActiveAuthContext();
        const startedAt = Date.now();
        const syncRunId = randomUUID();
        toolLogger.info('call.start', {
            sessionId,
            tool: toolName,
            argKeys: Object.keys(request.params.arguments || {}),
            syncRunId,
        });
        debugLog(debugEnabled, 'call.start', {
            sessionId,
            tool: toolName,
            argKeys: Object.keys(request.params.arguments || {}),
            syncRunId,
        });

        if (!tool) {
            toolLogger.warning('call.unknown_tool', { sessionId, tool: toolName });
            return {
                content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
                isError: true,
            };
        }

        try {
            const runtimeStartedAt = Date.now();
            const cloudRuntimeStartedAt = Date.now();
            const context = {
                ...(await (async () => {
                    const cloudRuntime = await createCloudRuntimeCompat(
                        { cloud: config.cloud } as any,
                        plansDir,
                        contextDir,
                        {
                            debug: (event, details) => {
                                debugLog(debugEnabled, `cloud.${event}`, {
                                    sessionId,
                                    tool: toolName,
                                    syncRunId,
                                    ...(details || {}),
                                });
                            },
                        }
                    );
                    const forceRefresh = isMutatingTool(toolName, request.params.arguments as Record<string, unknown> | undefined);
                    const syncDown = await cloudRuntime.syncDown({ forceRefresh });
                    return {
                        workingDirectory: cloudRuntime.workingDirectory,
                        contextDir: cloudRuntime.contextDirectory,
                        cloudRuntime,
                        syncDown,
                    };
                })()),
                config,
                logger: undefined,
            };
            const syncSummary = summarizeSyncOutcome(context.syncDown);
            logPhaseTiming(toolLogger, debugEnabled, 'call.cloud_sync_down', {
                sessionId,
                tool: toolName,
                elapsedMs: Date.now() - cloudRuntimeStartedAt,
                cloudEnabled: context.cloudRuntime?.enabled === true,
                syncRunId,
                ...syncSummary,
            });
            debugLog(debugEnabled, 'call.runtime.ready', {
                sessionId,
                tool: toolName,
                elapsedMs: Date.now() - runtimeStartedAt,
                cloudEnabled: context.cloudRuntime?.enabled === true,
                syncRunId,
                ...syncSummary,
            });

            const executionStartedAt = Date.now();
            const scopedArgs = await enforceProjectScopeForTool(
                toolName,
                request.params.arguments || {},
                context.workingDirectory,
                authContext
            );
            const result = await executeTool(toolName, scopedArgs, context);
            await postProcessProjectScopedCreate(toolName, scopedArgs, result, context.workingDirectory, authContext);
            logPhaseTiming(toolLogger, debugEnabled, 'call.execute', {
                sessionId,
                tool: toolName,
                elapsedMs: Date.now() - executionStartedAt,
                syncRunId,
            });
            debugLog(debugEnabled, 'call.execute.complete', {
                sessionId,
                tool: toolName,
                elapsedMs: Date.now() - executionStartedAt,
                syncRunId,
            });

            if (context.cloudRuntime?.enabled && isMutatingTool(toolName, request.params.arguments as Record<string, unknown> | undefined)) {
                const syncUpStartedAt = Date.now();
                await context.cloudRuntime.syncUpPlans();
                if (toolName === 'riotplan_context') {
                    await context.cloudRuntime.syncUpContext();
                }
                logPhaseTiming(toolLogger, debugEnabled, 'call.cloud_sync_up', {
                    sessionId,
                    tool: toolName,
                    elapsedMs: Date.now() - syncUpStartedAt,
                    syncRunId,
                });
                debugLog(debugEnabled, 'call.cloud_sync.complete', {
                    sessionId,
                    tool: toolName,
                    elapsedMs: Date.now() - syncUpStartedAt,
                    syncRunId,
                });
            }

            if (!result.success) {
                toolLogger.error('call.error', {
                    sessionId,
                    tool: toolName,
                    elapsedMs: Date.now() - startedAt,
                    error: result.error || 'Tool execution failed',
                    syncRunId,
                });
                const errorParts: string[] = [result.error || 'Tool execution failed'];
                if (result.context && typeof result.context === 'object') {
                    errorParts.push('\n=== Context ===');
                    for (const [key, value] of Object.entries(result.context)) {
                        if (value !== undefined && value !== null) {
                            errorParts.push(`${key}: ${String(value)}`);
                        }
                    }
                }
                if (result.recovery && result.recovery.length > 0) {
                    errorParts.push('\n=== Recovery Steps ===');
                    errorParts.push(...result.recovery.map((step, i) => `${i + 1}. ${step}`));
                }
                return {
                    content: [{ type: 'text', text: errorParts.join('\n') }],
                    isError: true,
                };
            }

            if (isMutatingTool(toolName, request.params.arguments as Record<string, unknown> | undefined)) {
                const candidateRefs = new Set<string>();
                const args = request.params.arguments || {};
                for (const candidate of [args.planId, args.path, result.data?.planId, result.data?.code]) {
                    const normalized = normalizePlanRef(candidate);
                    if (normalized) {
                        candidateRefs.add(normalized);
                    }
                }
                for (const ref of candidateRefs) {
                    await notifyPlanResourceChanged(ref);
                }
            }

            const content: Array<{ type: 'text'; text: string }> = [];
            if (result.logs && result.logs.length > 0) {
                content.push({
                    type: 'text',
                    text: '=== Command Output ===\n' + result.logs.join('\n') + '\n\n=== Result ===',
                });
            }
            const filteredData = filterProjectScopedToolResult(toolName, scopedArgs, result.data, authContext);
            const textContent =
                filteredData !== undefined
                    ? JSON.stringify(filteredData, null, 2)
                    : result.message || 'Success';
            content.push({ type: 'text', text: textContent });
            toolLogger.info('call.complete', {
                sessionId,
                tool: toolName,
                elapsedMs: Date.now() - startedAt,
                status: 'ok',
                syncRunId,
            });

            return { content };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            toolLogger.error('call.unhandled', {
                sessionId,
                tool: toolName,
                elapsedMs: Date.now() - startedAt,
                error: msg,
                syncRunId,
            });
            return {
                content: [{ type: 'text', text: `=== Unhandled Error in ${toolName} ===\n\n${msg}` }],
                isError: true,
            };
        }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: schemaToJsonSchema(tool.schema),
            })),
        };
    });

    // ========================================================================
    // Resources - paths resolved relative to plansDir
    // ========================================================================

    const resources = getResources();

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: resources.map((r) => ({
                uri: r.uri,
                name: r.name,
                description: r.description || '',
                mimeType: r.mimeType,
            })),
        };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const uri = request.params.uri;
        const authContext = getActiveAuthContext();
        const startedAt = Date.now();
        const syncRunId = randomUUID();
        resourceLogger.info('read.start', { sessionId, uri, syncRunId });
        try {
            const allowedProjects = normalizeAllowedProjects(authContext);
            if (allowedProjects.length > 0) {
                const parsed = parseUri(uri);
                if (parsed.path) {
                    await assertPlanRefAllowed(parsed.path, plansDir, allowedProjects);
                }
            }

            const cloudRuntimeStartedAt = Date.now();
            const cloudRuntime = await createCloudRuntimeCompat(
                { cloud: config.cloud } as any,
                plansDir,
                contextDir,
                {
                    debug: (event, details) => {
                        debugLog(debugEnabled, `cloud.${event}`, {
                            sessionId,
                            resourceUri: uri,
                            syncRunId,
                            ...(details || {}),
                        });
                    },
                }
            );
            const syncDown = await cloudRuntime.syncDown({
                forceRefresh: shouldForceRefreshForResourceUri(uri),
            });
            const syncSummary = summarizeSyncOutcome(syncDown);
            logPhaseTiming(resourceLogger, debugEnabled, 'read.cloud_sync_down', {
                sessionId,
                uri,
                elapsedMs: Date.now() - cloudRuntimeStartedAt,
                cloudEnabled: cloudRuntime.enabled === true,
                syncRunId,
                ...syncSummary,
            });
            const data = await readResource(uri, cloudRuntime.workingDirectory);
            const resource = resources.find((r) => {
                const base = r.uri.split('{')[0];
                return uri.startsWith(base);
            });
            const mimeType = resource?.mimeType || 'application/json';
            resourceLogger.info('read.complete', {
                sessionId,
                uri,
                elapsedMs: Date.now() - startedAt,
                status: 'ok',
                syncRunId,
            });
            return {
                contents: [
                    {
                        uri,
                        mimeType,
                        text: JSON.stringify(data, null, 2),
                    },
                ],
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            resourceLogger.error('read.error', {
                sessionId,
                uri,
                elapsedMs: Date.now() - startedAt,
                error: msg,
                syncRunId,
            });
            return {
                contents: [{ uri, mimeType: 'text/plain', text: `Error: ${msg}` }],
            };
        }
    });

    // ========================================================================
    // Prompts - plansDir used as default for directory/path args
    // ========================================================================

    const prompts = getPrompts();

    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
            prompts: prompts.map((p) => ({
                name: p.name,
                description: p.description,
                arguments: p.arguments,
            })),
        };
    });

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const name = request.params.name;
        const args = request.params.arguments || {};
        const argsRecord: Record<string, string> = {};
        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string') argsRecord[key] = value;
        }
        try {
            const messages = await getPrompt(name, argsRecord, { plansDir });
            return {
                messages: messages.map((msg) => {
                    if (msg.content.type === 'text') {
                        return {
                            role: msg.role,
                            content: { type: 'text' as const, text: msg.content.text || '' },
                        };
                    }
                    return msg as { role: 'user' | 'assistant'; content: { type: string; [k: string]: unknown } };
                }),
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to get prompt ${name}: ${msg}`);
        }
    });

    return server;
}

/**
 * Get or create a session
 */
async function getOrCreateSession(
    sessionId: string,
    plansDir: string,
    contextDir: string,
    config: ServerConfig
): Promise<SessionContext> {
    const debugEnabled = config.debug === true || envDebugEnabled();
    let session = sessions.get(sessionId);

    if (!session) {
        const server = createMcpServer(plansDir, contextDir, sessionId, config);
        const transport = new StreamableHTTPTransport({ enableJsonResponse: true });

        await server.connect(transport);

        session = {
            id: sessionId,
            server,
            transport,
            plansDir,
            contextDir,
            createdAt: new Date(),
            lastActivity: new Date(),
            subscriptions: new Set<string>(),
        };

        sessions.set(sessionId, session);
        sessionLogger.info('created', { sessionId, plansDir, contextDir });
    } else {
        session.lastActivity = new Date();
        if (debugEnabled) {
            sessionLogger.debug('reused', { sessionId });
        }
    }

    return session;
}

/**
 * Clean up expired sessions
 */
function cleanupSessions(timeout: number): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of sessions.entries()) {
        const inactiveTime = now - session.lastActivity.getTime();
        if (inactiveTime > timeout) {
            expiredSessions.push(sessionId);
        }
    }

    for (const sessionId of expiredSessions) {
        const session = sessions.get(sessionId);
        if (session) {
            session.server.close();
            sessions.delete(sessionId);
        }
    }

    if (expiredSessions.length > 0) {
        sessionLogger.info('cleanup', { expiredSessions: expiredSessions.length });
    }
}

/**
 * Create and configure the Hono app
 */
export function createApp(config: ServerConfig): Hono<{ Variables: AppVariables }> {
    const app = new Hono<{ Variables: AppVariables }>();
    const contextDir = resolveContextDir(config);
    const secured = config.security?.secured === true;
    const rbacEngine = createRbacEngine(config);

    app.use('*', async (c, next) => {
        const existingRequestId = c.req.header('x-request-id');
        const requestId = (existingRequestId && existingRequestId.trim()) || randomUUID();
        c.set('requestId', requestId);
        await next();
        if (!c.res.headers.has('x-request-id')) {
            c.res.headers.set('x-request-id', requestId);
        }
    });

    if (config.cors !== false) {
        app.use('/mcp/*', cors());
        app.use('/plan/*', cors());
    }

    app.get('/health', (c) => {
        return c.json({
            status: 'ok',
            service: 'riotplan-http',
            version: '1.0.0',
            sessions: sessions.size,
            plansDir: config.plansDir,
            contextDir,
            cloudEnabled: config.cloud?.enabled === true,
            secured,
            tools: tools.length,
            resources: getResources().length,
            prompts: getPrompts().length,
            endpoints: {
                mcp: '/mcp',
                downloadPlan: '/plan/{planId}',
                uploadPlan: '/plan/upload',
                health: '/health',
            },
        });
    });

    app.get('/auth/whoami', guardRoute('GET', '/auth/whoami'), async (c) => {
        const authContext = c.get('authContext');
        if (!authContext) {
            return jsonError(c, 500, 'SERVER_MISCONFIG', 'Authentication context missing');
        }
        return c.json({
            user_id: authContext.user_id,
            roles: authContext.roles,
            key_id: authContext.key_id,
            allowed_projects: authContext.allowed_projects ?? [],
            request_id: c.get('requestId'),
        });
    });

    app.get('/admin/ping', guardRoute('GET', '/admin/ping'), async (c) => {
        const authContext = c.get('authContext');
        return c.json({
            ok: true,
            role: 'admin',
            user_id: authContext?.user_id || null,
            request_id: c.get('requestId'),
        });
    });

    app.get('/plan/:planId', guardRoute('GET', '/plan/:planId'), async (c) => {
        const startedAt = Date.now();
        const method = 'GET';
        const route = '/plan/:planId';
        try {
            const planId = c.req.param('planId');
            if (!planId) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 400,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'missing_plan_id',
                });
                return jsonError(c, 400, 'INVALID_PLAN_ID', 'Missing planId');
            }

            const decodedPlanId = decodeURIComponent(planId);
            debugLog(config.debug === true || envDebugEnabled(), 'plan.resolve.start', { planId: decodedPlanId });
            const planPath = resolveDirectory({ planId: decodedPlanId }, { workingDirectory: config.plansDir });
            if (!planPath.endsWith('.plan')) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 400,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'invalid_plan_extension',
                    planId: decodedPlanId,
                });
                return jsonError(c, 400, 'INVALID_PLAN_FILE', 'Resolved plan is not a .plan file');
            }

            const authContext = c.get('authContext');
            const allowedProjects = normalizeAllowedProjects(authContext || null);
            if (allowedProjects.length > 0) {
                await assertPlanRefAllowed(decodedPlanId, config.plansDir, allowedProjects);
            }

            const planStats = await stat(planPath);
            const fileName = basename(planPath);
            c.header('Content-Type', 'application/octet-stream');
            c.header('Content-Length', String(planStats.size));
            c.header('Content-Disposition', `attachment; filename="${fileName}"`);
            requestLogger.info('complete', {
                method,
                route,
                status: 200,
                elapsedMs: Date.now() - startedAt,
                planId: decodedPlanId,
                bytes: planStats.size,
            });
            return c.body(createReadStream(planPath) as any);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes('plan not found')) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 404,
                    elapsedMs: Date.now() - startedAt,
                    error: message,
                });
                return jsonError(c, 404, 'PLAN_NOT_FOUND', message);
            }
            requestLogger.error('complete', {
                method,
                route,
                status: 500,
                elapsedMs: Date.now() - startedAt,
                error: message,
            });
            return jsonError(c, 500, 'DOWNLOAD_FAILED', 'Failed to download plan');
        }
    });

    app.post('/plan/upload', guardRoute('POST', '/plan/upload'), async (c) => {
        const startedAt = Date.now();
        const method = 'POST';
        const route = '/plan/upload';
        try {
            const body = await c.req.parseBody();
            const file = body.plan;
            const upload = file as
                | {
                    name?: string;
                    arrayBuffer?: () => Promise<ArrayBuffer>;
                }
                | undefined;
            if (!upload || typeof upload.name !== 'string' || typeof upload.arrayBuffer !== 'function') {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 400,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'missing_upload',
                });
                return jsonError(c, 400, 'MISSING_PLAN_UPLOAD', 'No .plan file provided in multipart field "plan"');
            }
            if (extname(upload.name).toLowerCase() !== '.plan') {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 400,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'invalid_extension',
                    filename: upload.name,
                });
                return jsonError(c, 400, 'INVALID_PLAN_FILE', 'Uploaded file must have .plan extension');
            }

            const targetDir = config.plansDir;
            await mkdir(targetDir, { recursive: true });

            const originalName = basename(upload.name);
            const baseName = originalName.slice(0, -5);
            let targetName = originalName;
            let counter = 1;
            while (true) {
                const candidate = join(targetDir, targetName);
                try {
                    await stat(candidate);
                    counter += 1;
                    targetName = `${baseName}-${counter}.plan`;
                } catch {
                    break;
                }
            }

            const bytes = await upload.arrayBuffer();
            const targetPath = join(targetDir, targetName);
            await writeFile(targetPath, Buffer.from(bytes));

            const authContext = c.get('authContext');
            const allowedProjects = normalizeAllowedProjects(authContext || null);
            if (allowedProjects.length > 0) {
                if (allowedProjects.length !== 1) {
                    return jsonError(c, 403, 'FORBIDDEN', 'Project-scoped keys with multiple projects cannot upload plans without an explicit project binding.');
                }
                await bindProjectToPlan(targetPath, {
                    id: allowedProjects[0],
                    name: allowedProjects[0],
                    relationship: 'primary',
                });
            }

            requestLogger.info('complete', {
                method,
                route,
                status: 200,
                elapsedMs: Date.now() - startedAt,
                filename: targetName,
                bytes: bytes.byteLength,
            });
            return c.json({
                success: true,
                planId: targetName.replace(/\.plan$/i, ''),
                filename: targetName,
                path: targetPath,
                size: bytes.byteLength,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            requestLogger.error('complete', {
                method,
                route,
                status: 500,
                elapsedMs: Date.now() - startedAt,
                error: message,
            });
            return jsonError(c, 500, 'UPLOAD_FAILED', 'Failed to upload plan');
        }
    });

    app.post('/mcp', guardRoute('POST', '/mcp'), async (c: AppContext) => {
        const startedAt = Date.now();
        const method = 'POST';
        const route = '/mcp';
        const debugEnabled = config.debug === true || envDebugEnabled();
        const authContext = c.get('authContext');
        const authFields = {
            userId: authContext?.user_id || null,
            keyId: authContext?.key_id || null,
        };
        let rpcMethod: string | undefined;
        let rpcToolName: string | undefined;
        let rpcId: string | number | null | undefined;
        try {
            const requestedSessionId = c.req.header('Mcp-Session-Id');
            const sessionId = requestedSessionId || generateSessionId();

            const bodyClone = c.req.raw.clone();
            try {
                const parseStartedAt = Date.now();
                const rawBody = await bodyClone.text();
                const message = JSON.parse(rawBody) as {
                    jsonrpc?: string;
                    method?: string;
                    id?: string | number | null;
                    params?: { uri?: string; name?: string };
                };
                rpcMethod = message.method;
                rpcToolName = message.method === 'tools/call' ? message.params?.name : undefined;
                rpcId = message.id;
                logPhaseTiming(requestLogger, debugEnabled, 'request.parse_jsonrpc', {
                    method,
                    route,
                    sessionId,
                    rpcMethod: message.method || '(unknown)',
                    rpcToolName: rpcToolName || null,
                    rpcId: message.id ?? null,
                    elapsedMs: Date.now() - parseStartedAt,
                });
                if (!requestedSessionId || !sessions.has(sessionId)) {
                    sessionLogger.warning('recovered.missing_session', {
                        requestedSessionId: requestedSessionId || null,
                        rpcMethod: message.method || '(unknown)',
                        rpcToolName: rpcToolName || null,
                        rpcId: message.id ?? null,
                    });
                }
                const session = await getOrCreateSession(sessionId, config.plansDir, contextDir, config);
                requestLogger.info('incoming', {
                    method,
                    route,
                    sessionId,
                    ...authFields,
                    rpcMethod: message.method || '(unknown)',
                    rpcToolName: rpcToolName || null,
                    rpcId: message.id ?? null,
                    rpcType: message.id === undefined ? 'notification' : 'request',
                });
                if (message.method === 'resources/subscribe') {
                    const uri = message.params?.uri;
                    if (uri) {
                        session.subscriptions.add(uri);
                    }
                    requestLogger.info('complete', {
                        method,
                        route,
                        sessionId,
                        ...authFields,
                        rpcMethod: message.method,
                        rpcToolName: rpcToolName || null,
                        rpcId: message.id ?? null,
                        status: 200,
                        elapsedMs: Date.now() - startedAt,
                    });
                    return c.json({ jsonrpc: '2.0', result: {}, id: message.id ?? null });
                }
                if (message.method === 'resources/unsubscribe') {
                    const uri = message.params?.uri;
                    if (uri) {
                        session.subscriptions.delete(uri);
                    }
                    requestLogger.info('complete', {
                        method,
                        route,
                        sessionId,
                        ...authFields,
                        rpcMethod: message.method,
                        rpcToolName: rpcToolName || null,
                        rpcId: message.id ?? null,
                        status: 200,
                        elapsedMs: Date.now() - startedAt,
                    });
                    return c.json({ jsonrpc: '2.0', result: {}, id: message.id ?? null });
                }
                if (message.method === 'notifications/initialized') {
                    requestLogger.info('complete', {
                        method,
                        route,
                        sessionId,
                        ...authFields,
                        rpcMethod: message.method,
                        rpcToolName: rpcToolName || null,
                        rpcId: message.id ?? null,
                        status: 202,
                        elapsedMs: Date.now() - startedAt,
                    });
                    return c.body(null, 202);
                }
            } catch {
                // If parsing fails, let transport return the protocol-level error.
            }

            const session = await getOrCreateSession(sessionId, config.plansDir, contextDir, config);

            const transportStartedAt = Date.now();
            const requestAuthContext = (c.get('authContext') as AuthContext | undefined) ?? null;
            const response = await authContextStore.run(
                requestAuthContext,
                () => session.transport.handleRequest(c)
            );
            logPhaseTiming(requestLogger, debugEnabled, 'request.transport', {
                method,
                route,
                sessionId,
                rpcMethod: rpcMethod || '(unknown)',
                rpcToolName: rpcToolName || null,
                rpcId: rpcId ?? null,
                elapsedMs: Date.now() - transportStartedAt,
            });

            if (!response) {
                requestLogger.error('complete', {
                    method,
                    route,
                    sessionId,
                    ...authFields,
                    rpcMethod: rpcMethod || '(unknown)',
                    rpcToolName: rpcToolName || null,
                    rpcId: rpcId ?? null,
                    status: 500,
                    elapsedMs: Date.now() - startedAt,
                    error: 'No response from transport',
                });
                return jsonError(c, 500, 'MCP_TRANSPORT_ERROR', 'No response from transport');
            }

            const headers = new Headers(response.headers);
            headers.set('Mcp-Session-Id', sessionId);
            requestLogger.info('complete', {
                method,
                route,
                sessionId,
                ...authFields,
                rpcMethod: rpcMethod || '(unknown)',
                rpcToolName: rpcToolName || null,
                rpcId: rpcId ?? null,
                status: response.status,
                elapsedMs: Date.now() - startedAt,
            });
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        } catch (error) {
            if (error instanceof HTTPException) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    ...authFields,
                    status: error.status,
                    elapsedMs: Date.now() - startedAt,
                    rpcMethod: rpcMethod || '(unknown)',
                    rpcToolName: rpcToolName || null,
                    rpcId: rpcId ?? null,
                    error: error.message,
                });
                return error.getResponse();
            }
            logger.error('request.error', {
                method,
                route,
                ...authFields,
                status: 500,
                elapsedMs: Date.now() - startedAt,
                rpcMethod: rpcMethod || '(unknown)',
                rpcToolName: rpcToolName || null,
                rpcId: rpcId ?? null,
                error: error instanceof Error ? error.message : String(error),
            });
            return c.json(
                {
                    error: {
                        code: -32603,
                        message: 'Internal error',
                        data: error instanceof Error ? error.message : 'Unknown error',
                    },
                },
                500
            );
        }
    });

    app.get('/mcp', guardRoute('GET', '/mcp'), async (c: AppContext) => {
        const startedAt = Date.now();
        const method = 'GET';
        const route = '/mcp';
        const authContext = c.get('authContext');
        const authFields = {
            userId: authContext?.user_id || null,
            keyId: authContext?.key_id || null,
        };
        try {
            const sessionId = c.req.header('Mcp-Session-Id');
            if (!sessionId) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    ...authFields,
                    status: 400,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'missing_session',
                });
                return jsonError(c, 400, 'MISSING_SESSION_ID', 'Missing Mcp-Session-Id header');
            }

            const session = sessions.get(sessionId);
            if (!session) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    ...authFields,
                    status: 404,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'session_not_found',
                    sessionId,
                });
                return jsonError(c, 404, 'SESSION_NOT_FOUND', 'Session not found');
            }

            const response = await session.transport.handleRequest(c);
            if (!response) {
                requestLogger.error('complete', {
                    method,
                    route,
                    ...authFields,
                    status: 500,
                    elapsedMs: Date.now() - startedAt,
                    sessionId,
                    error: 'No SSE stream available',
                });
                return jsonError(c, 500, 'SSE_STREAM_MISSING', 'No SSE stream available');
            }
            requestLogger.info('complete', {
                method,
                route,
                ...authFields,
                status: response.status,
                elapsedMs: Date.now() - startedAt,
                sessionId,
            });
            return response;
        } catch (error) {
            if (error instanceof HTTPException) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    ...authFields,
                    status: error.status,
                    elapsedMs: Date.now() - startedAt,
                    error: error.message,
                });
                return error.getResponse();
            }
            logger.error('request.error', {
                method,
                route,
                ...authFields,
                status: 500,
                elapsedMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
            });
            return jsonError(c, 500, 'INTERNAL_ERROR', 'Internal error');
        }
    });

    app.delete('/mcp', guardRoute('DELETE', '/mcp'), async (c: AppContext) => {
        const startedAt = Date.now();
        const method = 'DELETE';
        const route = '/mcp';
        const authContext = c.get('authContext');
        const authFields = {
            userId: authContext?.user_id || null,
            keyId: authContext?.key_id || null,
        };
        try {
            const sessionId = c.req.header('Mcp-Session-Id');
            if (!sessionId) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    ...authFields,
                    status: 400,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'missing_session',
                });
                return jsonError(c, 400, 'MISSING_SESSION_ID', 'Missing Mcp-Session-Id header');
            }

            const session = sessions.get(sessionId);
            if (!session) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    ...authFields,
                    status: 404,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'session_not_found',
                    sessionId,
                });
                return jsonError(c, 404, 'SESSION_NOT_FOUND', 'Session not found');
            }

            const response = await session.transport.handleRequest(c);
            sessions.delete(sessionId);
            requestLogger.info('complete', {
                method,
                route,
                ...authFields,
                status: response?.status ?? 200,
                elapsedMs: Date.now() - startedAt,
                sessionId,
            });
            return response ?? c.body(null, 200);
        } catch (error) {
            if (error instanceof HTTPException) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    ...authFields,
                    status: error.status,
                    elapsedMs: Date.now() - startedAt,
                    error: error.message,
                });
                return error.getResponse();
            }
            logger.error('request.error', {
                method,
                route,
                ...authFields,
                status: 500,
                elapsedMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
            });
            return jsonError(c, 500, 'INTERNAL_ERROR', 'Internal error');
        }
    });

    const sessionTimeout = config.sessionTimeout || DEFAULT_SESSION_TIMEOUT;
    setInterval(() => {
        cleanupSessions(sessionTimeout);
    }, sessionTimeout / 2);

    function createRbacEngine(localConfig: ServerConfig): RbacEngine | null {
        if (localConfig.security?.secured !== true) {
            return null;
        }
        if (!localConfig.security.rbacUsersPath || !localConfig.security.rbacKeysPath) {
            throw new Error(
                'RBAC is enabled (secured=true), but rbacUsersPath or rbacKeysPath is not configured. Set RBAC_USERS_PATH and RBAC_KEYS_PATH.'
            );
        }
        return new RbacEngine(
            {
                usersPath: localConfig.security.rbacUsersPath,
                keysPath: localConfig.security.rbacKeysPath,
                policyPath: localConfig.security.rbacPolicyPath,
                reloadSeconds: localConfig.security.rbacReloadSeconds,
            },
            startupLogger
        );
    }

    function jsonError(c: AppContext, status: number, errorCode: string, message: string): Response {
        return c.json(
            {
                error_code: errorCode,
                message,
                request_id: c.get('requestId'),
            },
            status as 400 | 401 | 403 | 404 | 500
        );
    }

    function guardRoute(method: string, routePattern: string) {
        return async (c: AppContext, next: () => Promise<void>) => {
            const requirement = getRouteRequirement(method, routePattern);
            const requestId = c.get('requestId');
            const start = Date.now();
            if (!secured) {
                authLogger.info('audit', {
                    timestamp: new Date().toISOString(),
                    route: routePattern,
                    method,
                    request_id: requestId,
                    user_id: null,
                    key_id: null,
                    decision: 'allow',
                    reason: 'SECURED_DISABLED',
                    elapsedMs: Date.now() - start,
                });
                await next();
                return;
            }

            if (!rbacEngine) {
                authLogger.error('audit', {
                    timestamp: new Date().toISOString(),
                    route: routePattern,
                    method,
                    request_id: requestId,
                    user_id: null,
                    key_id: null,
                    decision: 'deny',
                    reason: 'SERVER_MISCONFIG',
                    elapsedMs: Date.now() - start,
                });
                return jsonError(c, 500, 'SERVER_MISCONFIG', 'RBAC is enabled but not initialized');
            }

            if (!requirement) {
                authLogger.warning('audit', {
                    timestamp: new Date().toISOString(),
                    route: routePattern,
                    method,
                    request_id: requestId,
                    user_id: null,
                    key_id: null,
                    decision: 'deny',
                    reason: 'POLICY_DENY',
                    elapsedMs: Date.now() - start,
                });
                return jsonError(c, 403, 'FORBIDDEN', 'No matching RBAC policy rule for endpoint');
            }

            if (requirement.public) {
                authLogger.info('audit', {
                    timestamp: new Date().toISOString(),
                    route: routePattern,
                    method,
                    request_id: requestId,
                    user_id: null,
                    key_id: null,
                    decision: 'allow',
                    reason: 'PUBLIC',
                    policy_source: requirement.source,
                    elapsedMs: Date.now() - start,
                });
                await next();
                return;
            }

            const apiKey = extractApiKeyFromHeaders(c.req.raw.headers);
            const auth = await rbacEngine.authenticate(apiKey);
            if (!auth.allowed || !auth.authContext) {
                authLogger.warning('audit', {
                    timestamp: new Date().toISOString(),
                    route: routePattern,
                    method,
                    request_id: requestId,
                    user_id: null,
                    key_id: null,
                    decision: 'deny',
                    reason: auth.reason,
                    policy_source: requirement.source,
                    elapsedMs: Date.now() - start,
                });
                if (auth.status === 500) {
                    return jsonError(c, 500, 'SERVER_MISCONFIG', 'RBAC authentication failed due to server misconfiguration');
                }
                return jsonError(c, 401, 'UNAUTHORIZED', 'Missing or invalid API key');
            }

            const authorization = rbacEngine.authorize(auth.authContext, requirement.anyRoles);
            if (!authorization.allowed) {
                authLogger.warning('audit', {
                    timestamp: new Date().toISOString(),
                    route: routePattern,
                    method,
                    request_id: requestId,
                    user_id: auth.authContext.user_id,
                    key_id: auth.authContext.key_id,
                    decision: 'deny',
                    reason: authorization.reason,
                    policy_source: requirement.source,
                    required_roles: requirement.anyRoles,
                    elapsedMs: Date.now() - start,
                });
                return jsonError(c, 403, 'FORBIDDEN', 'Authenticated, but missing required role');
            }

            c.set('authContext', auth.authContext);
            authLogger.info('audit', {
                timestamp: new Date().toISOString(),
                route: routePattern,
                method,
                request_id: requestId,
                user_id: auth.authContext.user_id,
                key_id: auth.authContext.key_id,
                decision: 'allow',
                reason: 'ALLOW',
                policy_source: requirement.source,
                required_roles: requirement.anyRoles,
                elapsedMs: Date.now() - start,
            });
            await next();
        };
    }

    function getRouteRequirement(method: string, routePattern: string): RouteRequirement | null {
        if (!rbacEngine) {
            return null;
        }
        return rbacEngine.getRouteRequirement(method, routePattern);
    }

    return app;
}

/**
 * Start the HTTP server
 */
export async function startServer(config: ServerConfig): Promise<void> {
    const app = createApp(config);
    const contextDir = resolveContextDir(config);
    const debugEnabled = config.debug === true || envDebugEnabled();
    installGcDiagnostics(debugEnabled);

    startupLogger.info('server.starting', {
        port: config.port,
        plansDir: config.plansDir,
        contextDir,
        cors: config.cors !== false,
        cloudEnabled: config.cloud?.enabled === true,
        secured: config.security?.secured === true,
        rbacUsersPath: config.security?.rbacUsersPath || null,
        rbacKeysPath: config.security?.rbacKeysPath || null,
        rbacPolicyPath: config.security?.rbacPolicyPath || null,
        rbacReloadSeconds: config.security?.rbacReloadSeconds ?? 0,
        debugMode: debugEnabled ? 'ON' : 'OFF',
        transport: 'hono',
        serverName: 'riotplan-http',
        healthEndpoint: `http://127.0.0.1:${config.port}/health`,
        mcpEndpoint: `http://127.0.0.1:${config.port}/mcp`,
    });
    if (debugEnabled) {
        startupLogger.info('debug.enabled', { source: 'debug config or RIOTPLAN_DEBUG' });
    }

    const { serve } = await import('@hono/node-server');

    serve(
        {
            fetch: app.fetch,
            port: config.port,
        },
        (info) => {
            startupLogger.info('server.listening', { url: `http://localhost:${info.port}`, port: info.port });
        }
    );
}

export function resolveContextDir(config: Pick<ServerConfig, 'plansDir' | 'contextDir'>): string {
    return config.contextDir || config.plansDir;
}
