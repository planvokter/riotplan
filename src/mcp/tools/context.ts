/**
 * Context Tool - Load all plan artifacts in a single call
 * 
 * This tool consolidates reading IDEA.md, SHAPING.md, evidence files,
 * and recent history into a single response, making it easy for models
 * to load full plan context at stage transitions.
 */

import { z } from 'zod';
import { join } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { extractConstraints, extractQuestions, extractSelectedApproach, readEvidenceFiles, readRecentHistory } from '../../ai/artifacts.js';
import { createSqliteProvider, type PlanFile } from '@kjerneverk/riotplan-format';

interface EvidenceFile {
    name: string;
    title: string;
    preview: string;
    size: number;
    createdAt?: string;
}

interface HistoryEvent {
    type: string;
    timestamp: string;
    summary: string;
}

interface PlanContextResult {
    planId: string | null;
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

async function getLatestFileByType(
    files: PlanFile[],
    type: string
): Promise<PlanFile | null> {
    const matches = files
        .filter((f) => f.type === type)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return matches[0] || null;
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

function titleFromFilename(name: string): string {
    const lastPart = name.split('/').pop() || name;
    const withoutExt = lastPart.replace(/\.[^.]+$/, '');
    const normalized = withoutExt
        .replace(/^\d{4}-\d{2}-\d{2}-/, '')
        .replace(/^ev_[a-z0-9]+-/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
    if (!normalized) {
        return name;
    }
    return normalized
        .split(' ')
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
}

function extractEvidenceTitle(name: string, content: string): string {
    if (!content) {
        return titleFromFilename(name);
    }
    const trimmed = content.trim();
    if (!trimmed) {
        return titleFromFilename(name);
    }

    // Structured JSON evidence file
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed) as { title?: string };
            if (typeof parsed.title === 'string' && parsed.title.trim()) {
                return parsed.title.trim();
            }
        } catch {
            // Fall through to markdown heuristics.
        }
    }

    // Embedded metadata block in markdown evidence
    const embeddedTitleMatch = content.match(/"title"\s*:\s*"([^"]+)"/);
    if (embeddedTitleMatch?.[1]) {
        return embeddedTitleMatch[1].trim();
    }

    // Markdown heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch?.[1]) {
        return headingMatch[1].trim();
    }

    // First meaningful line fallback
    const firstLine = content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith('<!--') && line !== '-->');
    if (firstLine) {
        return firstLine.replace(/^[#>*\-\s]+/, '').trim().slice(0, 100) || titleFromFilename(name);
    }

    return titleFromFilename(name);
}

/**
 * Read evidence files with preview formatting for context tool
 */
async function readEvidenceFilesWithPreview(planPath: string, depth: string): Promise<{ files: EvidenceFile[]; count: number }> {
    const includeContent = depth === 'full';
    const evidenceFiles = await readEvidenceFiles(planPath, includeContent);
    const evidenceDir = join(planPath, 'evidence');
    const dotEvidenceDir = join(planPath, '.evidence');
    const filesInEvidenceDir = await readdir(evidenceDir).catch(() => [] as string[]);
    const filesInDotEvidenceDir = filesInEvidenceDir.length === 0
        ? await readdir(dotEvidenceDir).catch(() => [] as string[])
        : [];
    const activeDir = filesInEvidenceDir.length > 0 ? evidenceDir : dotEvidenceDir;
    const knownFiles = new Set([...filesInEvidenceDir, ...filesInDotEvidenceDir]);

    const filesWithPreview: EvidenceFile[] = await Promise.all(
        evidenceFiles.map(async (file) => {
            let createdAt: string | undefined;
            if (knownFiles.has(file.name)) {
                const stats = await stat(join(activeDir, file.name)).catch(() => null);
                if (stats) {
                    createdAt = stats.mtime.toISOString();
                }
            }

            const previewSource = file.content || '';
            return {
                name: file.name,
                title: extractEvidenceTitle(file.name, previewSource),
                preview: includeContent ? getPreview(previewSource, 10) : '',
                size: file.size,
                createdAt,
            };
        })
    );
    
    return { files: filesWithPreview, count: filesWithPreview.length };
}

async function executeReadContext(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        const depth = args.depth || 'full';
        
        if (planPath.endsWith('.plan')) {
            const provider = createSqliteProvider(planPath);
            const [metaResult, filesResult, evidenceResult, historyResult] = await Promise.all([
                provider.getMetadata(),
                provider.getFiles(),
                provider.getEvidence(),
                provider.getTimelineEvents({ limit: 50 }),
            ]);

            const files = filesResult.success ? filesResult.data || [] : [];
            const latestIdea = await getLatestFileByType(files, 'idea');
            const latestShaping = await getLatestFileByType(files, 'shaping');
            const latestLifecycle = await getLatestFileByType(files, 'lifecycle');
            const evidenceRecords = evidenceResult.success ? evidenceResult.data || [] : [];
            const timelineEvents = historyResult.success ? historyResult.data || [] : [];

            const result: PlanContextResult = {
                planId: metaResult.success && metaResult.data ? metaResult.data.id : null,
                stage: metaResult.success && metaResult.data ? metaResult.data.stage : null,
                idea: latestIdea
                    ? { content: depth === 'full' ? latestIdea.content : getPreview(latestIdea.content, 20) }
                    : null,
                shaping: latestShaping
                    ? {
                        content: depth === 'full' ? latestShaping.content : getPreview(latestShaping.content, 20),
                        selectedApproach: extractSelectedApproachName(latestShaping.content),
                    }
                    : null,
                evidence: {
                    files: evidenceRecords.map((record) => ({
                        name: record.id,
                        title: record.description || extractEvidenceTitle(record.id, record.content || record.summary || ''),
                        preview: depth === 'full' ? getPreview(record.content || record.summary || '', 10) : '',
                        size: (record.content || '').length,
                        createdAt: record.createdAt,
                    })),
                    count: evidenceRecords.length,
                },
                history: {
                    recentEvents: timelineEvents.map((event) => ({
                        type: event.type,
                        timestamp: event.timestamp,
                        summary: JSON.stringify(event.data),
                    })),
                    totalEvents: timelineEvents.length,
                },
                lifecycle: latestLifecycle
                    ? { content: depth === 'full' ? latestLifecycle.content : getPreview(latestLifecycle.content, 10) }
                    : null,
                constraints: latestIdea ? extractConstraints(latestIdea.content) : [],
                questions: latestIdea ? extractQuestions(latestIdea.content) : [],
            };

            await provider.close();
            return createSuccess(result);
        }

        // Read all files in parallel for directory plans
        const [ideaContent, shapingContent, lifecycleContent, evidence, history] = await Promise.all([
            readFileSafe(join(planPath, 'IDEA.md')),
            readFileSafe(join(planPath, 'SHAPING.md')),
            readFileSafe(join(planPath, 'LIFECYCLE.md')),
            readEvidenceFilesWithPreview(planPath, depth),
            readRecentHistory(planPath),
        ]);
        
        // Build result
        const result: PlanContextResult = {
            planId: null,
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
        planId: z.string().optional().describe('Plan identifier (defaults to current plan context)'),
        depth: z.enum(['summary', 'full']).optional().describe('Level of detail: "summary" for metadata only, "full" for complete file contents (default: full)'),
    },
    execute: executeReadContext,
};
