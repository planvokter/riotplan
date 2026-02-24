import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

const mocks = vi.hoisted(() => {
    const schemas = {
        CallToolRequestSchema: {},
        ListToolsRequestSchema: {},
        ListResourcesRequestSchema: {},
        ReadResourceRequestSchema: {},
        ListPromptsRequestSchema: {},
        GetPromptRequestSchema: {},
    };

    class MockTransport {
        public static instances: MockTransport[] = [];
        public static handleRequest = vi.fn();
        public send = vi.fn();
        constructor(_: unknown) {
            MockTransport.instances.push(this);
        }
        async handleRequest(ctx: unknown) {
            return MockTransport.handleRequest(ctx);
        }
    }

    class MockServer {
        public static instances: MockServer[] = [];
        public handlers = new Map<unknown, (request: any) => Promise<any>>();
        public setRequestHandler = vi.fn((schema: unknown, handler: (request: any) => Promise<any>) => {
            this.handlers.set(schema, handler);
        });
        public connect = vi.fn(async () => undefined);
        public close = vi.fn();
        constructor(_: unknown, __: unknown) {
            MockServer.instances.push(this);
        }
    }

    return {
        schemas,
        MockTransport,
        MockServer,
        executeTool: vi.fn(async () => ({ success: true, data: { ok: true } })),
        tools: [
            { name: 'dummy', description: 'd', schema: {} },
            { name: 'riotplan_status', description: 'status', schema: {} },
            { name: 'riotplan_plan', description: 'plan', schema: {} },
            { name: 'riotplan_context', description: 'ctx', schema: {} },
        ],
        getResources: vi.fn(() => [
            { uri: 'riotplan://plan/{planId}', name: 'Plan', mimeType: 'application/json' },
            { uri: 'riotplan://status/{planId}', name: 'Status', description: 'Status', mimeType: 'application/json' },
        ]),
        readResource: vi.fn(async () => ({ ok: true })),
        getPrompts: vi.fn(() => [{ name: 'p1', description: 'prompt', arguments: [{ name: 'path' }] }]),
        getPrompt: vi.fn(async () => []),
        serve: vi.fn((opts: { port: number }, cb?: (info: { port: number }) => void) => {
            cb?.({ port: opts.port });
        }),
    };
});

vi.mock('@hono/mcp', () => ({
    StreamableHTTPTransport: mocks.MockTransport,
}));

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
    Server: mocks.MockServer,
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
    ...mocks.schemas,
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

vi.mock('@hono/node-server', () => ({
    serve: mocks.serve,
}));

import { createApp, startServer } from '../../src/mcp/server-hono.js';

describe('server-hono MCP handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.MockServer.instances.length = 0;
        mocks.MockTransport.instances.length = 0;
        mocks.MockTransport.handleRequest.mockResolvedValue(new Response('ok', { status: 200 }));
    });

    function app() {
        return createApp({
            port: 3000,
            plansDir: '/workspace/plans',
            contextDir: '/workspace/context',
            cors: false,
            sessionTimeout: 60_000,
        });
    }

    async function createSession(a: ReturnType<typeof app>, sessionId: string) {
        const res = await a.request('/mcp', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
        });
        expect(res.status).toBe(200);
    }

    it('covers call tool handler branches including notifications', async () => {
        const a = app();
        await createSession(a, 'sub-session');
        await a.request('/mcp', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'Mcp-Session-Id': 'sub-session',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'resources/subscribe',
                params: { uri: 'riotplan://plan/demo' },
            }),
        });

        await createSession(a, 'actor-session');
        const server = mocks.MockServer.instances.at(-1);
        expect(server).toBeTruthy();
        const callTool = server!.handlers.get(mocks.schemas.CallToolRequestSchema);
        expect(callTool).toBeTypeOf('function');

        const unknown = await callTool!({ params: { name: 'missing_tool', arguments: {} } });
        expect(unknown.isError).toBe(true);

        mocks.executeTool.mockResolvedValueOnce({
            success: false,
            error: 'failed',
            context: { reason: 'bad input', nullable: null },
            recovery: ['try again'],
        });
        const failed = await callTool!({ params: { name: 'dummy', arguments: { planId: 'demo' } } });
        expect(failed.isError).toBe(true);
        expect(failed.content[0].text).toContain('Recovery Steps');
        expect(failed.content[0].text).toContain('reason: bad input');

        mocks.executeTool.mockResolvedValueOnce({
            success: true,
            logs: ['line 1'],
            data: { planId: 'demo', updated: true },
        });
        const success = await callTool!({ params: { name: 'dummy', arguments: { planId: 'demo' } } });
        expect(success.content[0].text).toContain('Command Output');
        expect(success.content[1].text).toContain('"updated": true');
        expect(mocks.MockTransport.instances.some((t) => t.send.mock.calls.length > 0)).toBe(true);

        for (const transport of mocks.MockTransport.instances) transport.send.mockClear();
        mocks.executeTool.mockResolvedValueOnce({ success: true, data: { planId: 'demo' } });
        await callTool!({ params: { name: 'riotplan_status', arguments: { planId: 'demo' } } });
        expect(mocks.MockTransport.instances.every((t) => t.send.mock.calls.length === 0)).toBe(true);

        mocks.executeTool.mockResolvedValueOnce({ success: true, message: 'Done' });
        const withMessage = await callTool!({ params: { name: 'dummy', arguments: {} } });
        expect(withMessage.content.at(-1).text).toBe('Done');

        mocks.executeTool.mockRejectedValueOnce(new Error('explode'));
        const unhandled = await callTool!({ params: { name: 'dummy', arguments: {} } });
        expect(unhandled.isError).toBe(true);
        expect(unhandled.content[0].text).toContain('explode');
    });

    it('covers list/read resources and list/get prompt handlers', async () => {
        const a = app();
        await createSession(a, 'resources-session');
        const server = mocks.MockServer.instances.at(-1);
        expect(server).toBeTruthy();

        const listResources = server!.handlers.get(mocks.schemas.ListResourcesRequestSchema);
        const listResult = await listResources!({});
        expect(listResult.resources).toHaveLength(2);
        expect(listResult.resources[0].description).toBe('');

        const readResourceHandler = server!.handlers.get(mocks.schemas.ReadResourceRequestSchema);
        mocks.readResource.mockResolvedValueOnce({ hello: 'world' });
        const readOk = await readResourceHandler!({ params: { uri: 'riotplan://plan/demo' } });
        expect(readOk.contents[0].mimeType).toBe('application/json');
        expect(readOk.contents[0].text).toContain('"hello": "world"');

        mocks.readResource.mockRejectedValueOnce(new Error('missing'));
        const readErr = await readResourceHandler!({ params: { uri: 'riotplan://plan/demo' } });
        expect(readErr.contents[0].text).toContain('Error: missing');

        const listPrompts = server!.handlers.get(mocks.schemas.ListPromptsRequestSchema);
        const prompts = await listPrompts!({});
        expect(prompts.prompts[0].name).toBe('p1');

        const getPromptHandler = server!.handlers.get(mocks.schemas.GetPromptRequestSchema);
        mocks.getPrompt.mockResolvedValueOnce([
            { role: 'user', content: { type: 'text', text: 'hello' } },
            { role: 'assistant', content: { type: 'image', url: '/img.png' } },
        ]);
        const prompt = await getPromptHandler!({
            params: { name: 'p1', arguments: { path: '/tmp', ignored: 42 } },
        });
        expect(mocks.getPrompt).toHaveBeenCalledWith('p1', { path: '/tmp' }, { plansDir: '/workspace/plans' });
        expect(prompt.messages[0].content.text).toBe('hello');
        expect(prompt.messages[1].content.type).toBe('image');

        mocks.getPrompt.mockRejectedValueOnce(new Error('not found'));
        await expect(
            getPromptHandler!({ params: { name: 'missing', arguments: {} } })
        ).rejects.toThrow('Failed to get prompt missing: not found');

        const listTools = server!.handlers.get(mocks.schemas.ListToolsRequestSchema);
        const toolList = await listTools!({});
        expect(toolList.tools.length).toBeGreaterThan(0);
    });

    it('covers startServer logging for debug and non-debug configs', async () => {
        const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            await startServer({
                port: 3101,
                plansDir: '/plans',
                contextDir: '/ctx',
                cors: false,
                debug: true,
            });
            await startServer({
                port: 3102,
                plansDir: '/plans',
                cors: true,
                debug: false,
            });
        } finally {
            stderr.mockRestore();
        }

        expect(mocks.serve).toHaveBeenCalledTimes(2);
    });

    it('covers additional route edges and session cleanup', async () => {
        vi.useFakeTimers();
        try {
            const a = createApp({
                port: 3000,
                plansDir: '/workspace/plans',
                contextDir: '/workspace/context',
                cors: false,
                sessionTimeout: 20,
            });

            await createSession(a, 'edge-session');

            // subscribe/unsubscribe without uri still return JSON-RPC response
            const subNoUri = await a.request('/mcp', {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'Mcp-Session-Id': 'edge-session' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'resources/subscribe', params: {} }),
            });
            expect(await subNoUri.json()).toEqual({ jsonrpc: '2.0', result: {}, id: null });

            const unsubNoUri = await a.request('/mcp', {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'Mcp-Session-Id': 'edge-session' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'resources/unsubscribe', params: {} }),
            });
            expect(await unsubNoUri.json()).toEqual({ jsonrpc: '2.0', result: {}, id: null });

            mocks.MockTransport.handleRequest.mockImplementationOnce(() => {
                throw new HTTPException(409, { message: 'conflict' });
            });
            const getHttpEx = await a.request('/mcp', {
                method: 'GET',
                headers: { 'Mcp-Session-Id': 'edge-session' },
            });
            expect(getHttpEx.status).toBe(409);

            mocks.MockTransport.handleRequest.mockResolvedValueOnce(null);
            const getNoStream = await a.request('/mcp', {
                method: 'GET',
                headers: { 'Mcp-Session-Id': 'edge-session' },
            });
            expect(getNoStream.status).toBe(500);

            await createSession(a, 'delete-ex-session');
            mocks.MockTransport.handleRequest.mockImplementationOnce(() => {
                throw new HTTPException(410, { message: 'gone' });
            });
            const delHttpEx = await a.request('/mcp', {
                method: 'DELETE',
                headers: { 'Mcp-Session-Id': 'delete-ex-session' },
            });
            expect(delHttpEx.status).toBe(410);

            await createSession(a, 'post-unknown-error');
            mocks.MockTransport.handleRequest.mockImplementationOnce(() => {
                throw 'string-error';
            });
            const postUnknown = await a.request('/mcp', {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'Mcp-Session-Id': 'post-unknown-error' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'x' }),
            });
            expect(postUnknown.status).toBe(500);
            expect(await postUnknown.text()).toContain('Unknown error');

            vi.advanceTimersByTime(200);
            expect(mocks.MockServer.instances.some((s) => s.close.mock.calls.length > 0)).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});
