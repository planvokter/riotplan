/**
 * run_command tool - Execute shell commands
 */

import { spawn } from 'node:child_process';
import { resolve, isAbsolute } from 'node:path';
import type { Tool } from '@kjerneverk/agentic';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_OUTPUT_SIZE = 50 * 1024; // 50KB

export interface RunCommandParams {
    command: string;
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
}

export interface RunCommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
}

export async function runCommandImpl(
    params: RunCommandParams,
    workingDirectory: string
): Promise<string> {
    const cwd = params.cwd 
        ? (isAbsolute(params.cwd) ? params.cwd : resolve(workingDirectory, params.cwd))
        : workingDirectory;

    const timeout = Math.min(params.timeout || DEFAULT_TIMEOUT, 60000); // Max 60s

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let timedOut = false;

        // Use shell to execute the command
        const proc = spawn(params.command, {
            shell: true,
            cwd,
            env: { ...process.env, ...params.env },
        });

        const timeoutId = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGTERM');
            setTimeout(() => proc.kill('SIGKILL'), 1000);
        }, timeout);

        proc.stdout.on('data', (data) => {
            const chunk = data.toString();
            if (stdout.length + chunk.length <= MAX_OUTPUT_SIZE) {
                stdout += chunk;
            }
        });

        proc.stderr.on('data', (data) => {
            const chunk = data.toString();
            if (stderr.length + chunk.length <= MAX_OUTPUT_SIZE) {
                stderr += chunk;
            }
        });

        proc.on('close', (code) => {
            clearTimeout(timeoutId);
            
            let result = '';
            
            if (timedOut) {
                result += `[Command timed out after ${timeout}ms]\n\n`;
            }
            
            if (stdout) {
                result += `STDOUT:\n${stdout}\n`;
            }
            
            if (stderr) {
                result += `STDERR:\n${stderr}\n`;
            }
            
            result += `\nExit code: ${code ?? 'unknown'}`;
            
            resolve(result.trim());
        });

        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            resolve(`Error executing command: ${err.message}`);
        });
    });
}

export const runCommandTool: Tool = {
    name: 'run_command',
    description: 'Execute a shell command and return its output. Commands run with a timeout (default 30s, max 60s). Use for git operations, npm commands, build tools, etc.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to execute',
            },
            cwd: {
                type: 'string',
                description: 'Working directory for the command (defaults to current working directory)',
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 30000, max: 60000)',
            },
            env: {
                type: 'object',
                description: 'Additional environment variables to set',
            },
        },
        required: ['command'],
    },
    category: 'environment',
    cost: 'moderate',
    execute: async (params: RunCommandParams, context) => {
        const workingDirectory = context?.workingDirectory || process.cwd();
        return runCommandImpl(params, workingDirectory);
    },
};
