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
import { resolve } from 'node:path';
import { z } from 'zod';
import { startServer } from './server-hono.js';

const HttpServerConfigSchema = z.object({
    port: z.number().min(1).max(65535).optional(),
    plansDir: z.string().optional(),
    contextDir: z.string().optional(),
    debug: z.boolean().default(false),
    cors: z.boolean().default(true),
    sessionTimeout: z.number().min(0).default(3600000),
    cloud: z.object({
        enabled: z.boolean().optional(),
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
            pathFields: ['plansDir', 'contextDir', 'cloud.keyFilename', 'cloud.cacheDirectory'],
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

async function main() {
    const program = new Command();

    program
        .name('riotplan-mcp-http')
        .description('RiotPlan HTTP MCP Server')
        .version('1.0.0');

    await cardigantime.configure(program);

    program
        .option('-p, --port <port>', 'Port to listen on (overrides MCP_PORT / PORT env vars, default: 3000)', parseInt)
        .option('-d, --plans-dir <path>', 'Plans directory path (required if not set in config file)')
        .option('--context-dir <path>', 'Context directory path (defaults to plans directory)')
        .option('--debug', 'Enable debug logging (or set RIOTPLAN_DEBUG=true)')
        .option('--no-cors', 'Disable CORS')
        .option('-t, --session-timeout <ms>', 'Session timeout in milliseconds', parseInt)
        .option('--cloud-enabled', 'Enable GCS-backed cloud mode')
        .option('--cloud-plan-bucket <bucket>', 'GCS bucket for plan files')
        .option('--cloud-plan-prefix <prefix>', 'GCS object prefix for plan files')
        .option('--cloud-context-bucket <bucket>', 'GCS bucket for context files')
        .option('--cloud-context-prefix <prefix>', 'GCS object prefix for context files')
        .option('--cloud-project-id <id>', 'Google Cloud project ID')
        .option('--cloud-key-filename <path>', 'Path to Google service account JSON file')
        .option('--cloud-credentials-json <json>', 'Inline Google credentials JSON payload')
        .option('--cloud-cache-directory <path>', 'Local cache directory for mirrored cloud data');

    program.parse();

    const opts = program.opts();
    const fileConfig = await cardigantime.read(opts);

    // CardiganTime's read() loads from config files but does not merge CLI args into the result.
    // Overlay CLI opts (higher precedence) for our schema fields.
    const mergedCloud = {
        ...(fileConfig.cloud as Record<string, unknown> | undefined),
        ...(opts.cloudEnabled !== undefined && { enabled: opts.cloudEnabled }),
        ...(opts.cloudPlanBucket !== undefined && { planBucket: opts.cloudPlanBucket }),
        ...(opts.cloudPlanPrefix !== undefined && { planPrefix: opts.cloudPlanPrefix }),
        ...(opts.cloudContextBucket !== undefined && { contextBucket: opts.cloudContextBucket }),
        ...(opts.cloudContextPrefix !== undefined && { contextPrefix: opts.cloudContextPrefix }),
        ...(opts.cloudProjectId !== undefined && { projectId: opts.cloudProjectId }),
        ...(opts.cloudKeyFilename !== undefined && { keyFilename: opts.cloudKeyFilename }),
        ...(opts.cloudCredentialsJson !== undefined && { credentialsJson: opts.cloudCredentialsJson }),
        ...(opts.cloudCacheDirectory !== undefined && { cacheDirectory: opts.cloudCacheDirectory }),
        ...(process.env.RIOTPLAN_CLOUD_ENABLED !== undefined && { enabled: /^(1|true|yes|on)$/i.test(process.env.RIOTPLAN_CLOUD_ENABLED) }),
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
        ...(Object.keys(mergedCloud).length > 0 && { cloud: mergedCloud }),
    };

    const port = resolvePort(config.port as number | undefined);
    const plansDir = config.plansDir ? resolve(config.plansDir as string) : undefined;
    const contextDir = config.contextDir ? resolve(config.contextDir as string) : plansDir;
    const debug = (config.debug as boolean) === true;
    const cors = (config.cors as boolean) !== false;
    const sessionTimeout = (config.sessionTimeout as number) ?? 3600000;

    if (!plansDir) {
        console.error('Error: Plans directory is required. Use --plans-dir or set plansDir in a riotplan-http.config.yaml file.');
        process.exit(1);
    }

    if (!existsSync(plansDir)) {
        console.error(`Error: Plans directory does not exist: ${plansDir}`);
        process.exit(1);
    }
    if (!contextDir || !existsSync(contextDir)) {
        console.error(`Error: Context directory does not exist: ${contextDir}`);
        process.exit(1);
    }

    if (isNaN(sessionTimeout) || sessionTimeout < 0) {
        console.error(`Error: Invalid session timeout: ${sessionTimeout}`);
        process.exit(1);
    }

    try {
        await startServer({ port, plansDir, contextDir, debug, cors, sessionTimeout, cloud: config.cloud as any });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
