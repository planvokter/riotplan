import { describe, expect, it } from 'vitest';
import { createApp, resolveContextDir } from '../../src/mcp/server-hono.js';

describe('server-hono contextDir configuration', () => {
    it('falls back to plansDir when contextDir is not set', async () => {
        expect(
            resolveContextDir({
                plansDir: '/workspace/plans',
            })
        ).toBe('/workspace/plans');

        const app = createApp({
            port: 3000,
            plansDir: '/workspace/plans',
            cors: false,
        });

        const response = await app.request('/health');
        const body = await response.json();
        expect(body.contextDir).toBe('/workspace/plans');
    });

    it('uses explicit contextDir when provided', async () => {
        expect(
            resolveContextDir({
                plansDir: '/workspace/plans',
                contextDir: '/workspace/context',
            })
        ).toBe('/workspace/context');

        const app = createApp({
            port: 3000,
            plansDir: '/workspace/plans',
            contextDir: '/workspace/context',
            cors: false,
        });

        const response = await app.request('/health');
        const body = await response.json();
        expect(body.contextDir).toBe('/workspace/context');
    });
});
