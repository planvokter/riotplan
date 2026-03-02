/**
 * RiotPlan HTTP MCP Server
 *
 * Standalone HTTP MCP server using Hono framework.
 * Provides full parity with the stdio MCP server - all tools, resources, and prompts.
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
import type { Context } from 'hono';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { PerformanceObserver, constants as PerfConstants } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';
import { executeTool, tools } from './tools/index.js';
import { getResources, readResource } from './resources/index.js';
import { getPrompts, getPrompt } from './prompts/index.js';
import { resolveDirectory } from './tools/shared.js';
import { createCloudRuntime } from '../cloud/runtime.js';
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
const HttpLogger = Logging.getLogger('@kjerneverk/riotplan-http');
const logger = HttpLogger.get('server');
const requestLogger = HttpLogger.get('request');
const toolLogger = HttpLogger.get('tool');
const resourceLogger = HttpLogger.get('resource');
const sessionLogger = HttpLogger.get('session');
const startupLogger = HttpLogger.get('startup');
const gcLogger = HttpLogger.get('gc');
const SLOW_PHASE_MS = 200;
const MEMORY_SNAPSHOT_INTERVAL_MS = 30_000;

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
    const nonMutating = new Set([
        'riotplan_status',
        'riotplan_read_context',
        'riotplan_list_plans',
        'riotplan_history_show',
        'riotplan_validate',
        'riotplan_resolve_project_context',
        'riotplan_get_project_binding',
        'riotplan_catalyst',
        'riotplan_checkpoint',
    ]);
    if (nonMutating.has(toolName)) {
        return false;
    }
    return true;
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
    // Tools - full parity with stdio, context.workingDirectory = plansDir
    // ========================================================================

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const tool = tools.find((t) => t.name === toolName);
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
                    const cloudRuntime = await createCloudRuntime(
                        { cloud: config.cloud } as any,
                        plansDir,
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
            const result = await executeTool(toolName, request.params.arguments || {}, context);
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
            const textContent =
                result.data !== undefined
                    ? JSON.stringify(result.data, null, 2)
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
        const startedAt = Date.now();
        const syncRunId = randomUUID();
        resourceLogger.info('read.start', { sessionId, uri, syncRunId });
        try {
            const cloudRuntimeStartedAt = Date.now();
            const cloudRuntime = await createCloudRuntime(
                { cloud: config.cloud } as any,
                plansDir,
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
export function createApp(config: ServerConfig): Hono {
    const app = new Hono();
    const contextDir = resolveContextDir(config);

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

    app.get('/plan/:planId', async (c) => {
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
                return c.json({ error: 'Missing planId' }, 400);
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
                return c.json({ error: 'Resolved plan is not a .plan file' }, 400);
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
                return c.json({ error: message }, 404);
            }
            requestLogger.error('complete', {
                method,
                route,
                status: 500,
                elapsedMs: Date.now() - startedAt,
                error: message,
            });
            return c.json({ error: 'Failed to download plan', details: message }, 500);
        }
    });

    app.post('/plan/upload', async (c) => {
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
                return c.json({ error: 'No .plan file provided in multipart field "plan"' }, 400);
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
                return c.json({ error: 'Uploaded file must have .plan extension' }, 400);
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
            return c.json({ error: 'Failed to upload plan', details: message }, 500);
        }
    });

    app.post('/mcp', async (c: Context) => {
        const startedAt = Date.now();
        const method = 'POST';
        const route = '/mcp';
        const debugEnabled = config.debug === true || envDebugEnabled();
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
            const response = await session.transport.handleRequest(c);
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
                    rpcMethod: rpcMethod || '(unknown)',
                    rpcToolName: rpcToolName || null,
                    rpcId: rpcId ?? null,
                    status: 500,
                    elapsedMs: Date.now() - startedAt,
                    error: 'No response from transport',
                });
                return c.json({ error: { code: -32603, message: 'No response from transport' } }, 500);
            }

            const headers = new Headers(response.headers);
            headers.set('Mcp-Session-Id', sessionId);
            requestLogger.info('complete', {
                method,
                route,
                sessionId,
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

    app.get('/mcp', async (c: Context) => {
        const startedAt = Date.now();
        const method = 'GET';
        const route = '/mcp';
        try {
            const sessionId = c.req.header('Mcp-Session-Id');
            if (!sessionId) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 400,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'missing_session',
                });
                return c.json({ error: 'Missing Mcp-Session-Id header' }, 400);
            }

            const session = sessions.get(sessionId);
            if (!session) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 404,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'session_not_found',
                    sessionId,
                });
                return c.json({ error: 'Session not found' }, 404);
            }

            const response = await session.transport.handleRequest(c);
            if (!response) {
                requestLogger.error('complete', {
                    method,
                    route,
                    status: 500,
                    elapsedMs: Date.now() - startedAt,
                    sessionId,
                    error: 'No SSE stream available',
                });
                return c.json({ error: 'No SSE stream available' }, 500);
            }
            requestLogger.info('complete', {
                method,
                route,
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
                    status: error.status,
                    elapsedMs: Date.now() - startedAt,
                    error: error.message,
                });
                return error.getResponse();
            }
            logger.error('request.error', {
                method,
                route,
                status: 500,
                elapsedMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
            });
            return c.json({ error: 'Internal error' }, 500);
        }
    });

    app.delete('/mcp', async (c: Context) => {
        const startedAt = Date.now();
        const method = 'DELETE';
        const route = '/mcp';
        try {
            const sessionId = c.req.header('Mcp-Session-Id');
            if (!sessionId) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 400,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'missing_session',
                });
                return c.json({ error: 'Missing Mcp-Session-Id header' }, 400);
            }

            const session = sessions.get(sessionId);
            if (!session) {
                requestLogger.warning('complete', {
                    method,
                    route,
                    status: 404,
                    elapsedMs: Date.now() - startedAt,
                    reason: 'session_not_found',
                    sessionId,
                });
                return c.json({ error: 'Session not found' }, 404);
            }

            const response = await session.transport.handleRequest(c);
            sessions.delete(sessionId);
            requestLogger.info('complete', {
                method,
                route,
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
                    status: error.status,
                    elapsedMs: Date.now() - startedAt,
                    error: error.message,
                });
                return error.getResponse();
            }
            logger.error('request.error', {
                method,
                route,
                status: 500,
                elapsedMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
            });
            return c.json({ error: 'Internal error' }, 500);
        }
    });

    const sessionTimeout = config.sessionTimeout || DEFAULT_SESSION_TIMEOUT;
    setInterval(() => {
        cleanupSessions(sessionTimeout);
    }, sessionTimeout / 2);

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
