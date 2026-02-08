#!/usr/bin/env node
/**
 * Build script for MCP server
 * 
 * This script bundles the MCP server into a single executable file
 * and copies the prompt markdown files to the dist directory.
 */

import { build } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function buildMcpServer() {
    console.log('Building MCP server...');
    
    await build({
        configFile: false,
        build: {
            lib: {
                entry: resolve(rootDir, 'src/mcp/server.ts'),
                formats: ['es'],
                fileName: () => 'mcp-server.js',
            },
            outDir: resolve(rootDir, 'dist'),
            emptyOutDir: false,
            rollupOptions: {
                external: [
                    '@modelcontextprotocol/sdk',
                    '@modelcontextprotocol/sdk/server/mcp.js',
                    '@modelcontextprotocol/sdk/server/stdio.js',
                    'zod',
                    '@utilarium/cardigantime',
                    '@kjerneverk/execution',
                    '@kjerneverk/execution-anthropic',
                    '@kjerneverk/execution-openai',
                    '@kjerneverk/execution-gemini',
                    '@kjerneverk/riotprompt',
                    '@kjerneverk/agentic',
                    /^node:/,
                ],
            },
        },
    });

    console.log('MCP server built successfully');
}


function copyPrompts() {
    console.log('Copying prompt files...');
    
    const promptsDir = resolve(rootDir, 'src/mcp/prompts');
    const distPromptsDir = resolve(rootDir, 'dist/mcp/prompts');
    
    // Create dist prompts directory
    mkdirSync(distPromptsDir, { recursive: true });
    
    // Copy all .md files
    const files = readdirSync(promptsDir);
    for (const file of files) {
        const filePath = resolve(promptsDir, file);
        const stat = statSync(filePath);
        
        if (stat.isFile() && file.endsWith('.md')) {
            const destPath = resolve(distPromptsDir, file);
            copyFileSync(filePath, destPath);
            console.log(`  Copied ${file}`);
        }
    }
    
    console.log('Prompt files copied successfully');
}

async function main() {
    try {
        await buildMcpServer();
        copyPrompts();
        console.log('MCP build complete!');
    } catch (error) {
        console.error('MCP build failed:', error);
        process.exit(1);
    }
}

main();
