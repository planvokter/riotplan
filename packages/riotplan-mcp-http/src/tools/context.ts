/**
 * Context Tool - Load all plan artifacts in a single call
 * 
 * This tool consolidates reading IDEA.md, SHAPING.md, evidence files,
 * and recent history into a single response, making it easy for models
 * to load full plan context at stage transitions.
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import {
    extractConstraints,
    extractQuestions,
    extractSelectedApproach,
} from '@planvokter/riotplan-ai';
import {
    readIdeaDoc,
    readShapingDoc,
    readPlanDoc,
    readEvidenceRecords,
    readTimelineEvents,
    readPlanIdentity,
    type EvidenceEntry,
    type TimelineEventEntry,
} from '@planvokter/riotplan';

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

/**
 * Extract selected approach name only (for backward compatibility with context tool)
 */
function extractSelectedApproachName(shapingContent: string): string | null {
    const approach = extractSelectedApproach(shapingContent);
    return approach ? approach.name : null;
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

    const embeddedTitleMatch = content.match(/"title"\s*:\s*"([^"]+)"/);
    if (embeddedTitleMatch?.[1]) {
        return embeddedTitleMatch[1].trim();
    }

    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch?.[1]) {
        return headingMatch[1].trim();
    }

    const firstLine = content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith('<!--') && line !== '-->');
    if (firstLine) {
        return firstLine.replace(/^[#>*\-\s]+/, '').trim().slice(0, 100) || titleFromFilename(name);
    }

    return titleFromFilename(name);
}

async function executeReadContext(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);
        const depth = args.depth || 'full';
        
        const [ideaDoc, shapingDoc, lifecycleDoc, identity, evidenceRecords, timelineEvents] = await Promise.all([
            readIdeaDoc(planPath),
            readShapingDoc(planPath),
            readPlanDoc(planPath, 'lifecycle', 'LIFECYCLE.md'),
            readPlanIdentity(planPath),
            readEvidenceRecords(planPath),
            readTimelineEvents(planPath, { limit: 50 }),
        ]);

        const result: PlanContextResult = {
            planId: identity.planId,
            stage: identity.stage,
            idea: ideaDoc
                ? { content: depth === 'full' ? ideaDoc.content : getPreview(ideaDoc.content, 20) }
                : null,
            shaping: shapingDoc
                ? {
                    content: depth === 'full' ? shapingDoc.content : getPreview(shapingDoc.content, 20),
                    selectedApproach: extractSelectedApproachName(shapingDoc.content),
                }
                : null,
            evidence: {
                files: evidenceRecords.map((record: EvidenceEntry) => ({
                    name: record.id,
                    title: record.description || extractEvidenceTitle(record.id, record.content || record.summary || ''),
                    preview: depth === 'full' ? getPreview(record.content || record.summary || '', 10) : '',
                    size: (record.content || '').length,
                    createdAt: record.createdAt,
                })),
                count: evidenceRecords.length,
            },
            history: {
                recentEvents: timelineEvents.map((event: TimelineEventEntry) => ({
                    type: event.type,
                    timestamp: event.timestamp,
                    summary: JSON.stringify(event.data),
                })),
                totalEvents: timelineEvents.length,
            },
            lifecycle: lifecycleDoc
                ? { content: depth === 'full' ? lifecycleDoc.content : getPreview(lifecycleDoc.content, 10) }
                : null,
            constraints: ideaDoc ? extractConstraints(ideaDoc.content) : [],
            questions: ideaDoc ? extractQuestions(ideaDoc.content) : [],
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
