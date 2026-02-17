#!/usr/bin/env node
/**
 * RiotPlan HTTP MCP Server CLI
 *
 * Command-line interface for starting the HTTP MCP server.
 *
 * Usage:
 *   riotplan-mcp-http --port 3000 --plans-dir /path/to/plans
 *   riotplan-mcp-http --port 3000 --plans-dir /path/to/plans --no-cors
 */

import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { startServer } from './server-hono.js';

const program = new Command();

program
    .name('riotplan-mcp-http')
    .description('RiotPlan HTTP MCP Server')
    .version('1.0.0')
    .requiredOption('-p, --port <port>', 'Port to listen on', '3000')
    .requiredOption('-d, --plans-dir <path>', 'Plans directory path')
    .option('--no-cors', 'Disable CORS')
    .option('-t, --timeout <ms>', 'Session timeout in milliseconds', '3600000')
    .action(async (options) => {
        const port = parseInt(options.port, 10);
        const plansDir = resolve(options.plansDir);
        const cors = options.cors !== false;
        const sessionTimeout = parseInt(options.timeout, 10);

        // Validate port
        if (isNaN(port) || port < 1 || port > 65535) {
            console.error(`Error: Invalid port number: ${options.port}`);
            process.exit(1);
        }

        // Validate plans directory
        if (!existsSync(plansDir)) {
            console.error(`Error: Plans directory does not exist: ${plansDir}`);
            process.exit(1);
        }

        // Validate timeout
        if (isNaN(sessionTimeout) || sessionTimeout < 0) {
            console.error(`Error: Invalid timeout: ${options.timeout}`);
            process.exit(1);
        }

        try {
            await startServer({
                port,
                plansDir,
                cors,
                sessionTimeout,
            });
        } catch (error) {
            console.error('Error starting server:', error);
            process.exit(1);
        }
    });

program.parse();
