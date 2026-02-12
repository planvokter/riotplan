/**
 * Session Management for CLI Agent
 * 
 * Handles session lifecycle, transcript saving, and plan context loading.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Session statistics
 */
export interface SessionStats {
    messages: number;
    toolCalls: number;
    startTime: number;
    endTime?: number;
}

/**
 * Session transcript entry
 */
interface TranscriptEntry {
    timestamp: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string;
    toolCallId?: string;
}

/**
 * CLI Session Manager
 */
export class SessionManager {
    private planPath: string;
    private transcript: TranscriptEntry[] = [];
    private stats: SessionStats;

    constructor(planPath: string) {
        this.planPath = planPath;
        this.stats = {
            messages: 0,
            toolCalls: 0,
            startTime: Date.now(),
        };
    }

    /**
     * Record a user message
     */
    recordUserMessage(content: string): void {
        this.transcript.push({
            timestamp: new Date().toISOString(),
            role: 'user',
            content,
        });
        this.stats.messages++;
    }

    /**
     * Record an assistant message
     */
    recordAssistantMessage(content: string): void {
        this.transcript.push({
            timestamp: new Date().toISOString(),
            role: 'assistant',
            content,
        });
        this.stats.messages++;
    }

    /**
     * Record a tool call
     */
    recordToolCall(toolName: string, toolCallId: string, result: string): void {
        this.transcript.push({
            timestamp: new Date().toISOString(),
            role: 'tool',
            content: result,
            toolName,
            toolCallId,
        });
        this.stats.toolCalls++;
    }

    /**
     * Get session statistics
     */
    getStats(): SessionStats {
        return {
            ...this.stats,
            endTime: Date.now(),
        };
    }

    /**
     * Get session duration in milliseconds
     */
    getDuration(): number {
        return Date.now() - this.stats.startTime;
    }

    /**
     * Save transcript to plan's .history directory
     */
    async saveTranscript(): Promise<string | null> {
        if (this.transcript.length === 0) {
            return null;
        }

        const historyDir = path.join(this.planPath, '.history', 'transcripts');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `cli-session-${timestamp}.md`;
        const filepath = path.join(historyDir, filename);

        // Format transcript as markdown
        const content = this.formatTranscript();

        // Write file
        fs.writeFileSync(filepath, content, 'utf-8');

        return filepath;
    }

    /**
     * Format transcript as markdown
     */
    private formatTranscript(): string {
        const lines: string[] = [];
        
        lines.push('# CLI Session Transcript');
        lines.push('');
        lines.push(`**Started**: ${new Date(this.stats.startTime).toISOString()}`);
        lines.push(`**Ended**: ${new Date().toISOString()}`);
        lines.push(`**Messages**: ${this.stats.messages}`);
        lines.push(`**Tool Calls**: ${this.stats.toolCalls}`);
        lines.push('');
        lines.push('---');
        lines.push('');

        for (const entry of this.transcript) {
            const time = entry.timestamp.split('T')[1].split('.')[0];
            
            if (entry.role === 'user') {
                lines.push(`## [${time}] User`);
                lines.push('');
                lines.push(entry.content);
                lines.push('');
            } else if (entry.role === 'assistant') {
                lines.push(`## [${time}] Assistant`);
                lines.push('');
                lines.push(entry.content);
                lines.push('');
            } else if (entry.role === 'tool') {
                lines.push(`### [${time}] Tool: ${entry.toolName}`);
                lines.push('');
                lines.push('```');
                // Truncate long tool results
                const result = entry.content.length > 1000 
                    ? entry.content.slice(0, 1000) + '\n... (truncated)'
                    : entry.content;
                lines.push(result);
                lines.push('```');
                lines.push('');
            }
        }

        return lines.join('\n');
    }

    /**
     * Load plan context for resuming
     */
    async loadPlanContext(): Promise<{
        exists: boolean;
        stage?: string;
        notes?: number;
        constraints?: number;
        questions?: number;
        evidence?: number;
        lastActivity?: string;
    }> {
        const ideaPath = path.join(this.planPath, 'IDEA.md');
        const lifecyclePath = path.join(this.planPath, 'LIFECYCLE.md');
        
        if (!fs.existsSync(ideaPath) && !fs.existsSync(lifecyclePath)) {
            return { exists: false };
        }

        // Read LIFECYCLE.md for stage
        let stage = 'idea';
        if (fs.existsSync(lifecyclePath)) {
            const content = fs.readFileSync(lifecyclePath, 'utf-8');
            const stageMatch = content.match(/## Current Stage:\s*(\w+)/i);
            if (stageMatch) {
                stage = stageMatch[1].toLowerCase();
            }
        }

        // Count items in IDEA.md
        let notes = 0;
        let constraints = 0;
        let questions = 0;
        
        if (fs.existsSync(ideaPath)) {
            const content = fs.readFileSync(ideaPath, 'utf-8');
            
            // Count notes (lines starting with - in Notes section)
            const notesSection = content.match(/## Notes\n([\s\S]*?)(?=\n## |$)/);
            if (notesSection) {
                notes = (notesSection[1].match(/^- /gm) || []).length;
            }
            
            // Count constraints
            const constraintsSection = content.match(/## Constraints\n([\s\S]*?)(?=\n## |$)/);
            if (constraintsSection) {
                constraints = (constraintsSection[1].match(/^- /gm) || []).length;
            }
            
            // Count questions
            const questionsSection = content.match(/## Questions\n([\s\S]*?)(?=\n## |$)/);
            if (questionsSection) {
                questions = (questionsSection[1].match(/^- /gm) || []).length;
            }
        }

        // Count evidence files
        const evidenceDir = path.join(this.planPath, 'evidence');
        let evidence = 0;
        if (fs.existsSync(evidenceDir)) {
            const files = fs.readdirSync(evidenceDir);
            evidence = files.filter(f => f.endsWith('.md')).length;
        }

        // Get last activity from timeline
        let lastActivity: string | undefined;
        const timelinePath = path.join(this.planPath, '.history', 'timeline.jsonl');
        if (fs.existsSync(timelinePath)) {
            const content = fs.readFileSync(timelinePath, 'utf-8');
            const lines = content.trim().split('\n').filter(l => l);
            if (lines.length > 0) {
                try {
                    const lastEvent = JSON.parse(lines[lines.length - 1]);
                    lastActivity = lastEvent.type || lastEvent.event;
                } catch {
                    // Ignore parse errors
                }
            }
        }

        return {
            exists: true,
            stage,
            notes,
            constraints,
            questions,
            evidence,
            lastActivity,
        };
    }
}

/**
 * Create a session manager
 */
export function createSessionManager(planPath: string): SessionManager {
    return new SessionManager(planPath);
}
