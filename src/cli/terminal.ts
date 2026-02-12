/**
 * Terminal I/O for CLI Agent
 * 
 * Handles interactive input/output for LLM-powered CLI commands.
 */

import * as readline from 'node:readline';
import chalk from 'chalk';
import type { AgentChunk } from '@kjerneverk/agentic';

/**
 * Terminal session options
 */
export interface TerminalOptions {
    /** Prompt string for user input */
    prompt?: string;
    /** Whether to show tool call indicators */
    showToolCalls?: boolean;
    /** Callback when user wants to exit */
    onExit?: () => void;
}

/**
 * Terminal session for interactive agent conversation
 */
export class Terminal {
    private rl: readline.Interface | null = null;
    private prompt: string;
    private showToolCalls: boolean;
    private onExit?: () => void;
    private isReading: boolean = false;
    private currentLine: string = '';

    constructor(options: TerminalOptions = {}) {
        this.prompt = options.prompt || chalk.cyan('you> ');
        this.showToolCalls = options.showToolCalls ?? true;
        this.onExit = options.onExit;
    }

    /**
     * Initialize the terminal
     */
    init(): void {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
        });

        // Handle Ctrl-C gracefully
        this.rl.on('SIGINT', () => {
            this.writeLine('\n' + chalk.yellow('Interrupted'));
            this.onExit?.();
        });

        // Handle close
        this.rl.on('close', () => {
            this.onExit?.();
        });
    }

    /**
     * Close the terminal
     */
    close(): void {
        this.rl?.close();
        this.rl = null;
    }

    /**
     * Read a line of input from the user
     */
    async readLine(): Promise<string> {
        if (!this.rl) {
            throw new Error('Terminal not initialized');
        }

        return new Promise((resolve) => {
            this.isReading = true;
            this.rl!.question(this.prompt, (answer) => {
                this.isReading = false;
                resolve(answer);
            });
        });
    }

    /**
     * Write text to the terminal (no newline)
     */
    write(text: string): void {
        process.stdout.write(text);
        this.currentLine += text;
    }

    /**
     * Write a line to the terminal
     */
    writeLine(text: string = ''): void {
        console.log(text);
        this.currentLine = '';
    }

    /**
     * Write an agent chunk to the terminal
     */
    writeChunk(chunk: AgentChunk): void {
        switch (chunk.type) {
            case 'text':
                if (chunk.text) {
                    this.write(chunk.text);
                }
                break;

            case 'tool_start':
                if (this.showToolCalls && chunk.tool) {
                    // Clear current line if we have partial text
                    if (this.currentLine) {
                        this.writeLine();
                    }
                    const icon = this.getToolIcon(chunk.tool.name);
                    this.writeLine(chalk.dim(`${icon} ${chunk.tool.name}...`));
                }
                break;

            case 'tool_result':
                if (this.showToolCalls && chunk.tool) {
                    const icon = chunk.tool.error ? '❌' : '✓';
                    const status = chunk.tool.error 
                        ? chalk.red(`Error: ${chunk.tool.error}`)
                        : chalk.green('Done');
                    this.writeLine(chalk.dim(`  ${icon} ${status} (${chunk.tool.duration}ms)`));
                }
                break;

            case 'turn_complete':
                // Just a marker, no output needed
                break;

            case 'done':
                // Ensure we end on a new line
                if (this.currentLine) {
                    this.writeLine();
                }
                break;

            case 'error':
                if (chunk.error) {
                    this.writeLine(chalk.red(`Error: ${chunk.error.message}`));
                }
                break;
        }
    }

    /**
     * Get an icon for a tool name
     */
    private getToolIcon(toolName: string): string {
        if (toolName.startsWith('read_') || toolName === 'grep') {
            return '🔍';
        }
        if (toolName.startsWith('write_') || toolName.startsWith('edit_')) {
            return '✏️';
        }
        if (toolName === 'list_files') {
            return '📂';
        }
        if (toolName === 'run_command') {
            return '⚡';
        }
        if (toolName.startsWith('rp_idea') || toolName.includes('idea')) {
            return '💡';
        }
        if (toolName.startsWith('rp_shaping') || toolName.includes('shaping')) {
            return '🔧';
        }
        if (toolName.startsWith('rp_step') || toolName.includes('step')) {
            return '📋';
        }
        if (toolName.startsWith('rp_') || toolName.includes('riotplan')) {
            return '📝';
        }
        return '🔧';
    }

    /**
     * Show a banner at session start
     */
    showBanner(info: {
        planName?: string;
        planPath?: string;
        provider: string;
        model: string;
        mode: string;
    }): void {
        this.writeLine();
        this.writeLine(chalk.bold.blue('━━━ RiotPlan CLI ━━━'));
        if (info.planName) {
            this.writeLine(chalk.dim(`Plan: ${info.planName}`));
        }
        if (info.planPath) {
            this.writeLine(chalk.dim(`Path: ${info.planPath}`));
        }
        this.writeLine(chalk.dim(`Mode: ${info.mode}`));
        this.writeLine(chalk.dim(`Provider: ${info.provider} (${info.model})`));
        this.writeLine(chalk.dim('Type /done to exit, Ctrl-C to interrupt'));
        this.writeLine(chalk.blue('━━━━━━━━━━━━━━━━━━━━'));
        this.writeLine();
    }

    /**
     * Show a summary at session end
     */
    showSummary(stats: {
        messages: number;
        toolCalls: number;
        duration: number;
        notes?: number;
        constraints?: number;
        questions?: number;
        evidence?: number;
    }): void {
        this.writeLine();
        this.writeLine(chalk.blue('━━━ Session Summary ━━━'));
        this.writeLine(chalk.dim(`Messages: ${stats.messages}`));
        this.writeLine(chalk.dim(`Tool calls: ${stats.toolCalls}`));
        this.writeLine(chalk.dim(`Duration: ${Math.round(stats.duration / 1000)}s`));
        if (stats.notes !== undefined) {
            this.writeLine(chalk.dim(`Notes added: ${stats.notes}`));
        }
        if (stats.constraints !== undefined) {
            this.writeLine(chalk.dim(`Constraints added: ${stats.constraints}`));
        }
        if (stats.questions !== undefined) {
            this.writeLine(chalk.dim(`Questions added: ${stats.questions}`));
        }
        if (stats.evidence !== undefined) {
            this.writeLine(chalk.dim(`Evidence files: ${stats.evidence}`));
        }
        this.writeLine(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━'));
    }
}

/**
 * Create a terminal instance
 */
export function createTerminal(options?: TerminalOptions): Terminal {
    return new Terminal(options);
}
