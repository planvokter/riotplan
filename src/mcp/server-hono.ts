/**
 * RiotPlan HTTP MCP Server
 *
 * Standalone HTTP MCP server using Hono framework.
 * Provides full parity with the stdio MCP server - all tools, resources, and prompts.
 *
 * CRITICAL: In HTTP/remote mode, everything flows from plansDir configuration.
 * No config discovery or directory derivation - tools only process plan information.
 */
/* eslint-disable no-console */

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
import { executeTool, tools } from './tools/index.js';
import { getResources, readResource } from './resources/index.js';
import { getPrompts, getPrompt } from './prompts/index.js';
import { resolveDirectory } from './tools/shared.js';

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

function envDebugEnabled(): boolean {
    return TRUTHY_RE.test(process.env.RIOTPLAN_DEBUG || '') || TRUTHY_RE.test(process.env.RIOTPLAN_HTTP_DEBUG || '');
}

function debugLog(enabled: boolean, message: string, details?: unknown): void {
    if (!enabled) {
        return;
    }
    if (details === undefined) {
        console.error(`[RiotPlan HTTP][debug] ${message}`);
        return;
    }
    try {
        console.error(`[RiotPlan HTTP][debug] ${message} ${JSON.stringify(details)}`);
    } catch {
        console.error(`[RiotPlan HTTP][debug] ${message}`);
    }
}

function formatIncomingParams(params: unknown): string {
    if (params === undefined || params === null) {
        return '(none)';
    }
    if (typeof params === 'object' && !Array.isArray(params) && Object.keys(params as Record<string, unknown>).length === 0) {
        return '(none)';
    }
    try {
        return JSON.stringify(params, null, 2);
    } catch {
        return '(unserializable)';
    }
}

function logIncomingJsonRpcMessage(
    enabled: boolean,
    sessionId: string,
    message: { method?: string; id?: string | number | null; params?: unknown }
): void {
    if (!enabled || !message.method) {
        return;
    }
    const kind = message.id === undefined ? 'NOTIFICATION' : 'REQUEST';
    const separator = '-----------------------------------------------------------------';
    console.error('');
    console.error(separator);
    console.error(`Incoming ${kind}`);
    console.error(separator);
    console.error(`Method:     ${message.method}`);
    console.error(`ID:         ${message.id === undefined ? '(none)' : String(message.id)}`);
    console.error(`Session:    ${sessionId}`);
    console.error(`Parameters: ${formatIncomingParams(message.params)}`);
    console.error(separator);
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
        debugLog(debugEnabled, 'tool.call.start', {
            sessionId,
            tool: toolName,
            argKeys: Object.keys(request.params.arguments || {}),
        });

        if (!tool) {
            debugLog(debugEnabled, 'tool.call.unknown', { sessionId, tool: toolName });
            return {
                content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
                isError: true,
            };
        }

        try {
            const context = {
                workingDirectory: plansDir,
                contextDir,
                config: undefined,
                logger: undefined,
            };

            const result = await executeTool(toolName, request.params.arguments || {}, context);

            if (!result.success) {
                debugLog(debugEnabled, 'tool.call.error', {
                    sessionId,
                    tool: toolName,
                    elapsedMs: Date.now() - startedAt,
                    error: result.error || 'Tool execution failed',
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
            debugLog(debugEnabled, 'tool.call.success', {
                sessionId,
                tool: toolName,
                elapsedMs: Date.now() - startedAt,
            });

            return { content };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            debugLog(debugEnabled, 'tool.call.unhandled', {
                sessionId,
                tool: toolName,
                elapsedMs: Date.now() - startedAt,
                error: msg,
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
        debugLog(debugEnabled, 'resource.read.start', { sessionId, uri });
        try {
            const data = await readResource(uri, plansDir);
            const resource = resources.find((r) => {
                const base = r.uri.split('{')[0];
                return uri.startsWith(base);
            });
            const mimeType = resource?.mimeType || 'application/json';
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
            debugLog(debugEnabled, 'resource.read.error', {
                sessionId,
                uri,
                elapsedMs: Date.now() - startedAt,
                error: msg,
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
        debugLog(debugEnabled, 'session.created', { sessionId, plansDir, contextDir });
    } else {
        session.lastActivity = new Date();
        debugLog(debugEnabled, 'session.reused', { sessionId });
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
        console.error(`[RiotPlan HTTP] Cleaned up ${expiredSessions.length} expired sessions`);
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
        try {
            const planId = c.req.param('planId');
            if (!planId) {
                return c.json({ error: 'Missing planId' }, 400);
            }

            const decodedPlanId = decodeURIComponent(planId);
            const planPath = resolveDirectory({ planId: decodedPlanId }, { workingDirectory: config.plansDir });
            if (!planPath.endsWith('.plan')) {
                return c.json({ error: 'Resolved plan is not a .plan file' }, 400);
            }

            const planStats = await stat(planPath);
            const fileName = basename(planPath);
            c.header('Content-Type', 'application/octet-stream');
            c.header('Content-Length', String(planStats.size));
            c.header('Content-Disposition', `attachment; filename="${fileName}"`);
            return c.body(createReadStream(planPath) as any);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes('plan not found')) {
                return c.json({ error: message }, 404);
            }
            return c.json({ error: 'Failed to download plan', details: message }, 500);
        }
    });

    app.post('/plan/upload', async (c) => {
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
                return c.json({ error: 'No .plan file provided in multipart field "plan"' }, 400);
            }
            if (extname(upload.name).toLowerCase() !== '.plan') {
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

            return c.json({
                success: true,
                planId: targetName.replace(/\.plan$/i, ''),
                filename: targetName,
                path: targetPath,
                size: bytes.byteLength,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return c.json({ error: 'Failed to upload plan', details: message }, 500);
        }
    });

    app.post('/mcp', async (c: Context) => {
        try {
            const sessionId = c.req.header('Mcp-Session-Id') || generateSessionId();
            const debugEnabled = config.debug === true || envDebugEnabled();
            const session = await getOrCreateSession(sessionId, config.plansDir, contextDir, config);

            const bodyClone = c.req.raw.clone();
            try {
                const rawBody = await bodyClone.text();
                const message = JSON.parse(rawBody) as {
                    jsonrpc?: string;
                    method?: string;
                    id?: string | number | null;
                    params?: { uri?: string };
                };
                logIncomingJsonRpcMessage(debugEnabled, sessionId, message);
                if (message.method === 'resources/subscribe') {
                    const uri = message.params?.uri;
                    if (uri) {
                        session.subscriptions.add(uri);
                    }
                    return c.json({ jsonrpc: '2.0', result: {}, id: message.id ?? null });
                }
                if (message.method === 'resources/unsubscribe') {
                    const uri = message.params?.uri;
                    if (uri) {
                        session.subscriptions.delete(uri);
                    }
                    return c.json({ jsonrpc: '2.0', result: {}, id: message.id ?? null });
                }
                if (message.method === 'notifications/initialized') {
                    return c.body(null, 202);
                }
            } catch {
                // If parsing fails, let transport return the protocol-level error.
            }

            const response = await session.transport.handleRequest(c);

            if (!response) {
                return c.json({ error: { code: -32603, message: 'No response from transport' } }, 500);
            }

            const headers = new Headers(response.headers);
            headers.set('Mcp-Session-Id', sessionId);
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        } catch (error) {
            if (error instanceof HTTPException) {
                return error.getResponse();
            }
            console.error('[RiotPlan HTTP] Error handling POST /mcp:', error);
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
        try {
            const sessionId = c.req.header('Mcp-Session-Id');
            if (!sessionId) {
                return c.json({ error: 'Missing Mcp-Session-Id header' }, 400);
            }

            const session = sessions.get(sessionId);
            if (!session) {
                return c.json({ error: 'Session not found' }, 404);
            }

            const response = await session.transport.handleRequest(c);
            if (!response) {
                return c.json({ error: 'No SSE stream available' }, 500);
            }
            return response;
        } catch (error) {
            if (error instanceof HTTPException) {
                return error.getResponse();
            }
            console.error('[RiotPlan HTTP] Error handling GET /mcp:', error);
            return c.json({ error: 'Internal error' }, 500);
        }
    });

    app.delete('/mcp', async (c: Context) => {
        try {
            const sessionId = c.req.header('Mcp-Session-Id');
            if (!sessionId) {
                return c.json({ error: 'Missing Mcp-Session-Id header' }, 400);
            }

            const session = sessions.get(sessionId);
            if (!session) {
                return c.json({ error: 'Session not found' }, 404);
            }

            const response = await session.transport.handleRequest(c);
            sessions.delete(sessionId);
            return response ?? c.body(null, 200);
        } catch (error) {
            if (error instanceof HTTPException) {
                return error.getResponse();
            }
            console.error('[RiotPlan HTTP] Error handling DELETE /mcp:', error);
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

    console.error(`[RiotPlan HTTP] Starting server on port ${config.port}`);
    console.error(`[RiotPlan HTTP] Plans directory: ${config.plansDir} (single source of truth)`);
    console.error(`[RiotPlan HTTP] Context directory: ${contextDir}`);
    console.error(`[RiotPlan HTTP] CORS: ${config.cors !== false ? 'enabled' : 'disabled'}`);
    if (debugEnabled) {
        console.error('[RiotPlan HTTP] Debug logging enabled (debug config or RIOTPLAN_DEBUG)');
    }

    const { serve } = await import('@hono/node-server');

    serve(
        {
            fetch: app.fetch,
            port: config.port,
        },
        (info) => {
            console.error(`[RiotPlan HTTP] Server listening on http://localhost:${info.port}`);
        }
    );
}

export function resolveContextDir(config: Pick<ServerConfig, 'plansDir' | 'contextDir'>): string {
    return config.contextDir || config.plansDir;
}
