import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { hashApiKeySecret, RbacEngine } from '../../src/mcp/rbac.js';

const logger = {
    info: () => undefined,
    warning: () => undefined,
    error: () => undefined,
};

describe('RBAC engine', () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(
            tempDirs.map(async (dir) => {
                await rm(dir, { recursive: true, force: true });
            })
        );
        tempDirs.length = 0;
    });

    async function makeConfig() {
        const dir = await mkdtemp(join(tmpdir(), 'riotplan-rbac-'));
        tempDirs.push(dir);
        const usersPath = join(dir, 'users.yaml');
        const keysPath = join(dir, 'keys.yaml');
        const policyPath = join(dir, 'policy.yaml');
        const secret = 'test-secret-value';
        const secretHash = await hashApiKeySecret(secret);

        await writeFile(
            usersPath,
            `users:
  - id: u-admin
    display_name: Admin User
    roles: [admin, writer]
    enabled: true
`
        );
        await writeFile(
            keysPath,
            `keys:
  - key_id: k-admin
    secret_hash: "${secretHash}"
    user_id: u-admin
    enabled: true
    created_at: "2026-03-03T00:00:00Z"
`
        );
        await writeFile(
            policyPath,
            `rules:
  "GET /custom/public":
    public: true
  "GET /custom/admin":
    any_roles: [admin]
`
        );

        return { usersPath, keysPath, policyPath, secret };
    }

    it('authenticates a key and resolves user auth context', async () => {
        const cfg = await makeConfig();
        const engine = new RbacEngine(cfg, logger);
        const decision = await engine.authenticate(cfg.secret);
        expect(decision.allowed).toBe(true);
        expect(decision.authContext).toEqual({
            user_id: 'u-admin',
            roles: ['admin', 'writer'],
            key_id: 'k-admin',
            allowed_projects: undefined,
        });
    });

    it('returns KEY_NOT_FOUND for missing or invalid secrets', async () => {
        const cfg = await makeConfig();
        const engine = new RbacEngine(cfg, logger);
        const missing = await engine.authenticate(null);
        expect(missing.reason).toBe('KEY_MISSING');
        const invalid = await engine.authenticate('wrong-secret');
        expect(invalid.reason).toBe('KEY_NOT_FOUND');
    });

    it('resolves default and file-provided policy rules', async () => {
        const cfg = await makeConfig();
        const engine = new RbacEngine(cfg, logger);
        const health = engine.getRouteRequirement('GET', '/health');
        expect(health?.public).toBe(true);
        const custom = engine.getRouteRequirement('GET', '/custom/admin');
        expect(custom?.anyRoles).toEqual(['admin']);
    });

    it('propagates allowed_projects from key to auth context', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'riotplan-rbac-allowed-projects-'));
        tempDirs.push(dir);
        const usersPath = join(dir, 'users.yaml');
        const keysPath = join(dir, 'keys.yaml');
        const secret = 'scoped-secret-value';
        const secretHash = await hashApiKeySecret(secret);

        await writeFile(
            usersPath,
            `users:
  - id: user-scoped
    display_name: Scoped User
    roles: [reader]
    enabled: true
`
        );
        await writeFile(
            keysPath,
            `keys:
  - key_id: key-scoped
    secret_hash: "${secretHash}"
    user_id: user-scoped
    enabled: true
    created_at: "2026-03-03T00:00:00Z"
    allowed_projects:
      - walmart/ops
`
        );

        const engine = new RbacEngine({ usersPath, keysPath }, logger);
        const decision = await engine.authenticate(secret);
        expect(decision.allowed).toBe(true);
        expect(decision.authContext?.allowed_projects).toEqual(['walmart/ops']);
    });
});

