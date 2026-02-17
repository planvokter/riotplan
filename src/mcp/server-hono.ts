/**
 * RiotPlan HTTP MCP Server
 *
 * Standalone HTTP MCP server using Hono framework.
 * Serves plan data via HTTP instead of stdio, following the Protokoll architecture pattern.
 *
 * This server provides:
 * - Session-per-connection model with StreamableHTTPTransport
 * - Standard MCP protocol routes (POST/GET/DELETE /mcp)
 * - Integration with riotplan-format StorageProvider
 * - Health check endpoint
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { StreamableHTTPTransport } from '@hono/mcp';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import { httpTools, getHttpTool } from './tools-http/index.js';
import type { HttpToolContext } from './tools-http/shared.js';

/**
 * Server configuration
 */
export interface ServerConfig {
    /** Port to listen on */
    port: number;
    /** Plans directory path */
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
 * Create a new MCP server instance for a session
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
                resources: {},
                prompts: {},
            },
        }
    );

    // Register HTTP MCP tools
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const tool = getHttpTool(request.params.name);

        if (!tool) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Unknown tool: ${request.params.name}`,
                    },
                ],
                isError: true,
            };
        }

        try {
            // Create tool context
            const context: HttpToolContext = {
                plansDir,
                sessionId,
                config,
            };

            // Execute tool
            const result = await tool.execute(request.params.arguments || {}, context);

            if (!result.success) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: result.error || 'Tool execution failed',
                        },
                    ],
                    isError: true,
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: error instanceof Error ? error.message : 'Unknown error',
                    },
                ],
                isError: true,
            };
        }
    });

    // List available tools
    server.setRequestHandler({ method: 'tools/list' }, async () => {
        return {
            tools: httpTools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: [],
                },
            })),
        };
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
        // Create new session
        const server = createMcpServer(plansDir, sessionId, config);
        const transport = new StreamableHTTPTransport();

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
        // Update last activity
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

    // Enable CORS for /mcp routes if configured
    if (config.cors !== false) {
        app.use('/mcp/*', cors());
    }

    // Health check endpoint
    app.get('/health', (c) => {
        return c.json({
            status: 'ok',
            service: 'riotplan-http',
            version: '1.0.0',
            sessions: sessions.size,
            plansDir: config.plansDir,
            tools: httpTools.length,
        });
    });

    // POST /mcp - JSON-RPC requests (all MCP protocol methods)
    app.post('/mcp', async (c: Context) => {
        try {
            // Get or generate session ID
            const sessionId = c.req.header('Mcp-Session-Id') || generateSessionId();
            const session = await getOrCreateSession(sessionId, config.plansDir, config);

            // Handle the request through the transport
            const result = await session.transport.handleRequest(c);

            // Set session ID header if this is a new session
            if (!c.req.header('Mcp-Session-Id')) {
                c.header('Mcp-Session-Id', sessionId);
            }

            return result;
        } catch (error) {
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

    // GET /mcp - SSE stream for notifications
    app.get('/mcp', (c: Context) => {
        const sessionId = c.req.header('Mcp-Session-Id');

        if (!sessionId) {
            return c.json({ error: 'Missing Mcp-Session-Id header' }, 400);
        }

        const session = sessions.get(sessionId);
        if (!session) {
            return c.json({ error: 'Session not found' }, 404);
        }

        return streamSSE(c, async (stream) => {
            try {
                // Send ping every 30 seconds to keep connection alive
                const pingInterval = setInterval(() => {
                    stream.writeSSE({
                        event: 'ping',
                        data: JSON.stringify({ timestamp: new Date().toISOString() }),
                    });
                }, 30000);

                // Wait for stream to close
                await stream.sleep(Number.MAX_SAFE_INTEGER);

                clearInterval(pingInterval);
            } catch (error) {
                console.error('[RiotPlan HTTP] Error in SSE stream:', error);
            }
        });
    });

    // DELETE /mcp - Session termination
    app.delete('/mcp', (c: Context) => {
        const sessionId = c.req.header('Mcp-Session-Id');

        if (!sessionId) {
            return c.json({ error: 'Missing Mcp-Session-Id header' }, 400);
        }

        const session = sessions.get(sessionId);
        if (session) {
            session.server.close();
            sessions.delete(sessionId);
            return c.json({ message: 'Session terminated' });
        }

        return c.json({ error: 'Session not found' }, 404);
    });

    // Start session cleanup interval
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
    console.error(`[RiotPlan HTTP] Plans directory: ${config.plansDir}`);
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
