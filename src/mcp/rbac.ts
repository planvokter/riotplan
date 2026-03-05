import { readFileSync } from 'node:fs';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const UserSchema = z.object({
    id: z.string().min(1),
    display_name: z.string().min(1),
    roles: z.array(z.string().min(1)),
    enabled: z.boolean(),
    notes: z.string().optional(),
    created_at: z.string().datetime().optional(),
});

const KeySchema = z.object({
    key_id: z.string().min(1),
    secret_hash: z.string().min(1),
    user_id: z.string().min(1),
    enabled: z.boolean(),
    created_at: z.string().datetime(),
    expires_at: z.string().datetime().nullable().optional(),
    last_used_at: z.string().datetime().optional(),
    scopes: z.array(z.string().min(1)).optional(),
    allowed_projects: z.array(z.string().min(1)).optional(),
});

const UsersFileSchema = z.object({
    users: z.array(UserSchema),
});

const KeysFileSchema = z.object({
    keys: z.array(KeySchema),
});

const PolicyRuleSchema = z
    .object({
        public: z.boolean().optional(),
        any_roles: z.array(z.string().min(1)).optional(),
    })
    .refine((value) => value.public === true || (Array.isArray(value.any_roles) && value.any_roles.length > 0), {
        message: 'Each policy rule must define public=true or any_roles',
    });

const PolicyFileSchema = z.object({
    rules: z.record(z.string(), PolicyRuleSchema),
});

export interface HttpRbacConfig {
    usersPath: string;
    keysPath: string;
    policyPath?: string;
    reloadSeconds?: number;
}

export interface AuthContext {
    user_id: string;
    roles: string[];
    key_id: string;
    allowed_projects?: string[];
}

type DecisionReason =
    | 'ALLOW'
    | 'SECURED_DISABLED'
    | 'PUBLIC'
    | 'KEY_MISSING'
    | 'KEY_NOT_FOUND'
    | 'KEY_DISABLED'
    | 'EXPIRED'
    | 'USER_NOT_FOUND'
    | 'USER_DISABLED'
    | 'ROLE_MISSING'
    | 'POLICY_DENY'
    | 'SERVER_MISCONFIG';

interface ParsedKey extends z.infer<typeof KeySchema> {
    expiresAt: Date | null;
}

interface Snapshot {
    users: Map<string, z.infer<typeof UserSchema>>;
    keys: ParsedKey[];
    policyRules: Record<string, z.infer<typeof PolicyRuleSchema>>;
}

export interface RouteRequirement {
    public: boolean;
    anyRoles: string[] | null;
    source: string;
}

export interface AuthDecision {
    allowed: boolean;
    status: 200 | 401 | 403 | 500;
    reason: DecisionReason;
    authContext?: AuthContext;
}

const DEFAULT_ROUTE_RULES: Record<string, z.infer<typeof PolicyRuleSchema>> = {
    'GET /health': { public: true },
    'GET /auth/whoami': { any_roles: ['*'] },
    'GET /admin/ping': { any_roles: ['admin'] },
    'GET /plan/:planId': { any_roles: ['*'] },
    'POST /plan/upload': { any_roles: ['admin'] },
    'POST /mcp': { any_roles: ['*'] },
    'GET /mcp': { any_roles: ['*'] },
    'DELETE /mcp': { any_roles: ['*'] },
};

function parseConfigFile(path: string): unknown {
    const raw = readFileSync(path, 'utf8');
    if (path.endsWith('.json')) {
        return JSON.parse(raw);
    }
    if (path.endsWith('.yaml') || path.endsWith('.yml')) {
        return parseYaml(raw);
    }
    try {
        return JSON.parse(raw);
    } catch {
        return parseYaml(raw);
    }
}

function sha256Fingerprint(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function parseScryptHash(hash: string): {
    N: number;
    r: number;
    p: number;
    salt: Buffer;
    derivedKey: Buffer;
} | null {
    const parts = hash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
        return null;
    }
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N <= 1 || r <= 0 || p <= 0) {
        return null;
    }
    const salt = Buffer.from(parts[4], 'base64');
    const derivedKey = Buffer.from(parts[5], 'base64');
    if (salt.length === 0 || derivedKey.length === 0) {
        return null;
    }
    return { N, r, p, salt, derivedKey };
}

async function verifyScryptSecret(secret: string, encodedHash: string): Promise<boolean> {
    const parsed = parseScryptHash(encodedHash);
    if (!parsed) {
        return false;
    }
    const computed = scryptSync(secret, parsed.salt, parsed.derivedKey.length, {
        N: parsed.N,
        r: parsed.r,
        p: parsed.p,
        maxmem: 64 * 1024 * 1024,
    }) as Buffer;
    if (computed.length !== parsed.derivedKey.length) {
        return false;
    }
    return timingSafeEqual(computed, parsed.derivedKey);
}

export async function hashApiKeySecret(secret: string): Promise<string> {
    const N = 16384;
    const r = 8;
    const p = 1;
    const salt = randomBytes(16);
    const derived = scryptSync(secret, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }) as Buffer;
    return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export class RbacEngine {
    private snapshot: Snapshot;
    private reloadTimer?: NodeJS.Timeout;

    constructor(
        private readonly config: HttpRbacConfig,
        private readonly logger: {
            info: (event: string, details?: Record<string, unknown>) => void;
            warning: (event: string, details?: Record<string, unknown>) => void;
            error: (event: string, details?: Record<string, unknown>) => void;
        }
    ) {
        this.snapshot = this.loadSnapshotOrThrow();
        this.startReloadLoop();
    }

    private startReloadLoop(): void {
        const seconds = this.config.reloadSeconds ?? 0;
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return;
        }
        const intervalMs = Math.floor(seconds * 1000);
        this.reloadTimer = setInterval(() => {
            try {
                this.snapshot = this.loadSnapshotOrThrow();
                this.logger.info('rbac.reload.ok', {
                    usersPath: this.config.usersPath,
                    keysPath: this.config.keysPath,
                    policyPath: this.config.policyPath || null,
                });
            } catch (error) {
                this.logger.warning('rbac.reload.failed', {
                    usersPath: this.config.usersPath,
                    keysPath: this.config.keysPath,
                    policyPath: this.config.policyPath || null,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }, intervalMs);
        this.reloadTimer.unref?.();
    }

    private loadSnapshotOrThrow(): Snapshot {
        const usersData = UsersFileSchema.parse(parseConfigFile(this.config.usersPath));
        const keysData = KeysFileSchema.parse(parseConfigFile(this.config.keysPath));
        const userMap = new Map(usersData.users.map((user) => [user.id, user]));

        const keyIds = new Set<string>();
        const parsedKeys: ParsedKey[] = keysData.keys.map((key) => {
            if (keyIds.has(key.key_id)) {
                throw new Error(`Duplicate key_id "${key.key_id}" in RBAC keys file`);
            }
            keyIds.add(key.key_id);
            if (!userMap.has(key.user_id)) {
                throw new Error(`RBAC key "${key.key_id}" references unknown user_id "${key.user_id}"`);
            }
            if (!parseScryptHash(key.secret_hash)) {
                throw new Error(`RBAC key "${key.key_id}" has invalid secret_hash format (expected scrypt$...)`);
            }
            return {
                ...key,
                expiresAt: key.expires_at ? new Date(key.expires_at) : null,
            };
        });

        let policyRules: Record<string, z.infer<typeof PolicyRuleSchema>> = { ...DEFAULT_ROUTE_RULES };
        if (this.config.policyPath) {
            const parsedPolicy = PolicyFileSchema.parse(parseConfigFile(this.config.policyPath));
            policyRules = { ...policyRules, ...parsedPolicy.rules };
        }

        this.logger.info('rbac.loaded', {
            usersPath: this.config.usersPath,
            keysPath: this.config.keysPath,
            policyPath: this.config.policyPath || null,
            usersCount: userMap.size,
            keysCount: parsedKeys.length,
            policyRulesCount: Object.keys(policyRules).length,
            keyFingerprints: parsedKeys.map((key) => ({
                keyId: key.key_id,
                hashFingerprint: sha256Fingerprint(key.secret_hash),
            })),
        });

        return {
            users: userMap,
            keys: parsedKeys,
            policyRules,
        };
    }

    getRouteRequirement(method: string, routePattern: string): RouteRequirement | null {
        const key = `${method.toUpperCase()} ${routePattern}`;
        const fromMethodAndRoute = this.snapshot.policyRules[key];
        const fromRouteOnly = this.snapshot.policyRules[routePattern];
        const fromMethodWildcard = this.snapshot.policyRules[`${method.toUpperCase()} *`];
        const fromGlobalWildcard = this.snapshot.policyRules['*'];
        const selected = fromMethodAndRoute || fromRouteOnly || fromMethodWildcard || fromGlobalWildcard;
        if (!selected) {
            return null;
        }
        return {
            public: selected.public === true,
            anyRoles: selected.any_roles ? [...selected.any_roles] : null,
            source: fromMethodAndRoute
                ? key
                : fromRouteOnly
                    ? routePattern
                    : fromMethodWildcard
                        ? `${method.toUpperCase()} *`
                        : '*',
        };
    }

    async authenticate(rawSecret: string | null): Promise<AuthDecision> {
        if (!rawSecret || !rawSecret.trim()) {
            return { allowed: false, status: 401, reason: 'KEY_MISSING' };
        }
        const secret = rawSecret.trim();
        for (const key of this.snapshot.keys) {
            const matches = await verifyScryptSecret(secret, key.secret_hash);
            if (!matches) {
                continue;
            }
            if (!key.enabled) {
                return { allowed: false, status: 401, reason: 'KEY_DISABLED' };
            }
            if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
                return { allowed: false, status: 401, reason: 'EXPIRED' };
            }
            const user = this.snapshot.users.get(key.user_id);
            if (!user) {
                return { allowed: false, status: 401, reason: 'USER_NOT_FOUND' };
            }
            if (!user.enabled) {
                return { allowed: false, status: 401, reason: 'USER_DISABLED' };
            }
            return {
                allowed: true,
                status: 200,
                reason: 'ALLOW',
                authContext: {
                    user_id: user.id,
                    roles: [...user.roles],
                    key_id: key.key_id,
                    allowed_projects: Array.isArray(key.allowed_projects) && key.allowed_projects.length > 0
                        ? [...key.allowed_projects]
                        : undefined,
                },
            };
        }
        return { allowed: false, status: 401, reason: 'KEY_NOT_FOUND' };
    }

    authorize(authContext: AuthContext | undefined, anyRoles: string[] | null): AuthDecision {
        if (!authContext) {
            return { allowed: false, status: 401, reason: 'KEY_NOT_FOUND' };
        }
        if (!anyRoles || anyRoles.length === 0) {
            return { allowed: false, status: 403, reason: 'POLICY_DENY' };
        }
        if (anyRoles.includes('*')) {
            if (authContext.roles.length > 0) {
                return { allowed: true, status: 200, reason: 'ALLOW', authContext };
            }
            return { allowed: false, status: 403, reason: 'ROLE_MISSING', authContext };
        }
        const hasRole = anyRoles.some((role) => authContext.roles.includes(role));
        if (!hasRole) {
            return { allowed: false, status: 403, reason: 'ROLE_MISSING', authContext };
        }
        return { allowed: true, status: 200, reason: 'ALLOW', authContext };
    }
}

export function extractApiKeyFromHeaders(headers: Headers): string | null {
    const auth = headers.get('authorization');
    if (auth) {
        const match = auth.match(/^Bearer\s+(.+)$/i);
        if (match?.[1]) {
            return match[1].trim();
        }
    }
    const xApiKey = headers.get('x-api-key');
    if (xApiKey && xApiKey.trim()) {
        return xApiKey.trim();
    }
    return null;
}

