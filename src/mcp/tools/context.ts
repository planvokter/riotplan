/**
 * Context Tool - Load all plan artifacts in a single call
 * 
 * This tool consolidates reading IDEA.md, SHAPING.md, evidence files,
 * and recent history into a single response, making it easy for models
 * to load full plan context at stage transitions.
 */

import { z } from 'zod';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { extractConstraints, extractQuestions, extractSelectedApproach, readEvidenceFiles, readRecentHistory } from '../../ai/artifacts.js';

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
 * Extract selected approach name only (for backward compatibility with context tool)
 */
function extractSelectedApproachName(shapingContent: string): string | null {
    const approach = extractSelectedApproach(shapingContent);
    return approach ? approach.name : null;
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
 * Read evidence files with preview formatting for context tool
 */
async function readEvidenceFilesWithPreview(planPath: string, depth: string): Promise<{ files: EvidenceFile[]; count: number }> {
    const evidenceFiles = await readEvidenceFiles(planPath, depth === 'full');
    
    const filesWithPreview: EvidenceFile[] = evidenceFiles.map(file => ({
        name: file.name,
        preview: depth === 'full' ? getPreview(file.content, 10) : '',
        size: file.size,
    }));
    
    return { files: filesWithPreview, count: filesWithPreview.length };
}

async function executeReadContext(
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
            readEvidenceFilesWithPreview(planPath, depth),
            readRecentHistory(planPath),
        ]);
        
        // Build result
        const result: PlanContextResult = {
            planPath,
            stage: extractStage(lifecycleContent, ideaContent),
            idea: ideaContent ? { content: depth === 'full' ? ideaContent : getPreview(ideaContent, 20) } : null,
            shaping: shapingContent ? {
                content: depth === 'full' ? shapingContent : getPreview(shapingContent, 20),
                selectedApproach: extractSelectedApproachName(shapingContent),
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

export const readContextTool: McpTool = {
    name: 'riotplan_read_context',
    description:
        'Load all plan artifacts in a single call for stage transitions. ' +
        'Returns IDEA.md content, SHAPING.md content (if exists), evidence file list with previews, ' +
        'recent history events, and extracted constraints/questions. ' +
        'Use this at stage transitions to ensure you have full context before proceeding.',
    schema: {
        path: z.string().optional().describe('Plan directory path (defaults to current directory)'),
        depth: z.enum(['summary', 'full']).optional().describe('Level of detail: "summary" for metadata only, "full" for complete file contents (default: full)'),
    },
    execute: executeReadContext,
};
