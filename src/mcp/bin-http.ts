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
    cors: z.boolean().default(true),
    sessionTimeout: z.number().min(0).default(3600000),
});

const cardigantime = Cardigantime.create({
    defaults: {
        configDirectory: process.cwd(),
        configFile: 'riotplan-http.config',
        isRequired: false,
        pathResolution: {
            pathFields: ['plansDir'],
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
        .option('--no-cors', 'Disable CORS')
        .option('-t, --session-timeout <ms>', 'Session timeout in milliseconds', parseInt);

    program.parse();

    const opts = program.opts();
    const fileConfig = await cardigantime.read(opts);

    // CardiganTime's read() loads from config files but does not merge CLI args into the result.
    // Overlay CLI opts (higher precedence) for our schema fields.
    const config = {
        ...fileConfig,
        ...(opts.plansDir !== undefined && { plansDir: opts.plansDir }),
        ...(opts.port !== undefined && { port: opts.port }),
        ...(opts.cors !== undefined && { cors: opts.cors }),
        ...(opts.sessionTimeout !== undefined && { sessionTimeout: opts.sessionTimeout }),
    };

    const port = resolvePort(config.port as number | undefined);
    const plansDir = config.plansDir ? resolve(config.plansDir as string) : undefined;
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

    if (isNaN(sessionTimeout) || sessionTimeout < 0) {
        console.error(`Error: Invalid session timeout: ${sessionTimeout}`);
        process.exit(1);
    }

    try {
        await startServer({ port, plansDir, cors, sessionTimeout });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
