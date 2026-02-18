/**
 * Terminal I/O for CLI Agent
 * 
 * Handles interactive input/output for LLM-powered CLI commands.
 * Supports multi-line paste detection - when lines arrive faster than
 * a human could type, they're buffered together as a single input.
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
    /** Timeout in ms to detect paste vs typing (default: 50ms) */
    pasteDetectionTimeout?: number;
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
    private pasteDetectionTimeout: number;
    private thinkingInterval: NodeJS.Timeout | null = null;
    private thinkingStartTime: number = 0;
    private isThinking: boolean = false;
    private inAssistantResponse: boolean = false;
    private readonly assistantIndent = '  '; // 2-space indent for assistant responses
    
    // Tool execution progress tracking
    private toolSpinnerInterval: NodeJS.Timeout | null = null;
    private toolStartTime: number = 0;
    private currentToolName: string = '';
    private toolSubMessage: string = '';
    private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private spinnerIndex = 0;

    constructor(options: TerminalOptions = {}) {
        this.prompt = options.prompt || chalk.bold.green('you> ');
        this.showToolCalls = options.showToolCalls ?? true;
        this.onExit = options.onExit;
        this.pasteDetectionTimeout = options.pasteDetectionTimeout ?? 50;
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
     * Read input from the user, with multi-line support.
     * 
     * Multi-line input methods:
     * 1. End a line with \ to continue on next line (like bash)
     * 2. Paste multiple lines (auto-detected by timing)
     */
    async readLine(): Promise<string> {
        if (!this.rl) {
            throw new Error('Terminal not initialized');
        }

        return new Promise((resolve) => {
            this.isReading = true;
            const lines: string[] = [];
            let timeoutId: NodeJS.Timeout | null = null;
            let lineHandler: ((line: string) => void) | null = null;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            let continuationMode = false; // True when last line ended with \

            const finishReading = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (lineHandler) {
                    this.rl!.removeListener('line', lineHandler);
                    lineHandler = null;
                }
                this.isReading = false;
                
                // Show indicator if we captured multiple lines
                if (lines.length > 1) {
                    this.writeLine(chalk.dim(`  [captured ${lines.length} lines]`));
                }
                
                // Join lines, removing trailing backslashes used for continuation
                const result = lines.map((line, i) => {
                    if (i < lines.length - 1 && line.endsWith('\\')) {
                        return line.slice(0, -1); // Remove trailing backslash
                    }
                    return line;
                }).join('\n');
                
                resolve(result);
            };

            lineHandler = (line: string) => {
                lines.push(line);
                
                // Clear any existing timeout
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                
                // Check if line ends with backslash (continuation)
                if (line.endsWith('\\')) {
                    continuationMode = true;
                    // Show continuation prompt
                    process.stdout.write(chalk.dim('... '));
                    return; // Don't set timeout, wait for next line
                }
                
                continuationMode = false;
                
                // Set a new timeout - if no more lines arrive within the timeout,
                // we consider the input complete (handles paste detection)
                timeoutId = setTimeout(finishReading, this.pasteDetectionTimeout);
            };

            // Show prompt and start listening
            process.stdout.write(this.prompt);
            this.rl!.on('line', lineHandler);
        });
    }

    /**
     * Show a thinking indicator that updates with elapsed time
     */
    showThinking(): void {
        if (this.isThinking) return;
        
        this.isThinking = true;
        this.thinkingStartTime = Date.now();
        
        // Add blank line after user input for visual separation, then show indicator with indent
        process.stdout.write('\n\n' + this.assistantIndent + chalk.dim('⏳ Thinking...'));
        
        // Update every second with elapsed time
        this.thinkingInterval = setInterval(() => {
            const elapsed = Math.round((Date.now() - this.thinkingStartTime) / 1000);
            // Clear line and rewrite with updated time (with indent)
            process.stdout.write('\r' + this.assistantIndent + chalk.dim(`⏳ Thinking... (${elapsed}s)`));
        }, 1000);
    }

    /**
     * Hide the thinking indicator and start assistant response
     */
    hideThinking(): void {
        if (!this.isThinking) return;
        
        if (this.thinkingInterval) {
            clearInterval(this.thinkingInterval);
            this.thinkingInterval = null;
        }
        
        // Clear the thinking line
        process.stdout.write('\r\x1b[K'); // Clear entire line
        this.isThinking = false;
        
        // Start assistant response mode with indent
        this.inAssistantResponse = true;
        process.stdout.write(this.assistantIndent);
    }

    /**
     * End the assistant response (called after response is complete)
     */
    endAssistantResponse(): void {
        if (this.inAssistantResponse) {
            this.inAssistantResponse = false;
            this.writeLine(); // Add blank line after response
        }
    }

    /**
     * Start a tool execution spinner for long-running tools
     */
    startToolSpinner(toolName: string): void {
        this.currentToolName = toolName;
        this.toolSubMessage = '';
        this.toolStartTime = Date.now();
        this.spinnerIndex = 0;
        
        // Update spinner every 100ms
        this.toolSpinnerInterval = setInterval(() => {
            const elapsed = Math.round((Date.now() - this.toolStartTime) / 1000);
            const frame = this.spinnerFrames[this.spinnerIndex % this.spinnerFrames.length];
            this.spinnerIndex++;
            
            // Only show elapsed time after 2 seconds
            const timeStr = elapsed >= 2 ? ` (${elapsed}s)` : '';
            const subMsg = this.toolSubMessage ? `: ${this.toolSubMessage}` : '';
            
            // Clear line and rewrite with spinner
            process.stdout.write(`\r\x1b[K${this.assistantIndent}${chalk.dim(`${frame} ${this.currentToolName}${subMsg}...${timeStr}`)}`);
        }, 100);
    }

    /**
     * Update the sub-message shown on the spinner (e.g., current file being read)
     */
    updateToolSpinner(message: string): void {
        this.toolSubMessage = message;
    }

    /**
     * Stop the tool execution spinner
     */
    stopToolSpinner(): void {
        if (this.toolSpinnerInterval) {
            clearInterval(this.toolSpinnerInterval);
            this.toolSpinnerInterval = null;
        }
        this.toolSubMessage = '';
        // Clear the spinner line
        process.stdout.write('\r\x1b[K');
    }

    /**
     * Write text to the terminal (no newline)
     * Handles newlines within text to maintain indentation for assistant responses
     */
    write(text: string): void {
        if (this.inAssistantResponse && text.includes('\n')) {
            // Split on newlines and add indent after each newline
            const parts = text.split('\n');
            for (let i = 0; i < parts.length; i++) {
                process.stdout.write(parts[i]);
                this.currentLine += parts[i];
                if (i < parts.length - 1) {
                    process.stdout.write('\n' + this.assistantIndent);
                    this.currentLine = '';
                }
            }
        } else {
            process.stdout.write(text);
            this.currentLine += text;
        }
    }

    /**
     * Write a line to the terminal
     */
    writeLine(text: string = ''): void {
        if (this.inAssistantResponse && text) {
            // Indent all lines in the text
            const indentedText = text.split('\n').join('\n' + this.assistantIndent);
            console.log(this.assistantIndent + indentedText);
        } else if (this.inAssistantResponse) {
            console.log(); // Empty line, no indent needed
        } else {
            console.log(text);
        }
        this.currentLine = '';
    }

    /**
     * Write an agent chunk to the terminal
     */
    writeChunk(chunk: AgentChunk): void {
        // Hide thinking indicator on first content (this also starts assistant response mode)
        if (this.isThinking && (chunk.type === 'text' || chunk.type === 'tool_start')) {
            this.hideThinking();
        }

        switch (chunk.type) {
            case 'text':
                if (chunk.text) {
                    // Use cyan color for assistant text (contrasts with green user prompt)
                    this.write(chalk.cyan(chunk.text));
                }
                break;

            case 'tool_start':
                if (this.showToolCalls && chunk.tool) {
                    // Clear current line if we have partial text
                    if (this.currentLine) {
                        this.writeLine();
                    }
                    const icon = this.getToolIcon(chunk.tool.name);
                    // For potentially long-running tools, start a spinner
                    const longRunningTools = ['rp_build', 'rp_generate', 'index_project'];
                    if (longRunningTools.some(t => chunk.tool?.name.includes(t))) {
                        this.startToolSpinner(chunk.tool.name);
                    } else {
                        this.writeLine(chalk.dim(`${icon} ${chunk.tool.name}...`));
                    }
                }
                break;

            case 'tool_result':
                // Stop any running spinner first
                this.stopToolSpinner();
                
                if (this.showToolCalls && chunk.tool) {
                    const icon = chunk.tool.error ? '❌' : '✓';
                    const status = chunk.tool.error 
                        ? chalk.red(`Error: ${chunk.tool.error}`)
                        : chalk.green('Done');
                    this.writeLine(chalk.dim(`${icon} ${status} (${chunk.tool.duration}ms)`));
                }
                break;

            case 'turn_complete':
                // Ensure we're on a fresh line before showing token usage
                if (this.currentLine) {
                    process.stdout.write('\n');
                    this.currentLine = '';
                }
                // End of a turn - show token usage and add spacing
                if (chunk.meta?.tokenUsage) {
                    const usage = chunk.meta.tokenUsage;
                    let usageStr = `📊 Tokens: ${usage.input.toLocaleString()} in, ${usage.output.toLocaleString()} out`;
                    if (usage.cacheRead && usage.cacheRead > 0) {
                        usageStr += chalk.green(` (${usage.cacheRead.toLocaleString()} cached)`);
                    }
                    if (usage.cacheCreation && usage.cacheCreation > 0) {
                        usageStr += chalk.yellow(` (+${usage.cacheCreation.toLocaleString()} cache write)`);
                    }
                    this.writeLine(chalk.dim(usageStr));
                }
                this.endAssistantResponse();
                break;

            case 'done':
                // Ensure we end on a new line
                if (this.currentLine) {
                    process.stdout.write('\n');
                    this.currentLine = '';
                }
                // Show final token usage
                if (chunk.meta?.tokenUsage) {
                    const usage = chunk.meta.tokenUsage;
                    let usageStr = `📊 Tokens: ${usage.input.toLocaleString()} in, ${usage.output.toLocaleString()} out`;
                    if (usage.cacheRead && usage.cacheRead > 0) {
                        usageStr += chalk.green(` (${usage.cacheRead.toLocaleString()} cached)`);
                    }
                    if (usage.cacheCreation && usage.cacheCreation > 0) {
                        usageStr += chalk.yellow(` (+${usage.cacheCreation.toLocaleString()} cache write)`);
                    }
                    this.writeLine(chalk.dim(usageStr));
                }
                this.endAssistantResponse();
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
        this.writeLine(chalk.dim('Type /done to exit, Ctrl-C to interrupt, \\ for multi-line'));
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
