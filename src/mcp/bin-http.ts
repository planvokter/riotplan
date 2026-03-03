#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * RiotPlan HTTP MCP Server CLI
 *
 * Uses CardiganTime for unified configuration from CLI args, config files, and env vars.
 *
 * Usage:
 *   riotplan-mcp-http --plans-dir /path/to/plans
 *   riotplan-mcp-http --port 3000 --plans-dir /path/to/plans
 *   riotplan-mcp-http --port 3000 --plans-dir /path/to/plans --no-cors
 *   PORT=3002 riotplan-mcp-http --plans-dir /path/to/plans
 *   MCP_PORT=3002 riotplan-mcp-http --plans-dir /path/to/plans
 *   RIOTPLAN_CLOUD_ENABLED=true riotplan-mcp-http --cloud-plan-bucket my-plans --cloud-context-bucket my-context
 *
 * Config file (riotplan-http.config.yaml in cwd or any parent directory):
 *   plansDir: /path/to/plans
 *   port: 3002
 *   debug: false
 *   cors: true
 *   sessionTimeout: 3600000
 */

import * as Cardigantime from '@utilarium/cardigantime';
import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const HttpServerConfigSchema = z.object({
    port: z.number().min(1).max(65535).optional(),
    plansDir: z.string().optional(),
    contextDir: z.string().optional(),
    debug: z.boolean().default(false),
    cors: z.boolean().default(true),
    sessionTimeout: z.number().min(0).default(3600000),
    secured: z.boolean().default(false),
    rbacUsersPath: z.string().optional(),
    rbacKeysPath: z.string().optional(),
    rbacPolicyPath: z.string().optional(),
    rbacReloadSeconds: z.number().int().min(0).optional(),
    cloud: z.object({
        enabled: z.boolean().optional(),
        incrementalSyncEnabled: z.boolean().optional(),
        syncFreshnessTtlMs: z.number().int().min(0).optional(),
        syncTimeoutMs: z.number().int().min(1).optional(),
        planBucket: z.string().optional(),
        planPrefix: z.string().optional(),
        contextBucket: z.string().optional(),
        contextPrefix: z.string().optional(),
        projectId: z.string().optional(),
        keyFilename: z.string().optional(),
        credentialsJson: z.string().optional(),
        cacheDirectory: z.string().optional(),
    }).optional(),
});

const cardigantime = Cardigantime.create({
    defaults: {
        configDirectory: process.cwd(),
        configFile: 'riotplan-http.config.yaml',
        isRequired: false,
        pathResolution: {
            pathFields: [
                'plansDir',
                'contextDir',
                'rbacUsersPath',
                'rbacKeysPath',
                'rbacPolicyPath',
                'cloud.keyFilename',
                'cloud.cacheDirectory',
            ],
        },
    },
    configShape: HttpServerConfigSchema.shape,
    features: ['config'],
});

/**
 * Resolve port from config or environment variables.
 * Priority: explicit config value → MCP_PORT → PORT → 3000
 */
function resolvePort(configPort: number | undefined): number {
    if (configPort !== undefined) return configPort;
    for (const envVar of ['MCP_PORT', 'PORT']) {
        const val = process.env[envVar];
        if (val) {
            const port = parseInt(val, 10);
            if (!isNaN(port) && port >= 1 && port <= 65535) return port;
        }
    }
    return 3000;
}

function configureHttpLogLevel(debug: boolean): void {
    const packageName = '@kjerneverk/riotplan-http';
    const logLevel = debug ? 'DEBUG' : 'INFO';
    let parsed: Record<string, unknown> = {};
    const raw = process.env.LOGGING_CONFIG;

    if (raw) {
        try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
            parsed = {};
        }
    }

    const overrides = (parsed.overrides as Record<string, unknown> | undefined) || {};
    const packageOverride = (overrides[packageName] as Record<string, unknown> | undefined) || {};

    process.env.LOGGING_CONFIG = JSON.stringify({
        logLevel: parsed.logLevel || 'INFO',
        logFormat: parsed.logFormat || 'TEXT',
        ...parsed,
        overrides: {
            ...overrides,
            [packageName]: {
                ...packageOverride,
                logLevel,
            },
        },
    });
}

function isTruthy(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return /^(1|true|yes|on)$/i.test(value);
    return false;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}

async function main() {
    const program = new Command();

    program
        .name('riotplan-mcp-http')
        .description('RiotPlan HTTP MCP Server')
        .version('1.0.0');

    await cardigantime.configure(program);

    program
        .option('-p, --port <port>', 'Port to listen on (overrides MCP_PORT / PORT env vars, default: 3000)', parseInt)
        .option('-d, --plans-dir <path>', 'Plans directory path (required in local mode; optional in cloud mode)')
        .option('--context-dir <path>', 'Context directory path (defaults to plans directory)')
        .option('--debug', 'Enable debug logging and set HTTP logger level to DEBUG (or set RIOTPLAN_DEBUG=true)')
        .option('--no-cors', 'Disable CORS')
        .option('-t, --session-timeout <ms>', 'Session timeout in milliseconds', parseInt)
        .option('--cloud-enabled', 'Enable GCS-backed cloud mode')
        .option('--cloud-incremental-sync-enabled', 'Enable incremental sync optimizations')
        .option('--cloud-sync-freshness-ttl-ms <ms>', 'Skip repeated sync_down within this TTL window (0 disables)', parseInt)
        .option('--cloud-sync-timeout-ms <ms>', 'Timeout for a single cloud sync operation', parseInt)
        .option('--cloud-plan-bucket <bucket>', 'GCS bucket for plan files')
        .option('--cloud-plan-prefix <prefix>', 'GCS object prefix for plan files')
        .option('--cloud-context-bucket <bucket>', 'GCS bucket for context files')
        .option('--cloud-context-prefix <prefix>', 'GCS object prefix for context files')
        .option('--cloud-project-id <id>', 'Google Cloud project ID')
        .option('--cloud-key-filename <path>', 'Path to Google service account JSON file')
        .option('--cloud-credentials-json <json>', 'Inline Google credentials JSON payload')
        .option('--cloud-cache-directory <path>', 'Local cache directory for mirrored cloud data')
        .option('--secured', 'Enable API key authentication + RBAC authorization')
        .option('--rbac-users-path <path>', 'Path to RBAC users file (YAML or JSON)')
        .option('--rbac-keys-path <path>', 'Path to RBAC keys file (YAML or JSON)')
        .option('--rbac-policy-path <path>', 'Optional path to RBAC policy file (YAML or JSON)')
        .option('--rbac-reload-seconds <seconds>', 'Optional RBAC periodic reload interval in seconds', parseInt);

    program.parse();

    const opts = program.opts();

    // Honor CardiganTime built-in utility flags before normal server startup.
    if (opts.initConfig) {
        await cardigantime.generateConfig(opts.configDirectory);
        return;
    }
    if (opts.checkConfig) {
        await cardigantime.checkConfig(opts);
        const fileConfig = await cardigantime.read(opts);
        const effectivePort = resolvePort(fileConfig.port as number | undefined);
        const cloudEnabled = isTruthy((fileConfig.cloud as Record<string, unknown> | undefined)?.enabled);
        let effectivePlansDir = fileConfig.plansDir ? resolve(fileConfig.plansDir as string) : undefined;
        let effectiveContextDir = fileConfig.contextDir
            ? resolve(fileConfig.contextDir as string)
            : effectivePlansDir;
        if (!effectivePlansDir && cloudEnabled) {
            const cacheRoot = resolve(
                firstNonEmpty(
                    (fileConfig.cloud as Record<string, unknown> | undefined)?.cacheDirectory as string | undefined,
                    process.env.RIOTPLAN_CLOUD_CACHE_DIR
                ) || join(process.cwd(), '.riotplan-http-cache')
            );
            effectivePlansDir = join(cacheRoot, 'plans');
            effectiveContextDir = join(cacheRoot, 'context');
        }
        console.log('\nEffective Runtime Configuration');
        console.log('--------------------------------');
        console.log(`port: ${effectivePort}`);
        console.log(`plansDir: ${effectivePlansDir ?? '(not set)'}`);
        console.log(`contextDir: ${effectiveContextDir ?? '(not set)'}`);
        console.log(`secured: ${(fileConfig.secured as boolean) === true}`);
        console.log(`rbacUsersPath: ${(fileConfig.rbacUsersPath as string | undefined) ?? '(not set)'}`);
        console.log(`rbacKeysPath: ${(fileConfig.rbacKeysPath as string | undefined) ?? '(not set)'}`);
        console.log(`rbacPolicyPath: ${(fileConfig.rbacPolicyPath as string | undefined) ?? '(not set)'}`);
        console.log(`rbacReloadSeconds: ${(fileConfig.rbacReloadSeconds as number | undefined) ?? '(off)'}`);
        return;
    }

    const fileConfig = await cardigantime.read(opts);

    // CardiganTime's read() loads from config files but does not merge CLI args into the result.
    // Overlay CLI opts (higher precedence) for our schema fields.
    const mergedCloud = {
        ...(fileConfig.cloud as Record<string, unknown> | undefined),
        ...(opts.cloudEnabled !== undefined && { enabled: opts.cloudEnabled }),
        ...(opts.cloudIncrementalSyncEnabled !== undefined && { incrementalSyncEnabled: opts.cloudIncrementalSyncEnabled }),
        ...(opts.cloudSyncFreshnessTtlMs !== undefined && { syncFreshnessTtlMs: opts.cloudSyncFreshnessTtlMs }),
        ...(opts.cloudSyncTimeoutMs !== undefined && { syncTimeoutMs: opts.cloudSyncTimeoutMs }),
        ...(opts.cloudPlanBucket !== undefined && { planBucket: opts.cloudPlanBucket }),
        ...(opts.cloudPlanPrefix !== undefined && { planPrefix: opts.cloudPlanPrefix }),
        ...(opts.cloudContextBucket !== undefined && { contextBucket: opts.cloudContextBucket }),
        ...(opts.cloudContextPrefix !== undefined && { contextPrefix: opts.cloudContextPrefix }),
        ...(opts.cloudProjectId !== undefined && { projectId: opts.cloudProjectId }),
        ...(opts.cloudKeyFilename !== undefined && { keyFilename: opts.cloudKeyFilename }),
        ...(opts.cloudCredentialsJson !== undefined && { credentialsJson: opts.cloudCredentialsJson }),
        ...(opts.cloudCacheDirectory !== undefined && { cacheDirectory: opts.cloudCacheDirectory }),
        ...(process.env.RIOTPLAN_CLOUD_ENABLED !== undefined && { enabled: /^(1|true|yes|on)$/i.test(process.env.RIOTPLAN_CLOUD_ENABLED) }),
        ...(process.env.RIOTPLAN_CLOUD_INCREMENTAL_SYNC_ENABLED !== undefined && {
            incrementalSyncEnabled: /^(1|true|yes|on)$/i.test(process.env.RIOTPLAN_CLOUD_INCREMENTAL_SYNC_ENABLED),
        }),
        ...(process.env.RIOTPLAN_CLOUD_SYNC_FRESHNESS_TTL_MS !== undefined && {
            syncFreshnessTtlMs: parseInt(process.env.RIOTPLAN_CLOUD_SYNC_FRESHNESS_TTL_MS, 10),
        }),
        ...(process.env.RIOTPLAN_CLOUD_SYNC_TIMEOUT_MS !== undefined && {
            syncTimeoutMs: parseInt(process.env.RIOTPLAN_CLOUD_SYNC_TIMEOUT_MS, 10),
        }),
        ...(process.env.RIOTPLAN_PLAN_BUCKET !== undefined && { planBucket: process.env.RIOTPLAN_PLAN_BUCKET }),
        ...(process.env.RIOTPLAN_PLAN_PREFIX !== undefined && { planPrefix: process.env.RIOTPLAN_PLAN_PREFIX }),
        ...(process.env.RIOTPLAN_CONTEXT_BUCKET !== undefined && { contextBucket: process.env.RIOTPLAN_CONTEXT_BUCKET }),
        ...(process.env.RIOTPLAN_CONTEXT_PREFIX !== undefined && { contextPrefix: process.env.RIOTPLAN_CONTEXT_PREFIX }),
        ...(process.env.GOOGLE_CLOUD_PROJECT !== undefined && { projectId: process.env.GOOGLE_CLOUD_PROJECT }),
        ...(process.env.GOOGLE_APPLICATION_CREDENTIALS !== undefined && { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }),
        ...(process.env.GOOGLE_CREDENTIALS_JSON !== undefined && { credentialsJson: process.env.GOOGLE_CREDENTIALS_JSON }),
        ...(process.env.RIOTPLAN_CLOUD_CACHE_DIR !== undefined && { cacheDirectory: process.env.RIOTPLAN_CLOUD_CACHE_DIR }),
    };

    const config = {
        ...fileConfig,
        ...(opts.plansDir !== undefined && { plansDir: opts.plansDir }),
        ...(opts.contextDir !== undefined && { contextDir: opts.contextDir }),
        ...(opts.port !== undefined && { port: opts.port }),
        ...(opts.debug !== undefined && { debug: opts.debug }),
        ...(opts.cors !== undefined && { cors: opts.cors }),
        ...(opts.sessionTimeout !== undefined && { sessionTimeout: opts.sessionTimeout }),
        ...(opts.secured !== undefined && { secured: opts.secured }),
        ...(opts.rbacUsersPath !== undefined && { rbacUsersPath: opts.rbacUsersPath }),
        ...(opts.rbacKeysPath !== undefined && { rbacKeysPath: opts.rbacKeysPath }),
        ...(opts.rbacPolicyPath !== undefined && { rbacPolicyPath: opts.rbacPolicyPath }),
        ...(opts.rbacReloadSeconds !== undefined && { rbacReloadSeconds: opts.rbacReloadSeconds }),
        ...(process.env.RIOTPLAN_HTTP_SECURED !== undefined && { secured: /^(1|true|yes|on)$/i.test(process.env.RIOTPLAN_HTTP_SECURED) }),
        ...(process.env.RBAC_USERS_PATH !== undefined && { rbacUsersPath: process.env.RBAC_USERS_PATH }),
        ...(process.env.RBAC_KEYS_PATH !== undefined && { rbacKeysPath: process.env.RBAC_KEYS_PATH }),
        ...(process.env.RBAC_POLICY_PATH !== undefined && { rbacPolicyPath: process.env.RBAC_POLICY_PATH }),
        ...(process.env.RBAC_RELOAD_SECONDS !== undefined && { rbacReloadSeconds: parseInt(process.env.RBAC_RELOAD_SECONDS, 10) }),
        ...(Object.keys(mergedCloud).length > 0 && { cloud: mergedCloud }),
    };

    const port = resolvePort(config.port as number | undefined);
    const cloudEnabled = isTruthy((config.cloud as Record<string, unknown> | undefined)?.enabled);
    let plansDir = config.plansDir ? resolve(config.plansDir as string) : undefined;
    let contextDir = config.contextDir ? resolve(config.contextDir as string) : plansDir;

    if (!plansDir && cloudEnabled) {
        const cacheRoot = resolve(
            firstNonEmpty(
                (config.cloud as Record<string, unknown> | undefined)?.cacheDirectory as string | undefined,
                process.env.RIOTPLAN_CLOUD_CACHE_DIR
            ) || join(process.cwd(), '.riotplan-http-cache')
        );
        plansDir = join(cacheRoot, 'plans');
        // In cloud mode without explicit roots, use cache-backed mirror directories.
        contextDir = contextDir || join(cacheRoot, 'context');
        console.log(`Cloud mode: derived plans directory ${plansDir}`);
        console.log(`Cloud mode: derived context directory ${contextDir}`);
    }
    const debug = (config.debug as boolean) === true;
    const cors = (config.cors as boolean) !== false;
    const sessionTimeout = (config.sessionTimeout as number) ?? 3600000;
    const secured = (config.secured as boolean) === true;
    const rbacUsersPath = config.rbacUsersPath ? resolve(config.rbacUsersPath as string) : undefined;
    const rbacKeysPath = config.rbacKeysPath ? resolve(config.rbacKeysPath as string) : undefined;
    const rbacPolicyPath = config.rbacPolicyPath ? resolve(config.rbacPolicyPath as string) : undefined;
    const rbacReloadSeconds = config.rbacReloadSeconds !== undefined ? Number(config.rbacReloadSeconds) : undefined;

    if (!plansDir) {
        console.error(
            'Error: Plans directory is required in local mode. Use --plans-dir or set plansDir in riotplan-http.config.yaml. In cloud mode, set cloud.enabled=true (or RIOTPLAN_CLOUD_ENABLED=true) to allow derived runtime directories.'
        );
        process.exit(1);
    }

    if (!existsSync(plansDir)) {
        if (cloudEnabled) {
            await mkdir(plansDir, { recursive: true });
        } else {
            console.error(`Error: Plans directory does not exist: ${plansDir}`);
            process.exit(1);
        }
    }
    if (!contextDir) {
        contextDir = plansDir;
    }
    if (!existsSync(contextDir)) {
        if (cloudEnabled) {
            await mkdir(contextDir, { recursive: true });
        } else {
            console.error(`Error: Context directory does not exist: ${contextDir}`);
            process.exit(1);
        }
    }

    if (!existsSync(plansDir)) {
        console.error(`Error: Plans directory does not exist: ${plansDir}`);
        process.exit(1);
    }
    if (!existsSync(contextDir)) {
        console.error(`Error: Context directory does not exist: ${contextDir}`);
        process.exit(1);
    }

    if (isNaN(sessionTimeout) || sessionTimeout < 0) {
        console.error(`Error: Invalid session timeout: ${sessionTimeout}`);
        process.exit(1);
    }

    if (secured) {
        if (!rbacUsersPath) {
            console.error('Error: secured=true requires rbacUsersPath (or RBAC_USERS_PATH).');
            process.exit(1);
        }
        if (!rbacKeysPath) {
            console.error('Error: secured=true requires rbacKeysPath (or RBAC_KEYS_PATH).');
            process.exit(1);
        }
        if (!existsSync(rbacUsersPath)) {
            console.error(`Error: RBAC users file does not exist: ${rbacUsersPath}`);
            process.exit(1);
        }
        if (!existsSync(rbacKeysPath)) {
            console.error(`Error: RBAC keys file does not exist: ${rbacKeysPath}`);
            process.exit(1);
        }
        if (rbacPolicyPath && !existsSync(rbacPolicyPath)) {
            console.error(`Error: RBAC policy file does not exist: ${rbacPolicyPath}`);
            process.exit(1);
        }
        if (rbacReloadSeconds !== undefined && (!Number.isFinite(rbacReloadSeconds) || rbacReloadSeconds < 0)) {
            console.error(`Error: Invalid RBAC reload interval: ${rbacReloadSeconds}`);
            process.exit(1);
        }
    }

    configureHttpLogLevel(debug);

    try {
        const { startServer } = await import('./server-hono.js');
        await startServer({
            port,
            plansDir,
            contextDir,
            debug,
            cors,
            sessionTimeout,
            cloud: config.cloud as any,
            security: {
                secured,
                rbacUsersPath,
                rbacKeysPath,
                rbacPolicyPath,
                rbacReloadSeconds,
            },
        });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
