#!/usr/bin/env node
/**
 * RiotPlan MCP Server
 *
 * Exposes riotplan commands, resources, and prompts via MCP.
 *
 * This server provides:
 * - Tools: Plan management commands (create, status, step operations, etc.)
 * - Resources: Plan data, status, steps, and step content
 * - Prompts: Workflow templates for plan creation and execution
 *
 * Uses McpServer high-level API for better progress notification support
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { executeTool, tools } from './tools/index.js';
import { getResources, readResource } from './resources/index.js';
import { getPrompts, getPrompt } from './prompts/index.js';
import { resolvePlanDirectory } from '../config/index.js';
import { createSessionManager, generateSessionId } from './session/index.js';
import { generateHeartbeat } from './heartbeat.js';

/**
 * Recursively remove undefined values from an object to prevent JSON serialization issues
 * Preserves null values as they are valid in JSON
 */
function removeUndefinedValues(obj: any): any {
    if (obj === undefined) {
        return undefined;
    }
    if (obj === null) {
        return null;
    }
    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedValues).filter(item => item !== undefined);
    }
    if (typeof obj === 'object') {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            const cleanedValue = removeUndefinedValues(value);
            if (cleanedValue !== undefined) {
                cleaned[key] = cleanedValue;
            }
        }
        return cleaned;
    }
    return obj;
}

async function main() {
    // Mark that we're running as MCP server
    process.env.RIOTPLAN_MCP_SERVER = 'true';
    
    // Initialize session manager for tracking client capabilities
    const sessionManager = createSessionManager({ debug: false });
    
    // For STDIO transport, we have a single session
    // Generate session ID that will be used for the connection
    const sessionId = generateSessionId();
    
    // Create initial session context (will be populated during initialization)
    // For now, we create a placeholder that assumes STDIO transport
    // The McpServer API doesn't expose initialization hooks, so we'll
    // create the session with default capabilities and update if needed
    // 
    // WORKAROUND: Assume sampling capability is available when running via MCP
    // This allows FastMCP tests to work. In the future, we should switch to
    // the lower-level Server API to properly intercept the initialize request.
    const currentSession = sessionManager.createSession(
        sessionId,
        'stdio',
        {
            params: {
                protocolVersion: '2025-11-25',
                capabilities: {
                    sampling: {}, // Assume sampling is available
                },
                clientInfo: {
                    name: 'unknown',
                    version: '0.0.0',
                },
            }
        }
    );

    // Suppress stdout to prevent pollution of MCP JSON-RPC stream
    // MCP uses stdio for communication, so any stdout output will corrupt the protocol
    // We capture ALL stdout writes and redirect non-JSON-RPC messages to stderr
    // This is critical because dependencies (like CardiganTime) may output to stdout
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    
    process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
        const str = typeof chunk === 'string' ? chunk : chunk.toString();
        // Allow JSON-RPC messages through (they start with { and contain "jsonrpc")
        // This preserves the MCP protocol while filtering out spurious stdout output
        if (str.trimStart().startsWith('{') && str.includes('"jsonrpc"')) {
            return originalStdoutWrite(chunk, encoding, callback);
        }
        // Redirect everything else to stderr to prevent protocol corruption
        return process.stderr.write(chunk, encoding, callback);
    };

    // Set up error logging for MCP server
    const logError = (context: string, error: unknown) => {
        const timestamp = new Date().toISOString();
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        // Log to stderr for MCP debugging
        // eslint-disable-next-line no-console
        console.error(`[${timestamp}] RiotPlan MCP Error (${context}):`, errorMessage);
        if (errorStack) {
            // eslint-disable-next-line no-console
            console.error('Stack:', errorStack);
        }
    };

    // Initialize MCP server with high-level API
    const server = new McpServer(
        {
            name: 'riotplan',
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
    // Sampling Support: Wire up client capabilities and sampling client
    // ========================================================================

    // Create sampling client wrapper that provides the sendRequest() interface
    // expected by SamplingProvider. Delegates to the Server's createMessage()
    // method which sends sampling/createMessage requests back to the MCP client.
    const samplingClient = {
        sendRequest: async (method: string, params: any) => {
            if (method === 'sampling/createMessage') {
                return await server.server.createMessage(params);
            }
            throw new Error(`Unsupported sampling method: ${method}`);
        }
    };

    // After MCP initialization handshake completes, update session with real
    // client capabilities (replacing the placeholder defaults set above).
    // The initialize request contains the client's actual capability declarations.
    server.server.oninitialized = () => {
        const clientCapabilities = server.server.getClientCapabilities();
        const clientVersion = server.server.getClientVersion();

        if (clientCapabilities) {
            currentSession.capabilities = clientCapabilities as any;
            currentSession.samplingAvailable = clientCapabilities.sampling !== undefined;
        }
        if (clientVersion) {
            currentSession.clientInfo = clientVersion as any;
        }

        // Re-determine provider mode based on actual client capabilities
        if (currentSession.samplingAvailable) {
            currentSession.providerMode = 'sampling';
        } else if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY) {
            currentSession.providerMode = 'direct';
        } else {
            currentSession.providerMode = 'none';
        }

        // eslint-disable-next-line no-console
        console.error(
            `[RiotPlan] Session initialized:`,
            `client=${currentSession.clientInfo?.name ?? 'unknown'}`,
            `v${currentSession.clientInfo?.version ?? 'unknown'},`,
            `sampling=${currentSession.samplingAvailable},`,
            `mode=${currentSession.providerMode}`
        );
    };

    // ========================================================================
    // Tools Handlers
    // ========================================================================

    /**
     * Helper to register a tool with progress notification support
     */
    function registerTool(
        name: string,
        description: string,
        inputSchema: z.ZodRawShape
    ) {
        server.tool(
            name,
            description,
            inputSchema,
            async (args, { sendNotification, _meta }) => {
                try {
                    // Update session activity
                    sessionManager.updateActivity(sessionId);
                    
                    // Resolve plan directory using four-tier strategy
                    const planDirectory = await resolvePlanDirectory();
                    
                    const context = {
                        workingDirectory: planDirectory,
                        config: undefined,
                        logger: undefined,
                        session: currentSession,  // Add session context for provider loading
                        mcpServer: samplingClient,  // Sampling client wrapper with sendRequest()
                        sendNotification: async (notification: {
                            method: string;
                            params: {
                                progressToken?: string | number;
                                progress: number;
                                total?: number;
                                message?: string;
                            };
                        }) => {
                            if (notification.method === 'notifications/progress' && _meta?.progressToken) {
                                const params: Record<string, any> = {
                                    progressToken: _meta.progressToken,
                                    progress: notification.params.progress,
                                };
                                if (notification.params.total !== undefined) {
                                    params.total = notification.params.total;
                                }
                                if (notification.params.message !== undefined) {
                                    params.message = notification.params.message;
                                }
                                await sendNotification({
                                    method: 'notifications/progress',
                                    params: removeUndefinedValues(params) as any,
                                });
                            }
                        },
                        progressToken: _meta?.progressToken,
                    };

                    const result = await executeTool(name, args, context);

                    if (result.success) {
                        const content: Array<{ type: 'text'; text: string }> = [];

                        if (result.logs && result.logs.length > 0) {
                            content.push({
                                type: 'text' as const,
                                text: '=== Command Output ===\n' + result.logs.join('\n') + '\n\n=== Result ===',
                            });
                        }

                        const cleanData = removeUndefinedValues(result.data);
                        const textContent = cleanData !== undefined 
                            ? JSON.stringify(cleanData, null, 2)
                            : result.message || 'Success';
                        
                        content.push({
                            type: 'text' as const,
                            text: textContent,
                        });

                        // Append heartbeat footer with plan context
                        try {
                            const heartbeat = await generateHeartbeat(planDirectory);
                            if (heartbeat) {
                                content.push({
                                    type: 'text' as const,
                                    text: heartbeat,
                                });
                            }
                        } catch {
                            // Heartbeat failure should never break tool response
                        }

                        return { content };
                    } else {
                        const errorParts: string[] = [];

                        if (result.logs && result.logs.length > 0) {
                            errorParts.push('=== Command Output ===');
                            errorParts.push(result.logs.join('\n'));
                            errorParts.push('\n=== Error ===');
                        }

                        errorParts.push(result.error || 'Unknown error');

                        if (result.context && typeof result.context === 'object') {
                            errorParts.push('\n=== Context ===');
                            for (const [key, value] of Object.entries(result.context)) {
                                if (value !== undefined && value !== null) {
                                    errorParts.push(`${key}: ${String(value)}`);
                                }
                            }
                        }

                        if (result.details) {
                            if (result.details.stderr && result.details.stderr.trim()) {
                                errorParts.push('\n=== STDERR ===');
                                errorParts.push(result.details.stderr);
                            }
                            if (result.details.stdout && result.details.stdout.trim()) {
                                errorParts.push('\n=== STDOUT ===');
                                errorParts.push(result.details.stdout);
                            }
                        }

                        if (result.recovery && result.recovery.length > 0) {
                            errorParts.push('\n=== Recovery Steps ===');
                            errorParts.push(...result.recovery.map((step, i) => `${i + 1}. ${step}`));
                        }

                        return {
                            content: [{
                                type: 'text' as const,
                                text: errorParts.join('\n'),
                            }],
                            isError: true,
                        };
                    }
                } catch (error) {
                    // Catch any unhandled errors in tool execution
                    logError(`tool:${name}`, error);
                    
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;
                    
                    return {
                        content: [{
                            type: 'text' as const,
                            text: `=== Unhandled Error in ${name} ===\n\n${errorMessage}\n\n${errorStack ? `Stack:\n${errorStack}` : ''}`,
                        }],
                        isError: true,
                    };
                }
            }
        );
    }

    // Register all tools
    for (const tool of tools) {
        registerTool(tool.name, tool.description, tool.schema);
    }

    // ========================================================================
    // Resources Handlers
    // ========================================================================

    const resources = getResources();
    for (const resource of resources) {
        server.resource(
            resource.name,
            resource.uri,
            {
                description: resource.description || '',
            },
            async () => {
                const data = await readResource(resource.uri);
                return {
                    contents: [{
                        uri: resource.uri,
                        mimeType: resource.mimeType || 'application/json',
                        text: JSON.stringify(data, null, 2),
                    }],
                };
            }
        );
    }

    // ========================================================================
    // Prompts Handlers
    // ========================================================================

    const prompts = getPrompts();
    for (const prompt of prompts) {
        const promptArgs: Record<string, z.ZodTypeAny> = {};
        if (prompt.arguments) {
            for (const arg of prompt.arguments) {
                promptArgs[arg.name] = arg.required ? z.string() : z.string().optional();
            }
        }
        server.prompt(
            prompt.name,
            prompt.description,
            promptArgs,
            async (args, _extra) => {
                const argsRecord: Record<string, string> = {};
                for (const [key, value] of Object.entries(args)) {
                    if (typeof value === 'string') {
                        argsRecord[key] = value;
                    }
                }
                const messages = await getPrompt(prompt.name, argsRecord);
                return {
                    messages: messages.map(msg => {
                        if (msg.content.type === 'text') {
                            return {
                                role: msg.role,
                                content: {
                                    type: 'text' as const,
                                    text: msg.content.text || '',
                                },
                            };
                        }
                        return msg as any;
                    }),
                };
            }
        );
    }

    // ========================================================================
    // Start Server
    // ========================================================================

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

// Set up global error handlers for better resilience
process.on('uncaughtException', (error) => {
    // eslint-disable-next-line no-console
    console.error('[RiotPlan MCP] Uncaught Exception:', error.message);
    // eslint-disable-next-line no-console
    console.error('Stack:', error.stack);
    // Don't exit - try to keep server running
});

process.on('unhandledRejection', (reason, promise) => {
    // eslint-disable-next-line no-console
    console.error('[RiotPlan MCP] Unhandled Rejection at:', promise);
    // eslint-disable-next-line no-console
    console.error('Reason:', reason);
    // Don't exit - try to keep server running
});

// Handle errors with better logging
main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[RiotPlan MCP] Fatal error during startup:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
        // eslint-disable-next-line no-console
        console.error('Stack:', error.stack);
    }
    process.exit(1);
});
