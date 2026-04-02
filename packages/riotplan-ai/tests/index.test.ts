import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    loadProvider,
    detectAvailableProviders,
    getDefaultProvider,
    getProviderApiKey,
} from '../src/provider-loader.js';

let lastSamplingProvider:
    | { setSamplingClient: (client: unknown) => void; opts: unknown }
    | undefined;

vi.mock('@kjerneverk/execution-anthropic', () => ({
    createAnthropicProvider: () => ({ name: 'anthropic' }),
}));

vi.mock('@kjerneverk/execution-openai', () => ({
    createOpenAIProvider: () => ({ name: 'openai' }),
}));

vi.mock('@kjerneverk/execution-gemini', () => ({
    createGeminiProvider: () => ({ name: 'gemini' }),
}));

vi.mock('@kjerneverk/execution-sampling', () => ({
    createSamplingProvider: (opts: unknown) => {
        lastSamplingProvider = {
            opts,
            setSamplingClient: vi.fn(),
        };
        return lastSamplingProvider;
    },
}));

describe('provider-loader', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.OPENAI_API_KEY;
        delete process.env.GOOGLE_API_KEY;
        lastSamplingProvider = undefined;
    });

    describe('getDefaultProvider', () => {
        it('returns null when no API keys are present', () => {
            expect(getDefaultProvider()).toBeNull();
        });

        it('returns anthropic when ANTHROPIC_API_KEY is set', () => {
            process.env.ANTHROPIC_API_KEY = 'x';
            expect(getDefaultProvider()).toBe('anthropic');
        });

        it('returns openai when OPENAI_API_KEY is set (and anthropic is not)', () => {
            process.env.OPENAI_API_KEY = 'x';
            expect(getDefaultProvider()).toBe('openai');
        });

        it('returns gemini when GOOGLE_API_KEY is set (and others are not)', () => {
            process.env.GOOGLE_API_KEY = 'x';
            expect(getDefaultProvider()).toBe('gemini');
        });
    });

    describe('getProviderApiKey', () => {
        it('returns correct env key per provider alias', () => {
            process.env.ANTHROPIC_API_KEY = 'a';
            process.env.OPENAI_API_KEY = 'o';
            process.env.GOOGLE_API_KEY = 'g';

            expect(getProviderApiKey('anthropic')).toBe('a');
            expect(getProviderApiKey('claude')).toBe('a');
            expect(getProviderApiKey('openai')).toBe('o');
            expect(getProviderApiKey('gpt')).toBe('o');
            expect(getProviderApiKey('gemini')).toBe('g');
            expect(getProviderApiKey('google')).toBe('g');
        });

        it('returns undefined for unknown provider', () => {
            process.env.ANTHROPIC_API_KEY = 'a';
            expect(getProviderApiKey('unknown-provider')).toBeUndefined();
        });
    });

    describe('loadProvider', () => {
        it('throws helpful message when no provider available', async () => {
            await expect(
                loadProvider({
                    name: '',
                    session: {
                        sessionId: 's',
                        providerMode: 'none',
                        clientInfo: { name: 'test-client', version: '0.0.0' },
                    },
                })
            ).rejects.toThrow(/No AI provider available for RiotPlan/);
        });

        it('rejects unknown direct providers', async () => {
            await expect(
                loadProvider({ name: 'unknown-provider' })
            ).rejects.toThrow('Unknown provider: unknown-provider');
        });

        it('loads direct anthropic provider when requested', async () => {
            const provider = await loadProvider({ name: 'anthropic' });
            expect(provider).toMatchObject({ name: 'anthropic' });
        });

        it('loads sampling provider and wires up MCP client when provided', async () => {
            const mcpServer = { id: 'mcp' };
            const provider = await loadProvider({
                name: '',
                session: {
                    sessionId: 's',
                    providerMode: 'sampling',
                    clientInfo: { name: 'test-client', version: '0.0.0' },
                },
                mcpServer,
            });

            expect(provider).toBeDefined();
            expect(lastSamplingProvider).toBeDefined();
            expect(lastSamplingProvider?.setSamplingClient).toHaveBeenCalledWith(
                mcpServer
            );
        });
    });

    describe('detectAvailableProviders', () => {
        it('returns a list containing only known provider names', async () => {
            const providers = await detectAvailableProviders();
            const allowed = new Set(['anthropic', 'openai', 'gemini']);
            expect(Array.isArray(providers)).toBe(true);
            expect(providers.every((p) => allowed.has(p))).toBe(true);
        });

        it('returns all providers when all provider packages are available', async () => {
            const providers = await detectAvailableProviders();
            expect(providers).toEqual(['anthropic', 'openai', 'gemini']);
        });
    });
});

