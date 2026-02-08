/**
 * Provider Loader
 * 
 * Dynamically loads LLM providers based on availability and session context.
 * Supports both MCP sampling (when available) and direct API providers.
 */

import type { Provider } from '../types.js';
import type { SessionContext } from '../mcp/session/index.js';

export interface ProviderConfig {
    name: string;
    apiKey?: string;
    model?: string;
    session?: SessionContext;
}

/**
 * Load a provider based on session context and configuration
 * 
 * Priority:
 * 1. If session has sampling available → use SamplingProvider
 * 2. If explicit provider name given → use that provider
 * 3. If API keys available → use default provider
 * 4. Otherwise → error with helpful message
 */
export async function loadProvider(config: ProviderConfig): Promise<Provider> {
    const { name, apiKey, session } = config;
    
    // Priority 1: Check if session supports sampling
    if (session && session.providerMode === 'sampling') {
        return await loadSamplingProvider(session);
    }
    
    // Priority 2: Explicit provider name
    if (name) {
        return await loadDirectProvider(name, apiKey);
    }
    
    // Priority 3: Default provider from environment
    const defaultProvider = getDefaultProvider();
    if (defaultProvider) {
        return await loadDirectProvider(defaultProvider, apiKey);
    }
    
    // Priority 4: No provider available
    const clientName = session?.clientInfo?.name ?? 'your client';
    const errorMessage = [
        '❌ No AI provider available for RiotPlan.',
        '',
        `Your client (${clientName}) does not support MCP sampling, and no API keys are configured.`,
        '',
        'To use RiotPlan\'s AI generation features, either:',
        '',
        '1. Use a client that supports MCP sampling:',
        '   - GitHub Copilot (supports sampling)',
        '   - FastMCP (Python framework for testing)',
        '',
        '2. Set up an API key:',
        '   - ANTHROPIC_API_KEY for Claude models (recommended)',
        '   - OPENAI_API_KEY for GPT models',
        '   - GOOGLE_API_KEY for Gemini models',
        '',
        '3. Create plan steps manually:',
        '   - Use riotplan_step_add to add steps without AI',
        '',
        'For more information: https://github.com/kjerneverk/riotplan#ai-providers',
    ].join('\n');
    
    throw new Error(errorMessage);
}

/**
 * Load a sampling provider for MCP
 */
async function loadSamplingProvider(session: SessionContext): Promise<Provider> {
    try {
        const { createSamplingProvider } = await import('@kjerneverk/execution-sampling');
        
        const provider = createSamplingProvider({
            sessionId: session.sessionId,
            clientName: session.clientInfo?.name,
            supportsTools: false, // RiotPlan doesn't use tools in generation
            debug: false,
        });
        
        // TODO: Wire up MCP client for sending sampling requests
        // This will be done in Step 8
        
        return provider;
    } catch (error) {
        if (error instanceof Error && (error.message.includes('Cannot find package') || error.message.includes('Cannot find module'))) {
            throw new Error(
                'Sampling provider (@kjerneverk/execution-sampling) is not installed.\n' +
                'This is a development error - the package should be installed as a dependency.'
            );
        }
        throw error;
    }
}

/**
 * Load a direct API provider by name
 */
async function loadDirectProvider(name: string, apiKey?: string): Promise<Provider> {
    try {
        switch (name.toLowerCase()) {
            case 'anthropic':
            case 'claude':
                return await loadAnthropicProvider(apiKey);
            
            case 'openai':
            case 'gpt':
                return await loadOpenAIProvider(apiKey);
            
            case 'gemini':
            case 'google':
                return await loadGeminiProvider(apiKey);
            
            default:
                throw new Error(`Unknown provider: ${name}`);
        }
    } catch (error) {
        if (error instanceof Error && (error.message.includes('Cannot find package') || error.message.includes('Cannot find module'))) {
            const errorMessage = [
                `❌ Provider '${name}' is not installed.`,
                '',
                'To use this provider, install it:',
                `  npm install @kjerneverk/execution-${name}`,
                '',
                'Then set the appropriate API key:',
                `  export ${name.toUpperCase()}_API_KEY="your-key-here"`,
                '',
                'Alternative options:',
                '  1. Use a different provider (anthropic, openai, gemini)',
                '  2. Use RiotPlan via MCP with a sampling-enabled client',
                '  3. Create plan steps manually with riotplan_step_add',
            ].join('\n');
            throw new Error(errorMessage);
        }
        throw error;
    }
}

async function loadAnthropicProvider(_apiKey?: string): Promise<Provider> {
    const { createAnthropicProvider } = await import('@kjerneverk/execution-anthropic');
    return createAnthropicProvider();
}

async function loadOpenAIProvider(_apiKey?: string): Promise<Provider> {
    const { createOpenAIProvider } = await import('@kjerneverk/execution-openai');
    return createOpenAIProvider();
}

async function loadGeminiProvider(_apiKey?: string): Promise<Provider> {
    const { createGeminiProvider } = await import('@kjerneverk/execution-gemini');
    return createGeminiProvider();
}

/**
 * Detect available providers
 */
export async function detectAvailableProviders(): Promise<string[]> {
    const providers: string[] = [];
    
    const candidates = [
        { name: 'anthropic', pkg: '@kjerneverk/execution-anthropic' },
        { name: 'openai', pkg: '@kjerneverk/execution-openai' },
        { name: 'gemini', pkg: '@kjerneverk/execution-gemini' },
    ];
    
    for (const candidate of candidates) {
        try {
            await import(candidate.pkg);
            providers.push(candidate.name);
        } catch {
            // Provider not available
        }
    }
    
    return providers;
}

/**
 * Get default provider based on environment variables
 */
export function getDefaultProvider(): string | null {
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (process.env.OPENAI_API_KEY) return 'openai';
    if (process.env.GOOGLE_API_KEY) return 'gemini';
    return null;
}

/**
 * Get API key for a provider from environment
 */
export function getProviderApiKey(provider: string): string | undefined {
    switch (provider.toLowerCase()) {
        case 'anthropic':
        case 'claude':
            return process.env.ANTHROPIC_API_KEY;
        case 'openai':
        case 'gpt':
            return process.env.OPENAI_API_KEY;
        case 'gemini':
        case 'google':
            return process.env.GOOGLE_API_KEY;
        default:
            return undefined;
    }
}
