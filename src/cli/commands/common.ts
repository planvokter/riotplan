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
import { indexProjectImpl } from '../tools/environment/project-index.js';

// Import provider factories and request builder
import { createAnthropicProvider } from '@kjerneverk/execution-anthropic';
import { createOpenAIProvider } from '@kjerneverk/execution-openai';
import { createRequest } from '@kjerneverk/execution';

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
 * Find a directory by name (case-insensitive) within a parent directory
 */
function findDirectoryCaseInsensitive(parentDir: string, targetName: string): string | null {
    try {
        const entries = fs.readdirSync(parentDir, { withFileTypes: true });
        const targetLower = targetName.toLowerCase();
        
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.toLowerCase() === targetLower) {
                return path.join(parentDir, entry.name);
            }
        }
    } catch {
        // Directory doesn't exist or can't be read
    }
    return null;
}

/**
 * Check if a directory is a plan directory
 */
export function isPlanDirectory(dirPath: string): boolean {
    try {
        const files = fs.readdirSync(dirPath);
        return files.includes('LIFECYCLE.md') || 
               files.includes('STATUS.md') || 
               files.includes('plan') ||
               files.includes('IDEA.md');
    } catch {
        return false;
    }
}

/**
 * Project root indicator files (language-agnostic)
 * These files typically exist at the root of a project.
 */
const PROJECT_ROOT_INDICATORS = [
    // Node.js
    'package.json',
    // Rust
    'Cargo.toml',
    // Python
    'pyproject.toml', 'setup.py', 'setup.cfg',
    // Go
    'go.mod',
    // Java
    'pom.xml', 'build.gradle', 'build.gradle.kts',
    // C/C++
    'CMakeLists.txt',
    // .NET
    '*.sln',
    // Ruby
    'Gemfile',
    // Swift
    'Package.swift',
    // Generic
    '.git',  // Git root is often project root
];

/**
 * Check if a directory looks like a project root
 */
function isProjectRoot(dirPath: string): boolean {
    try {
        const entries = fs.readdirSync(dirPath);
        return PROJECT_ROOT_INDICATORS.some(indicator => {
            if (indicator.startsWith('*')) {
                // Glob pattern (e.g., *.sln)
                const ext = indicator.slice(1);
                return entries.some(e => e.endsWith(ext));
            }
            return entries.includes(indicator);
        });
    } catch {
        return false;
    }
}

/**
 * Find the project root from a plan path
 * 
 * Walks up from the plan path looking for:
 * 1. A directory containing a project root indicator (package.json, Cargo.toml, go.mod, etc.)
 * 2. A directory that is the parent of 'plans/'
 * 3. Falls back to the plan's grandparent directory
 */
export function findProjectRoot(planPath: string): string {
    let current = path.resolve(planPath);
    const maxDepth = 10;
    let depth = 0;
    
    while (depth < maxDepth) {
        // Check if this directory has any project root indicator
        if (isProjectRoot(current)) {
            return current;
        }
        
        // Check if parent is 'plans' directory
        const parent = path.dirname(current);
        if (path.basename(current) === 'plans' || path.basename(parent) === 'plans') {
            // Go up one more level to get the project root
            const projectRoot = path.basename(current) === 'plans' ? parent : path.dirname(parent);
            if (isProjectRoot(projectRoot)) {
                return projectRoot;
            }
            // Even without indicators, this is likely the project root
            return projectRoot;
        }
        
        // Move up
        const nextParent = path.dirname(current);
        if (nextParent === current) {
            // Reached filesystem root
            break;
        }
        current = nextParent;
        depth++;
    }
    
    // Fallback: use grandparent of plan path
    return path.dirname(path.dirname(planPath));
}

/**
 * Resolve plan path from user input
 * 
 * Resolution order:
 * 1. If it's a direct path that exists, use it
 * 2. If planDirectory is configured, look there (case-insensitive)
 * 3. If cwd is inside a plans/ directory, search siblings (case-insensitive)
 * 4. If ./plans exists, search there (case-insensitive)
 * 5. If cwd contains the plan directly, use it
 * 6. Otherwise, it's a new plan (default to ./plans or configured directory)
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
    const configuredPlansDir = config?.planDirectory;
    const cwd = process.cwd();

    // 1. Check if it's a direct path that exists
    if (fs.existsSync(pathOrCode)) {
        const resolved = path.resolve(pathOrCode);
        if (isPlanDirectory(resolved)) {
            return {
                planPath: resolved,
                planName: path.basename(resolved),
                exists: true,
            };
        }
    }

    // 2. If planDirectory is configured, look there (case-insensitive)
    if (configuredPlansDir) {
        const resolvedConfigDir = path.resolve(configuredPlansDir);
        if (fs.existsSync(resolvedConfigDir)) {
            const found = findDirectoryCaseInsensitive(resolvedConfigDir, pathOrCode);
            if (found && isPlanDirectory(found)) {
                return {
                    planPath: found,
                    planName: path.basename(found),
                    exists: true,
                };
            }
        }
    }

    // 3. Check if we're inside a plans/ directory - search siblings
    const cwdBasename = path.basename(cwd).toLowerCase();
    const cwdParent = path.dirname(cwd);
    const cwdParentBasename = path.basename(cwdParent).toLowerCase();
    
    // If parent is "plans", search in parent for the target
    if (cwdParentBasename === 'plans') {
        const found = findDirectoryCaseInsensitive(cwdParent, pathOrCode);
        if (found && isPlanDirectory(found)) {
            return {
                planPath: found,
                planName: path.basename(found),
                exists: true,
            };
        }
    }
    
    // If cwd is "plans", search in cwd for the target
    if (cwdBasename === 'plans') {
        const found = findDirectoryCaseInsensitive(cwd, pathOrCode);
        if (found && isPlanDirectory(found)) {
            return {
                planPath: found,
                planName: path.basename(found),
                exists: true,
            };
        }
    }

    // 4. Check if ./plans exists and search there (case-insensitive)
    const localPlansDir = path.join(cwd, 'plans');
    if (fs.existsSync(localPlansDir)) {
        const found = findDirectoryCaseInsensitive(localPlansDir, pathOrCode);
        if (found && isPlanDirectory(found)) {
            return {
                planPath: found,
                planName: path.basename(found),
                exists: true,
            };
        }
    }

    // 5. Check if cwd contains the plan directly (case-insensitive)
    const foundInCwd = findDirectoryCaseInsensitive(cwd, pathOrCode);
    if (foundInCwd && isPlanDirectory(foundInCwd)) {
        return {
            planPath: foundInCwd,
            planName: path.basename(foundInCwd),
            exists: true,
        };
    }

    // 6. It's a new plan - determine where to create it
    // Prefer configured directory, then ./plans if it exists, then cwd
    let targetDir: string;
    if (configuredPlansDir) {
        targetDir = path.resolve(configuredPlansDir);
    } else if (fs.existsSync(localPlansDir)) {
        targetDir = localPlansDir;
    } else if (cwdBasename === 'plans' || cwdParentBasename === 'plans') {
        // We're in or near a plans directory
        targetDir = cwdParentBasename === 'plans' ? cwdParent : cwd;
    } else {
        targetDir = localPlansDir; // Default to ./plans even if it doesn't exist yet
    }

    return {
        planPath: path.resolve(path.join(targetDir, pathOrCode)),
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

    // Auto-index the project at startup for fast queries
    const projectRoot = findProjectRoot(planPath);
    terminal.writeLine(chalk.dim(`Indexing project: ${projectRoot}...`));
    const indexStart = Date.now();
    try {
        await indexProjectImpl({ path: projectRoot }, projectRoot);
        const indexTime = Date.now() - indexStart;
        terminal.writeLine(chalk.dim(`  Index ready (${indexTime}ms)`));
    } catch (error) {
        terminal.writeLine(chalk.yellow(`  Index failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
    terminal.writeLine();

    // Create LLM provider
    const llmProvider = createLLMProvider(provider.provider);

    // Create tool registry with plan path as working directory context
    // This ensures all RiotPlan tools operate on the correct plan directory
    const toolRegistry = ToolRegistry.create({
        workingDirectory: planPath,
    });
    
    // Add context updater callback so tools can change the working directory
    // This enables dynamic plan switching during conversation
    // Also add a progressCallback so long-running tools can update the spinner
    toolRegistry.updateContext({
        updateContext: (updates: { workingDirectory?: string; [key: string]: any }) => {
            toolRegistry.updateContext(updates);
            // Log context changes for debugging
            if (updates.workingDirectory) {
                terminal.writeLine(chalk.dim(`📁 Switched to: ${updates.workingDirectory}`));
            }
        },
        progressCallback: (_progress: number, _total: number | null, message: string) => {
            // Update the spinner sub-message for long-running tools
            terminal.updateToolSpinner(message);
        },
    });
    
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
            const execRequest = createRequest(provider.model);
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
            const execRequest = createRequest(provider.model);
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
                    } else if (chunk.type === 'tool_call_start') {
                        yield { 
                            type: 'tool_call_start' as const, 
                            toolCall: { 
                                id: chunk.toolCall?.id,
                                index: chunk.toolCall?.index,
                                name: chunk.toolCall?.name,
                            } 
                        };
                    } else if (chunk.type === 'tool_call_delta') {
                        yield {
                            type: 'tool_call_delta' as const,
                            toolCall: {
                                id: chunk.toolCall?.id,
                                index: chunk.toolCall?.index,
                                argumentsDelta: chunk.toolCall?.argumentsDelta,
                            },
                        };
                    } else if (chunk.type === 'tool_call_end') {
                        yield { 
                            type: 'tool_call_end' as const, 
                            toolCall: { 
                                id: chunk.toolCall?.id,
                                index: chunk.toolCall?.index,
                            } 
                        };
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
    // Set maxIterations very high - this controls tool call rounds per turn, not conversation length
    // The user can always exit with /done or Ctrl-C
    const agentLoop = AgentLoop.create({
        provider: agentProvider,
        toolRegistry,
        conversation,
        model: provider.model,
        maxIterations: 100,
    });

    // If there's an initial message, send it first
    if (initialMessage) {
        session.recordUserMessage(initialMessage);
        terminal.showThinking();
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
        terminal.hideThinking(); // Ensure it's hidden even if no chunks arrived
        terminal.endAssistantResponse(); // Ensure response mode is ended
        if (assistantContent) {
            session.recordAssistantMessage(assistantContent);
        }
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

            terminal.showThinking();
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
            terminal.hideThinking(); // Ensure it's hidden even if no chunks arrived
            terminal.endAssistantResponse(); // Ensure response mode is ended

            if (assistantContent) {
                session.recordAssistantMessage(assistantContent);
            }

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
