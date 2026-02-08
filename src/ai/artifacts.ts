/**
 * Artifact Loading Utilities
 * 
 * Shared functions for loading and extracting plan artifacts (IDEA.md, SHAPING.md, evidence, history)
 * Used by both build.ts and context.ts to ensure consistent artifact handling
 */

import { join } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';

export interface ArtifactBundle {
    ideaContent: string | null;
    shapingContent: string | null;
    lifecycleContent: string | null;
    constraints: string[];
    questions: string[];
    selectedApproach: {
        name: string;
        description: string;
        reasoning: string;
    } | null;
    evidence: {
        name: string;
        content: string;
        size: number;
    }[];
    historyContext: {
        recentEvents: { type: string; timestamp: string; summary: string }[];
        totalEvents: number;
    };
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
export function extractConstraints(ideaContent: string): string[] {
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
export function extractQuestions(ideaContent: string): string[] {
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
export function extractSelectedApproach(shapingContent: string): {
    name: string;
    description: string;
    reasoning: string;
} | null {
    // Extract approach name
    const nameMatch = shapingContent.match(/\*\*Selected Approach\*\*: (.+)/);
    if (!nameMatch) return null;
    
    const approachName = nameMatch[1].trim();
    
    // Find the approach section
    const approachPattern = new RegExp(`### Approach: ${approachName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+\\*\\*Description\\*\\*: ([\\s\\S]*?)(?:\\*\\*Tradeoffs\\*\\*:|### Approach:|## |$)`);
    const approachMatch = shapingContent.match(approachPattern);
    
    // Extract reasoning
    const reasoningMatch = shapingContent.match(/\*\*Reasoning\*\*: ([^\n]+)/);
    
    return {
        name: approachName,
        description: approachMatch ? approachMatch[1].trim() : '',
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
    };
}

/**
 * Read evidence files from the evidence directory
 */
export async function readEvidenceFiles(planPath: string, includeContent: boolean = true): Promise<{
    name: string;
    content: string;
    size: number;
}[]> {
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
            return [];
        }
    }
    
    const evidenceFiles: { name: string; content: string; size: number }[] = [];
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = join(actualDir, file);
        try {
            const stats = await stat(filePath);
            let content = '';
            
            if (includeContent) {
                const fileContent = await readFile(filePath, 'utf-8');
                content = fileContent;
            }
            
            evidenceFiles.push({
                name: file,
                content,
                size: stats.size,
            });
        } catch {
            // Skip files we can't read
        }
    }
    
    return evidenceFiles;
}

/**
 * Read recent history events from timeline.jsonl
 */
export async function readRecentHistory(planPath: string, limit: number = 15): Promise<{
    recentEvents: { type: string; timestamp: string; summary: string }[];
    totalEvents: number;
}> {
    const timelinePath = join(planPath, '.history', 'timeline.jsonl');
    
    try {
        const content = await readFile(timelinePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const totalEvents = lines.length;
        
        // Get last N events
        const recentLines = lines.slice(-limit);
        const recentEvents: { type: string; timestamp: string; summary: string }[] = [];
        
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

/**
 * Load all plan artifacts into a structured bundle
 * 
 * This is the main entry point for artifact loading, used by build.ts
 */
export async function loadArtifacts(planPath: string): Promise<ArtifactBundle> {
    // Read all files in parallel
    const [ideaContent, shapingContent, lifecycleContent, evidence, history] = await Promise.all([
        readFileSafe(join(planPath, 'IDEA.md')),
        readFileSafe(join(planPath, 'SHAPING.md')),
        readFileSafe(join(planPath, 'LIFECYCLE.md')),
        readEvidenceFiles(planPath, true),
        readRecentHistory(planPath),
    ]);
    
    // Extract structured data
    const constraints = ideaContent ? extractConstraints(ideaContent) : [];
    const questions = ideaContent ? extractQuestions(ideaContent) : [];
    const selectedApproach = shapingContent ? extractSelectedApproach(shapingContent) : null;
    
    return {
        ideaContent,
        shapingContent,
        lifecycleContent,
        constraints,
        questions,
        selectedApproach,
        evidence,
        historyContext: history,
    };
}
