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
import { executeTool } from './tools/index.js';
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
    registerTool(
        'riotplan_create',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Create a new plan with AI generation. Generates detailed, actionable plans from descriptions.',
        {
            code: z.string(),
            name: z.string().optional(),
            description: z.string(),
            directory: z.string().optional(),
            steps: z.number().optional(),
            direct: z.boolean().optional(),
            provider: z.string().optional(),
            model: z.string().optional(),
            noAi: z.boolean().optional(),
        }
    );

    registerTool(
        'riotplan_status',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Show current plan status including progress, current step, blockers, and issues.',
        {
            path: z.string().optional(),
            verbose: z.boolean().optional(),
        }
    );

    registerTool(
        'riotplan_step_list',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. List all steps in a plan with their status. Can filter to show only pending or all steps.',
        {
            path: z.string().optional(),
            pending: z.boolean().optional(),
            all: z.boolean().optional(),
        }
    );

    registerTool(
        'riotplan_step_start',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Mark a step as started. Updates STATUS.md to reflect the step is in progress.',
        {
            path: z.string().optional(),
            step: z.number(),
        }
    );

    registerTool(
        'riotplan_step_complete',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Mark a step as completed. Updates STATUS.md to reflect the step is done.',
        {
            path: z.string().optional(),
            step: z.number(),
        }
    );

    registerTool(
        'riotplan_step_add',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add a new step to the plan. Can specify position or add after a specific step.',
        {
            path: z.string().optional(),
            title: z.string(),
            number: z.number().optional(),
            after: z.number().optional(),
        }
    );

    registerTool(
        'riotplan_validate',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Validate plan structure and files. Checks for required files, valid STATUS.md, step numbering, and dependencies.',
        {
            path: z.string().optional(),
            fix: z.boolean().optional(),
        }
    );

    registerTool(
        'riotplan_generate',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Generate plan content from an existing prompt file. Useful for regenerating plan files.',
        {
            path: z.string().optional(),
            steps: z.number().optional(),
            provider: z.string().optional(),
            model: z.string().optional(),
        }
    );

    // Idea stage tools
    registerTool(
        'riotplan_idea_create',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Create a new idea without commitment. Start exploring a concept in the Idea stage.',
        {
            code: z.string(),
            description: z.string(),
            directory: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_idea_add_note',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add a note to an idea. Capture thoughts and observations during exploration.',
        {
            note: z.string(),
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_idea_add_constraint',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add a constraint to an idea. Document limitations and requirements.',
        {
            constraint: z.string(),
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_idea_add_question',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add a question to an idea. Raise uncertainties that need resolution.',
        {
            question: z.string(),
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_idea_add_evidence',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add evidence to an idea. Attach supporting materials like diagrams, documents, or examples.',
        {
            evidencePath: z.string().optional(),
            description: z.string(),
            path: z.string().optional(),
            content: z.string().optional(),
            source: z.string().optional(),
            sourceUrl: z.string().optional(),
            originalQuery: z.string().optional(),
            gatheringMethod: z.enum(["manual", "model-assisted"]).optional(),
            relevanceScore: z.number().min(0).max(1).optional(),
            summary: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_idea_add_narrative',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add raw narrative content to the timeline. Use this to capture conversational context, thinking-out-loud, or any free-form input that doesn\'t fit structured categories. Narrative chunks preserve full-fidelity context.',
        {
            content: z.string(),
            path: z.string().optional(),
            source: z.enum(["typing", "voice", "paste", "import"]).optional(),
            context: z.string().optional(),
            speaker: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_idea_kill',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Kill an idea. Abandon the idea with a reason, preserving the learning.',
        {
            reason: z.string(),
            path: z.string().optional(),
        }
    );

    // Shaping stage tools
    registerTool(
        'riotplan_shaping_start',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Start shaping an idea. Move from Idea to Shaping stage to explore approaches.',
        {
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_shaping_add_approach',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add an approach to consider. Propose a way to solve the problem with explicit tradeoffs.',
        {
            name: z.string(),
            description: z.string(),
            tradeoffs: z.array(z.string()),
            assumptions: z.array(z.string()).optional(),
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_shaping_add_feedback',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add feedback on an approach. Provide observations, concerns, or suggestions.',
        {
            approach: z.string(),
            feedback: z.string(),
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_shaping_add_evidence',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Add evidence for an approach. Attach supporting materials that inform the decision.',
        {
            approach: z.string(),
            evidencePath: z.string().optional(),
            description: z.string(),
            path: z.string().optional(),
            content: z.string().optional(),
            source: z.string().optional(),
            sourceUrl: z.string().optional(),
            originalQuery: z.string().optional(),
            gatheringMethod: z.enum(["manual", "model-assisted"]).optional(),
            relevanceScore: z.number().min(0).max(1).optional(),
            summary: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_shaping_compare',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Compare all approaches. Generate a side-by-side comparison of tradeoffs.',
        {
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_shaping_select',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Select an approach. Choose the best approach and move to Built stage.',
        {
            approach: z.string(),
            reason: z.string(),
            path: z.string().optional(),
        }
    );

    // History and checkpoint tools
    registerTool(
        'riotplan_checkpoint_create',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Create a checkpoint. Save a snapshot of the current state with prompt context.',
        {
            name: z.string(),
            message: z.string(),
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_checkpoint_list',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. List all checkpoints. Show all saved checkpoints with timestamps.',
        {
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_checkpoint_show',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Show checkpoint details. Display the full checkpoint snapshot and prompt context.',
        {
            checkpoint: z.string(),
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_checkpoint_restore',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Restore a checkpoint. Revert to a previous state.',
        {
            checkpoint: z.string(),
            path: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_history_show',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Show ideation history. Display the complete timeline of events.',
        {
            path: z.string().optional(),
            limit: z.number().optional(),
            sinceCheckpoint: z.string().optional(),
        }
    );

    registerTool(
        'riotplan_generate_rule',
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. Generate a Cursor rule file that configures the IDE to defer to RiotPlan for planning. Creates .cursor/rules/riotplan.md in the target project.',
        {
            projectPath: z.string().optional(),
            force: z.boolean().optional(),
        }
    );

    registerTool(
        'riotplan_read_context',
        '[RiotPlan] Load all plan artifacts in a single call for stage transitions. ' +
            'Returns IDEA.md content, SHAPING.md content (if exists), evidence file list with previews, ' +
            'recent history events, and extracted constraints/questions. ' +
            'Use this at stage transitions to ensure you have full context before proceeding. ' +
            'The plan files are the source of truth - do not rely on conversation memory alone.',
        {
            path: z.string().optional(),
            depth: z.enum(['summary', 'full']).optional(),
        }
    );

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
