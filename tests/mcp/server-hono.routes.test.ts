import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

const mocks = vi.hoisted(() => {
    class MockTransport {
        public static handleRequest = vi.fn();
        public send = vi.fn();
        constructor(_: unknown) {}
        async handleRequest(ctx: unknown) {
            return MockTransport.handleRequest(ctx);
        }
    }

    class MockServer {
        public static close = vi.fn();
        public setRequestHandler = vi.fn();
        public connect = vi.fn(async () => undefined);
        public close() {
            MockServer.close();
        }
    }

    return {
        MockTransport,
        MockServer,
        executeTool: vi.fn(async () => ({ success: true, data: { ok: true } })),
        tools: [{ name: 'dummy', description: 'd', schema: {} }],
        getResources: vi.fn(() => [{ uri: 'riotplan://plan/{planId}', name: 'Plan', description: '', mimeType: 'application/json' }]),
        readResource: vi.fn(async () => ({ ok: true })),
        getPrompts: vi.fn(() => []),
        getPrompt: vi.fn(async () => []),
    };
});

vi.mock('@hono/mcp', () => ({
    StreamableHTTPTransport: mocks.MockTransport,
}));

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
    Server: mocks.MockServer,
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
    CallToolRequestSchema: {},
    ListToolsRequestSchema: {},
    ListResourcesRequestSchema: {},
    ReadResourceRequestSchema: {},
    ListPromptsRequestSchema: {},
    GetPromptRequestSchema: {},
}));

vi.mock('../../src/mcp/tools/index.js', () => ({
    executeTool: mocks.executeTool,
    tools: mocks.tools,
}));

vi.mock('../../src/mcp/resources/index.js', () => ({
    getResources: mocks.getResources,
    readResource: mocks.readResource,
}));

vi.mock('../../src/mcp/prompts/index.js', () => ({
    getPrompts: mocks.getPrompts,
    getPrompt: mocks.getPrompt,
}));

import { createApp } from '../../src/mcp/server-hono.js';

describe('server-hono routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.MockTransport.handleRequest.mockResolvedValue(new Response('ok', { status: 200 }));
    });

    function app() {
        return createApp({
            port: 3000,
            plansDir: '/workspace/plans',
            contextDir: '/workspace/context',
            cors: false,
            sessionTimeout: 1000,
        });
    }

    it('handles /mcp subscribe, unsubscribe, and initialized notification', async () => {
        const a = app();
        const subscribe = await a.request('/mcp', {
            method: 'POST',
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'resources/subscribe',
                params: { uri: 'riotplan://plan/demo' },
            }),
            headers: { 'content-type': 'application/json' },
        });
        expect(subscribe.status).toBe(200);

        const unsubscribe = await a.request('/mcp', {
            method: 'POST',
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'resources/unsubscribe',
                params: { uri: 'riotplan://plan/demo' },
            }),
            headers: { 'content-type': 'application/json' },
        });
        expect(unsubscribe.status).toBe(200);

        const initialized = await a.request('/mcp', {
            method: 'POST',
            body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
            headers: { 'content-type': 'application/json' },
        });
        expect(initialized.status).toBe(202);
    });

    it('returns transport error when /mcp handleRequest yields no response', async () => {
        const a = app();
        mocks.MockTransport.handleRequest.mockResolvedValueOnce(null);
        const res = await a.request('/mcp', {
            method: 'POST',
            body: '{"jsonrpc":"2.0","id":1,"method":"test"}',
            headers: { 'content-type': 'application/json' },
        });
        expect(res.status).toBe(500);
    });

    it('returns HTTPException response from /mcp post', async () => {
        const a = app();
        mocks.MockTransport.handleRequest.mockImplementationOnce(() => {
            throw new HTTPException(418, { message: 'teapot' });
        });
        const res = await a.request('/mcp', {
            method: 'POST',
            body: '{"jsonrpc":"2.0","id":1,"method":"test"}',
            headers: { 'content-type': 'application/json' },
        });
        expect(res.status).toBe(418);
    });

    it('returns generic 500 from /mcp post on non-HTTP errors', async () => {
        const a = app();
        mocks.MockTransport.handleRequest.mockImplementationOnce(() => {
            throw new Error('boom');
        });
        const res = await a.request('/mcp', {
            method: 'POST',
            body: '{"jsonrpc":"2.0","id":1,"method":"test"}',
            headers: { 'content-type': 'application/json' },
        });
        expect(res.status).toBe(500);
    });

    it('handles /mcp get and delete session header edge-cases', async () => {
        const a = app();

        const missingGet = await a.request('/mcp', { method: 'GET' });
        expect(missingGet.status).toBe(400);

        const missingDelete = await a.request('/mcp', { method: 'DELETE' });
        expect(missingDelete.status).toBe(400);

        const unknownGet = await a.request('/mcp', {
            method: 'GET',
            headers: { 'Mcp-Session-Id': 'missing-session' },
        });
        expect(unknownGet.status).toBe(404);

        const unknownDelete = await a.request('/mcp', {
            method: 'DELETE',
            headers: { 'Mcp-Session-Id': 'missing-session' },
        });
        expect(unknownDelete.status).toBe(404);
    });

    it('supports /mcp get and delete for an existing session', async () => {
        const a = app();

        const post = await a.request('/mcp', {
            method: 'POST',
            body: '{"jsonrpc":"2.0","id":1,"method":"test"}',
            headers: { 'content-type': 'application/json' },
        });
        const sessionId = post.headers.get('Mcp-Session-Id');
        expect(sessionId).toBeTruthy();

        const getRes = await a.request('/mcp', {
            method: 'GET',
            headers: { 'Mcp-Session-Id': String(sessionId) },
        });
        expect(getRes.status).toBe(200);

        // Return null once so delete falls back to 200 body(null)
        mocks.MockTransport.handleRequest.mockResolvedValueOnce(null);
        const delRes = await a.request('/mcp', {
            method: 'DELETE',
            headers: { 'Mcp-Session-Id': String(sessionId) },
        });
        expect(delRes.status).toBe(200);
    });
});
