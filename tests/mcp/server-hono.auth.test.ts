import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { hashApiKeySecret } from '../../src/mcp/rbac.js';
import { createApp } from '../../src/mcp/server-hono.js';

describe('server-hono RBAC routes', () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
    });

    async function buildSecuredApp() {
        const root = await mkdtemp(join(tmpdir(), 'riotplan-http-auth-'));
        tempDirs.push(root);
        const plansDir = join(root, 'plans');
        const contextDir = join(root, 'context');
        await mkdir(plansDir, { recursive: true });
        await mkdir(contextDir, { recursive: true });

        const usersPath = join(root, 'users.yaml');
        const keysPath = join(root, 'keys.yaml');
        const basicSecret = 'basic-secret';
        const adminSecret = 'admin-secret';
        const basicHash = await hashApiKeySecret(basicSecret);
        const adminHash = await hashApiKeySecret(adminSecret);

        await writeFile(
            usersPath,
            `users:
  - id: user-basic
    display_name: Basic User
    roles: [reader]
    enabled: true
  - id: user-admin
    display_name: Admin User
    roles: [admin]
    enabled: true
`
        );

        await writeFile(
            keysPath,
            `keys:
  - key_id: key-basic
    secret_hash: "${basicHash}"
    user_id: user-basic
    enabled: true
    created_at: "2026-03-03T00:00:00Z"
  - key_id: key-admin
    secret_hash: "${adminHash}"
    user_id: user-admin
    enabled: true
    created_at: "2026-03-03T00:00:00Z"
`
        );

        const app = createApp({
            port: 3000,
            plansDir,
            contextDir,
            cors: false,
            security: {
                secured: true,
                rbacUsersPath: usersPath,
                rbacKeysPath: keysPath,
            },
        });

        return { app, basicSecret, adminSecret };
    }

    it('keeps /health public while protecting secured routes', async () => {
        const { app } = await buildSecuredApp();
        const health = await app.request('/health');
        expect(health.status).toBe(200);

        const whoami = await app.request('/auth/whoami');
        expect(whoami.status).toBe(401);
        expect(await whoami.json()).toMatchObject({
            error_code: 'UNAUTHORIZED',
        });
    });

    it('accepts X-API-Key and Authorization Bearer', async () => {
        const { app, basicSecret } = await buildSecuredApp();

        const viaHeader = await app.request('/auth/whoami', {
            headers: { 'X-API-Key': basicSecret },
        });
        expect(viaHeader.status).toBe(200);
        expect(await viaHeader.json()).toMatchObject({
            user_id: 'user-basic',
            key_id: 'key-basic',
        });

        const viaBearer = await app.request('/auth/whoami', {
            headers: { Authorization: `Bearer ${basicSecret}` },
        });
        expect(viaBearer.status).toBe(200);
    });

    it('enforces admin-only route', async () => {
        const { app, basicSecret, adminSecret } = await buildSecuredApp();

        const denied = await app.request('/admin/ping', {
            headers: { 'X-API-Key': basicSecret },
        });
        expect(denied.status).toBe(403);
        expect(await denied.json()).toMatchObject({
            error_code: 'FORBIDDEN',
        });

        const allowed = await app.request('/admin/ping', {
            headers: { 'X-API-Key': adminSecret },
        });
        expect(allowed.status).toBe(200);
    });
});

