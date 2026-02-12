/**
 * Common CLI Agent Infrastructure
 * 
 * Shared utilities for all LLM-powered CLI commands.
 */

import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgentLoop, ToolRegistry, ConversationManager } from '@kjerneverk/agentic';
import type { AgentProvider, Tool } from '@kjerneverk/agentic';
import { createTerminal } from '../terminal.js';
import { createSessionManager } from '../session.js';
import { loadConfig } from '../../config/index.js';

// Import provider factories
import { createAnthropicProvider } from '@kjerneverk/execution-anthropic';
import { createOpenAIProvider } from '@kjerneverk/execution-openai';

/**
 * Provider configuration
 */
export interface ProviderConfig {
    provider: 'anthropic' | 'openai';
    apiKey: string;
    model: string;
}

/**
 * Agent session configuration
 */
export interface AgentSessionConfig {
    planPath: string;
    planName?: string;
    mode: string;
    systemPrompt: string;
    tools: Tool[];
    provider: ProviderConfig;
    /** Initial message to send to the agent (optional) */
    initialMessage?: string;
    /** Whether to show startup banner */
    showBanner?: boolean;
}

/**
 * Agent session result
 */
export interface AgentSessionResult {
    messages: number;
    toolCalls: number;
    duration: number;
    transcriptPath?: string;
}

/**
 * Detect which provider to use based on environment
 */
export function detectProvider(): { provider: 'anthropic' | 'openai'; apiKey: string } | null {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
        return { provider: 'anthropic', apiKey: anthropicKey };
    }
    if (openaiKey) {
        return { provider: 'openai', apiKey: openaiKey };
    }
    return null;
}

/**
 * Get default model for provider
 */
export function getDefaultModel(provider: 'anthropic' | 'openai'): string {
    if (provider === 'anthropic') {
        return 'claude-sonnet-4-20250514';
    }
    return 'gpt-4o';
}

/**
 * Create the LLM provider
 */
function createLLMProvider(providerName: 'anthropic' | 'openai') {
    if (providerName === 'anthropic') {
        return createAnthropicProvider();
    }
    return createOpenAIProvider();
}

/**
 * Resolve plan path from user input
 */
export async function resolvePlanPath(pathOrCode?: string): Promise<{
    planPath: string;
    planName: string;
    exists: boolean;
} | null> {
    if (!pathOrCode) {
        return null;
    }

    const config = await loadConfig();
    const plansDir = config?.planDirectory || './plans';

    // Check if it's a direct path
    if (fs.existsSync(pathOrCode)) {
        return {
            planPath: path.resolve(pathOrCode),
            planName: path.basename(pathOrCode),
            exists: true,
        };
    }

    // Check if it's a code in the plans directory
    const planDirPath = path.join(plansDir, pathOrCode);
    if (fs.existsSync(planDirPath)) {
        return {
            planPath: path.resolve(planDirPath),
            planName: pathOrCode,
            exists: true,
        };
    }

    // It's a new plan code
    return {
        planPath: path.resolve(planDirPath),
        planName: pathOrCode,
        exists: false,
    };
}

/**
 * Run an interactive agent session
 */
export async function runAgentSession(config: AgentSessionConfig): Promise<AgentSessionResult> {
    const { planPath, planName, mode, systemPrompt, tools, provider, initialMessage, showBanner = true } = config;

    // Create terminal
    const terminal = createTerminal({
        onExit: () => {
            console.log(chalk.yellow('\nExiting...'));
            process.exit(0);
        },
    });
    terminal.init();

    // Create session manager
    const session = createSessionManager(planPath);

    // Show banner
    if (showBanner) {
        terminal.showBanner({
            planName: planName || path.basename(planPath),
            planPath,
            provider: provider.provider,
            model: provider.model,
            mode,
        });
    }

    // Load plan context if exists
    const context = await session.loadPlanContext();
    if (context.exists) {
        terminal.writeLine(chalk.dim(`Plan stage: ${context.stage}`));
        if (context.notes || context.constraints || context.questions) {
            terminal.writeLine(chalk.dim(`  Notes: ${context.notes || 0}, Constraints: ${context.constraints || 0}, Questions: ${context.questions || 0}`));
        }
        if (context.evidence) {
            terminal.writeLine(chalk.dim(`  Evidence files: ${context.evidence}`));
        }
        terminal.writeLine();
    }

    // Create LLM provider
    const llmProvider = createLLMProvider(provider.provider);

    // Create tool registry and register tools
    const toolRegistry = ToolRegistry.create();
    for (const tool of tools) {
        toolRegistry.register(tool);
    }

    // Create conversation manager with system prompt
    const conversation = ConversationManager.create();
    conversation.addSystemMessage(systemPrompt);

    // Create agent provider adapter
    const agentProvider: AgentProvider = {
        name: provider.provider,
        execute: async (request) => {
            const execRequest = llmProvider.createRequest(provider.model);
            for (const msg of request.messages) {
                execRequest.addMessage(msg);
            }
            if (request.tools && request.tools.length > 0) {
                (execRequest as any).tools = request.tools;
            }
            const response = await llmProvider.execute(execRequest);
            return {
                content: response.content,
                model: response.model,
                usage: response.usage ? {
                    inputTokens: response.usage.inputTokens,
                    outputTokens: response.usage.outputTokens,
                } : undefined,
                toolCalls: response.toolCalls,
            };
        },
        executeStream: async function* (request) {
            const execRequest = llmProvider.createRequest(provider.model);
            for (const msg of request.messages) {
                execRequest.addMessage(msg);
            }
            if (request.tools && request.tools.length > 0) {
                (execRequest as any).tools = request.tools;
            }
            if (llmProvider.executeStream) {
                for await (const chunk of llmProvider.executeStream(execRequest)) {
                    if (chunk.type === 'text') {
                        yield { type: 'text' as const, text: chunk.text };
                    } else if (chunk.type === 'tool_call') {
                        yield { 
                            type: 'tool_call_start' as const, 
                            toolCall: { 
                                id: chunk.toolCall?.id,
                                name: chunk.toolCall?.name,
                            } 
                        };
                        if (chunk.toolCall?.arguments) {
                            yield {
                                type: 'tool_call_delta' as const,
                                toolCall: {
                                    id: chunk.toolCall.id,
                                    argumentsDelta: chunk.toolCall.arguments,
                                },
                            };
                        }
                        yield { type: 'tool_call_end' as const, toolCall: { id: chunk.toolCall?.id } };
                    } else if (chunk.type === 'usage') {
                        yield { 
                            type: 'usage' as const, 
                            usage: chunk.usage ? {
                                inputTokens: chunk.usage.inputTokens,
                                outputTokens: chunk.usage.outputTokens,
                            } : undefined,
                        };
                    } else if (chunk.type === 'done') {
                        yield { type: 'done' as const };
                    }
                }
            } else {
                const response = await llmProvider.execute(execRequest);
                yield { type: 'text' as const, text: response.content };
                yield { type: 'done' as const };
            }
        },
    };

    // Create agent loop
    const agentLoop = AgentLoop.create({
        provider: agentProvider,
        toolRegistry,
        conversation,
        model: provider.model,
        maxIterations: 20,
    });

    // If there's an initial message, send it first
    if (initialMessage) {
        session.recordUserMessage(initialMessage);
        let assistantContent = '';
        for await (const chunk of agentLoop.runStream(initialMessage)) {
            terminal.writeChunk(chunk);
            if (chunk.type === 'text' && chunk.text) {
                assistantContent += chunk.text;
            }
            if (chunk.type === 'tool_result' && chunk.tool) {
                session.recordToolCall(
                    chunk.tool.name,
                    chunk.tool.id || 'unknown',
                    chunk.tool.result || ''
                );
            }
        }
        if (assistantContent) {
            session.recordAssistantMessage(assistantContent);
        }
        terminal.writeLine();
    }

    // Main interaction loop
    let running = true;
    while (running) {
        try {
            const input = await terminal.readLine();
            
            if (!input.trim()) {
                continue;
            }

            if (input.trim().toLowerCase() === '/done' || input.trim().toLowerCase() === '/exit') {
                running = false;
                break;
            }

            session.recordUserMessage(input);

            let assistantContent = '';
            for await (const chunk of agentLoop.runStream(input)) {
                terminal.writeChunk(chunk);
                
                if (chunk.type === 'text' && chunk.text) {
                    assistantContent += chunk.text;
                }
                
                if (chunk.type === 'tool_result' && chunk.tool) {
                    session.recordToolCall(
                        chunk.tool.name,
                        chunk.tool.id || 'unknown',
                        chunk.tool.result || ''
                    );
                }
            }

            if (assistantContent) {
                session.recordAssistantMessage(assistantContent);
            }

            terminal.writeLine();

        } catch (error) {
            if (error instanceof Error && error.message.includes('SIGINT')) {
                terminal.writeLine(chalk.yellow('\nInterrupted'));
                continue;
            }
            terminal.writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    }

    // Save transcript
    const transcriptPath = await session.saveTranscript();
    
    // Show summary
    const stats = session.getStats();
    terminal.showSummary({
        messages: stats.messages,
        toolCalls: stats.toolCalls,
        duration: session.getDuration(),
    });

    if (transcriptPath) {
        terminal.writeLine(chalk.dim(`Transcript saved: ${transcriptPath}`));
    }

    terminal.close();

    return {
        messages: stats.messages,
        toolCalls: stats.toolCalls,
        duration: session.getDuration(),
        transcriptPath: transcriptPath || undefined,
    };
}

/**
 * Handle common CLI setup and error handling
 */
export async function withProviderConfig(
    options: { provider?: string; model?: string },
    callback: (config: ProviderConfig) => Promise<void>
): Promise<void> {
    // Detect provider
    let providerConfig = detectProvider();
    
    // Override with explicit provider option
    if (options?.provider) {
        const provider = options.provider as 'anthropic' | 'openai';
        const apiKey = provider === 'anthropic' 
            ? process.env.ANTHROPIC_API_KEY 
            : process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            console.error(chalk.red(`No API key found for ${provider}. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} environment variable.`));
            process.exit(1);
        }
        
        providerConfig = { provider, apiKey };
    }

    if (!providerConfig) {
        console.error(chalk.red('No LLM provider configured.'));
        console.error(chalk.dim('Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.'));
        process.exit(1);
    }

    const model = options?.model || getDefaultModel(providerConfig.provider);

    await callback({
        provider: providerConfig.provider,
        apiKey: providerConfig.apiKey,
        model,
    });
}
