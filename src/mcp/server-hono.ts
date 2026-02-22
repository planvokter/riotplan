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
import { executeTool, tools } from './tools/index.js';
import { getResources, readResource } from './resources/index.js';
import { getPrompts, getPrompt } from './prompts/index.js';

/**
 * Server configuration
 */
export interface ServerConfig {
    /** Port to listen on */
    port: number;
    /** Plans directory path - single source of truth for all plan operations */
    plansDir: string;
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
    /** Session creation time */
    createdAt: Date;
    /** Last activity time */
    lastActivity: Date;
}

/**
 * Active sessions map
 */
const sessions = new Map<string, SessionContext>();

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
function createMcpServer(plansDir: string, sessionId: string, config: ServerConfig): Server {
    const server = new Server(
        {
            name: 'riotplan-http',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
                resources: {
                    subscribe: false,
                    listChanged: false,
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

        if (!tool) {
            return {
                content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
                isError: true,
            };
        }

        try {
            const context = {
                workingDirectory: plansDir,
                config: undefined,
                logger: undefined,
            };

            const result = await executeTool(toolName, request.params.arguments || {}, context);

            if (!result.success) {
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

            return { content };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
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
    config: ServerConfig
): Promise<SessionContext> {
    let session = sessions.get(sessionId);

    if (!session) {
        const server = createMcpServer(plansDir, sessionId, config);
        const transport = new StreamableHTTPTransport({ enableJsonResponse: true });

        await server.connect(transport);

        session = {
            id: sessionId,
            server,
            transport,
            plansDir,
            createdAt: new Date(),
            lastActivity: new Date(),
        };

        sessions.set(sessionId, session);
    } else {
        session.lastActivity = new Date();
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

    if (config.cors !== false) {
        app.use('/mcp/*', cors());
    }

    app.get('/health', (c) => {
        return c.json({
            status: 'ok',
            service: 'riotplan-http',
            version: '1.0.0',
            sessions: sessions.size,
            plansDir: config.plansDir,
            tools: tools.length,
            resources: getResources().length,
            prompts: getPrompts().length,
        });
    });

    app.post('/mcp', async (c: Context) => {
        try {
            const sessionId = c.req.header('Mcp-Session-Id') || generateSessionId();
            const session = await getOrCreateSession(sessionId, config.plansDir, config);

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

    console.error(`[RiotPlan HTTP] Starting server on port ${config.port}`);
    console.error(`[RiotPlan HTTP] Plans directory: ${config.plansDir} (single source of truth)`);
    console.error(`[RiotPlan HTTP] CORS: ${config.cors !== false ? 'enabled' : 'disabled'}`);

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
