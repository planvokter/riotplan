/**
 * Context Tool - Load all plan artifacts in a single call
 * 
 * This tool consolidates reading IDEA.md, SHAPING.md, evidence files,
 * and recent history into a single response, making it easy for models
 * to load full plan context at stage transitions.
 */

import { join } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';

export const readContextTool: McpTool = {
    name: 'riotplan_read_context',
    description:
        'Load all plan artifacts in a single call for stage transitions. ' +
        'Returns IDEA.md content, SHAPING.md content (if exists), evidence file list with previews, ' +
        'recent history events, and extracted constraints/questions. ' +
        'Use this at stage transitions to ensure you have full context before proceeding.',
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Plan directory path (defaults to current directory)',
            },
            depth: {
                type: 'string',
                enum: ['summary', 'full'],
                description: 'Level of detail: "summary" for metadata only, "full" for complete file contents (default: full)',
            },
        },
    },
};

interface EvidenceFile {
    name: string;
    preview: string;
    size: number;
}

interface HistoryEvent {
    type: string;
    timestamp: string;
    summary: string;
}

interface PlanContextResult {
    planPath: string;
    stage: string | null;
    idea: { content: string } | null;
    shaping: { content: string; selectedApproach: string | null } | null;
    evidence: {
        files: EvidenceFile[];
        count: number;
    };
    history: {
        recentEvents: HistoryEvent[];
        totalEvents: number;
    };
    lifecycle: { content: string } | null;
    constraints: string[];
    questions: string[];
}

/**
 * Read a file safely, returning null if it doesn't exist
 */
async function readFileSafe(path: string): Promise<string | null> {
    try {
        return await readFile(path, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Extract constraints from IDEA.md content
 */
function extractConstraints(ideaContent: string): string[] {
    const constraints: string[] = [];
    const constraintsMatch = ideaContent.match(/## Constraints\n\n([\s\S]*?)(?=\n## |$)/);
    if (constraintsMatch) {
        const lines = constraintsMatch[1].split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') && !trimmed.includes('_Add constraints')) {
                constraints.push(trimmed.substring(2));
            }
        }
    }
    return constraints;
}

/**
 * Extract questions from IDEA.md content
 */
function extractQuestions(ideaContent: string): string[] {
    const questions: string[] = [];
    const questionsMatch = ideaContent.match(/## Questions\n\n([\s\S]*?)(?=\n## |$)/);
    if (questionsMatch) {
        const lines = questionsMatch[1].split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') && !trimmed.includes('_Add questions')) {
                questions.push(trimmed.substring(2));
            }
        }
    }
    return questions;
}

/**
 * Extract selected approach from SHAPING.md content
 */
function extractSelectedApproach(shapingContent: string): string | null {
    const match = shapingContent.match(/\*\*Selected Approach\*\*: (.+)/);
    return match ? match[1].trim() : null;
}

/**
 * Extract stage from LIFECYCLE.md or IDEA.md
 */
function extractStage(lifecycleContent: string | null, ideaContent: string | null): string | null {
    // Try LIFECYCLE.md first
    if (lifecycleContent) {
        const match = lifecycleContent.match(/\*\*Stage\*\*: `(\w+)`/);
        if (match) return match[1];
    }
    // Fall back to IDEA.md
    if (ideaContent) {
        const match = ideaContent.match(/\*\*Stage\*\*: (\w+)/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Get first N lines of a file as preview
 */
function getPreview(content: string, lines: number = 5): string {
    return content.split('\n').slice(0, lines).join('\n');
}

/**
 * Read evidence files from the evidence directory
 */
async function readEvidenceFiles(planPath: string, depth: string): Promise<{ files: EvidenceFile[]; count: number }> {
    const evidenceDir = join(planPath, 'evidence');
    const dotEvidenceDir = join(planPath, '.evidence');
    
    // Try both evidence/ and .evidence/ directories
    let files: string[] = [];
    let actualDir = evidenceDir;
    
    try {
        files = await readdir(evidenceDir);
    } catch {
        try {
            files = await readdir(dotEvidenceDir);
            actualDir = dotEvidenceDir;
        } catch {
            return { files: [], count: 0 };
        }
    }
    
    const evidenceFiles: EvidenceFile[] = [];
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = join(actualDir, file);
        try {
            const stats = await stat(filePath);
            let preview = '';
            
            if (depth === 'full') {
                const content = await readFile(filePath, 'utf-8');
                preview = getPreview(content, 10);
            }
            
            evidenceFiles.push({
                name: file,
                preview,
                size: stats.size,
            });
        } catch {
            // Skip files we can't read
        }
    }
    
    return { files: evidenceFiles, count: evidenceFiles.length };
}

/**
 * Read recent history events from timeline.jsonl
 */
async function readRecentHistory(planPath: string, limit: number = 15): Promise<{ recentEvents: HistoryEvent[]; totalEvents: number }> {
    const timelinePath = join(planPath, '.history', 'timeline.jsonl');
    
    try {
        const content = await readFile(timelinePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const totalEvents = lines.length;
        
        // Get last N events
        const recentLines = lines.slice(-limit);
        const recentEvents: HistoryEvent[] = [];
        
        for (const line of recentLines) {
            try {
                const event = JSON.parse(line);
                recentEvents.push({
                    type: event.type || 'unknown',
                    timestamp: event.timestamp || '',
                    summary: summarizeEvent(event),
                });
            } catch {
                // Skip malformed lines
            }
        }
        
        return { recentEvents, totalEvents };
    } catch {
        return { recentEvents: [], totalEvents: 0 };
    }
}

/**
 * Create a brief summary of a timeline event
 */
function summarizeEvent(event: any): string {
    const type = event.type || 'unknown';
    const data = event.data || {};
    
    switch (type) {
        case 'note_added':
            return `Note: ${truncate(data.note, 60)}`;
        case 'constraint_added':
            return `Constraint: ${truncate(data.constraint, 60)}`;
        case 'question_added':
            return `Question: ${truncate(data.question, 60)}`;
        case 'evidence_added':
            return `Evidence: ${truncate(data.description, 60)}`;
        case 'narrative_chunk':
            return `Narrative: ${truncate(data.content, 60)}`;
        case 'approach_added':
            return `Approach: ${data.name || 'unnamed'}`;
        case 'approach_selected':
            return `Selected: ${data.approach || 'unknown'}`;
        case 'shaping_started':
            return 'Shaping started';
        case 'checkpoint_created':
            return `Checkpoint: ${data.name || 'unnamed'}`;
        default:
            return type;
    }
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

export async function executeReadContext(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = args.path ? args.path : resolveDirectory(args, context);
        const depth = args.depth || 'full';
        
        // Read all files in parallel
        const [ideaContent, shapingContent, lifecycleContent, evidence, history] = await Promise.all([
            readFileSafe(join(planPath, 'IDEA.md')),
            readFileSafe(join(planPath, 'SHAPING.md')),
            readFileSafe(join(planPath, 'LIFECYCLE.md')),
            readEvidenceFiles(planPath, depth),
            readRecentHistory(planPath),
        ]);
        
        // Build result
        const result: PlanContextResult = {
            planPath,
            stage: extractStage(lifecycleContent, ideaContent),
            idea: ideaContent ? { content: depth === 'full' ? ideaContent : getPreview(ideaContent, 20) } : null,
            shaping: shapingContent ? {
                content: depth === 'full' ? shapingContent : getPreview(shapingContent, 20),
                selectedApproach: extractSelectedApproach(shapingContent),
            } : null,
            evidence,
            history,
            lifecycle: lifecycleContent ? { content: depth === 'full' ? lifecycleContent : getPreview(lifecycleContent, 10) } : null,
            constraints: ideaContent ? extractConstraints(ideaContent) : [],
            questions: ideaContent ? extractQuestions(ideaContent) : [],
        };
        
        return createSuccess(result);
    } catch (error) {
        return formatError(error);
    }
}
