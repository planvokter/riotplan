/**
 * Plan Artifact Operations
 *
 * Generic read/write for typed plan documents (IDEA.md, SHAPING.md, STATUS.md, etc.)
 * via SQLite .plan storage.
 */

import { createSqliteProvider } from '@planvokter/riotplan-format';
import type { PlanFileType } from '@planvokter/riotplan-format';

export interface PlanDoc {
    content: string;
    filename: string;
}

/**
 * Read a plan artifact by file type and filename from SQLite.
 */
export async function readPlanDoc(
    planPath: string,
    fileType: PlanFileType,
    filename: string
): Promise<PlanDoc | null> {
    const provider = createSqliteProvider(planPath);
    try {
        const filesResult = await provider.getFiles();
        if (!filesResult.success || !filesResult.data) {
            return null;
        }
        const match = filesResult.data.find(
            (f) => f.filename === filename || (f.type === fileType && fileType !== 'other')
        );
        return match ? { content: match.content, filename: match.filename } : null;
    } finally {
        await provider.close();
    }
}

/**
 * Save a plan artifact by file type and filename to SQLite.
 */
export async function savePlanDoc(
    planPath: string,
    fileType: PlanFileType,
    filename: string,
    content: string
): Promise<void> {
    const provider = createSqliteProvider(planPath);
    try {
        const now = new Date().toISOString();
        const existing = await readPlanDocFromProvider(provider, fileType, filename);
        const result = await provider.saveFile({
            type: fileType,
            filename,
            content,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
        });
        if (!result.success) {
            throw new Error(result.error || `Failed to save ${filename}`);
        }
    } finally {
        await provider.close();
    }
}

async function readPlanDocFromProvider(
    provider: {
        getFiles(): Promise<{
            success: boolean;
            data?: Array<{
                type: string;
                filename: string;
                content: string;
                createdAt: string;
                updatedAt: string;
            }>;
        }>;
    },
    fileType: PlanFileType,
    filename: string
): Promise<{ createdAt: string } | null> {
    const result = await provider.getFiles();
    if (!result.success || !result.data) return null;
    const match = result.data.find((f) => f.type === fileType || f.filename === filename);
    return match ? { createdAt: match.createdAt } : null;
}

export async function readIdeaDoc(planPath: string): Promise<PlanDoc | null> {
    return readPlanDoc(planPath, 'idea', 'IDEA.md');
}

export async function saveIdeaDoc(planPath: string, content: string): Promise<void> {
    return savePlanDoc(planPath, 'idea', 'IDEA.md', content);
}

export async function readShapingDoc(planPath: string): Promise<PlanDoc | null> {
    return readPlanDoc(planPath, 'shaping', 'SHAPING.md');
}

export async function saveShapingDoc(planPath: string, content: string): Promise<void> {
    return savePlanDoc(planPath, 'shaping', 'SHAPING.md', content);
}

export async function readStatusDoc(planPath: string): Promise<PlanDoc | null> {
    return readPlanDoc(planPath, 'status', 'STATUS.md');
}

export async function saveStatusDoc(planPath: string, content: string): Promise<void> {
    return savePlanDoc(planPath, 'status', 'STATUS.md', content);
}

// ===== EVIDENCE =====

export interface EvidenceEntry {
    id: string;
    description: string;
    source?: string;
    sourceUrl?: string;
    content?: string;
    summary?: string;
    createdAt?: string;
}

/**
 * Read evidence records from a plan's SQLite database.
 */
export async function readEvidenceRecords(planPath: string): Promise<EvidenceEntry[]> {
    const provider = createSqliteProvider(planPath);
    try {
        const result = await provider.getEvidence();
        if (!result.success || !result.data) return [];
        return result.data.map((r) => ({
            id: r.id,
            description: r.description,
            source: r.source,
            sourceUrl: r.sourceUrl,
            content: r.content,
            summary: r.summary,
            createdAt: r.createdAt,
        }));
    } finally {
        await provider.close();
    }
}

// ===== TIMELINE =====

export interface TimelineEventEntry {
    type: string;
    timestamp: string;
    data: Record<string, unknown>;
}

/**
 * Read timeline events from a plan's SQLite database.
 */
export async function readTimelineEvents(
    planPath: string,
    options?: { limit?: number; since?: string }
): Promise<TimelineEventEntry[]> {
    const provider = createSqliteProvider(planPath);
    try {
        const result = await provider.getTimelineEvents({
            limit: options?.limit,
            since: options?.since,
        });
        if (!result.success || !result.data) return [];
        return result.data.map((e) => ({
            type: e.type,
            timestamp: e.timestamp,
            data: e.data,
        }));
    } finally {
        await provider.close();
    }
}

/**
 * Read plan identity (planId and stage) from SQLite.
 */
export async function readPlanIdentity(planPath: string): Promise<{ planId: string | null; stage: string | null }> {
    const provider = createSqliteProvider(planPath);
    try {
        const result = await provider.getMetadata();
        if (!result.success || !result.data) return { planId: null, stage: null };
        return { planId: result.data.id, stage: result.data.stage };
    } finally {
        await provider.close();
    }
}
