/**
 * Plan Artifact Operations
 *
 * Generic read/write for typed plan documents (IDEA.md, SHAPING.md, STATUS.md, etc.)
 * that transparently handles both directory and SQLite .plan storage.
 *
 * Also provides evidence and timeline reading for both formats.
 */

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";
import type { PlanFileType } from "@kjerneverk/riotplan-format";
import type { TimelineEvent } from "../types.js";

export interface PlanDoc {
    content: string;
    filename: string;
}

/**
 * Read a plan artifact by file type and filename.
 *
 * For .plan files, reads from the SQLite database via the storage provider.
 * For directory plans, reads from the filesystem.
 */
export async function readPlanDoc(
    planPath: string,
    fileType: PlanFileType,
    filename: string
): Promise<PlanDoc | null> {
    if (planPath.endsWith(".plan")) {
        const provider = createSqliteProvider(planPath);
        try {
            const filesResult = await provider.getFiles();
            if (!filesResult.success || !filesResult.data) {
                return null;
            }
            const match = filesResult.data.find(
                (f) => f.type === fileType || f.filename === filename
            );
            return match ? { content: match.content, filename: match.filename } : null;
        } finally {
            await provider.close();
        }
    }

    const filePath = join(planPath, filename);
    if (!existsSync(filePath)) {
        return null;
    }

    try {
        const content = await readFile(filePath, "utf-8");
        return { content, filename };
    } catch {
        return null;
    }
}

/**
 * Save a plan artifact by file type and filename.
 *
 * For .plan files, saves to the SQLite database via the storage provider.
 * For directory plans, writes to the filesystem.
 */
export async function savePlanDoc(
    planPath: string,
    fileType: PlanFileType,
    filename: string,
    content: string
): Promise<void> {
    if (planPath.endsWith(".plan")) {
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
        return;
    }

    const filePath = join(planPath, filename);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
}

async function readPlanDocFromProvider(
    provider: { getFiles(): Promise<{ success: boolean; data?: Array<{ type: string; filename: string; content: string; createdAt: string; updatedAt: string }> }> },
    fileType: PlanFileType,
    filename: string
): Promise<{ createdAt: string } | null> {
    const result = await provider.getFiles();
    if (!result.success || !result.data) return null;
    const match = result.data.find((f) => f.type === fileType || f.filename === filename);
    return match ? { createdAt: match.createdAt } : null;
}

/**
 * Convenience: read IDEA.md
 */
export async function readIdeaDoc(planPath: string): Promise<PlanDoc | null> {
    return readPlanDoc(planPath, "idea", "IDEA.md");
}

/**
 * Convenience: save IDEA.md
 */
export async function saveIdeaDoc(planPath: string, content: string): Promise<void> {
    return savePlanDoc(planPath, "idea", "IDEA.md", content);
}

/**
 * Convenience: read SHAPING.md
 */
export async function readShapingDoc(planPath: string): Promise<PlanDoc | null> {
    return readPlanDoc(planPath, "shaping", "SHAPING.md");
}

/**
 * Convenience: save SHAPING.md
 */
export async function saveShapingDoc(planPath: string, content: string): Promise<void> {
    return savePlanDoc(planPath, "shaping", "SHAPING.md", content);
}

/**
 * Convenience: read STATUS.md
 */
export async function readStatusDoc(planPath: string): Promise<PlanDoc | null> {
    return readPlanDoc(planPath, "status", "STATUS.md");
}

/**
 * Convenience: save STATUS.md
 */
export async function saveStatusDoc(planPath: string, content: string): Promise<void> {
    return savePlanDoc(planPath, "status", "STATUS.md", content);
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
 * Read evidence records from a plan.
 *
 * For SQLite plans, reads from the evidence_records table.
 * For directory plans, reads from the evidence/ directory.
 */
export async function readEvidenceRecords(planPath: string): Promise<EvidenceEntry[]> {
    if (planPath.endsWith(".plan")) {
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

    const evidenceDir = join(planPath, "evidence");
    if (!existsSync(evidenceDir)) return [];

    try {
        const files = await readdir(evidenceDir);
        const entries: EvidenceEntry[] = [];
        for (const file of files.filter((f) => f.endsWith(".md")).sort()) {
            const content = await readFile(join(evidenceDir, file), "utf-8").catch(() => "");
            const id = file.replace(/\.md$/, "");
            const titleMatch = content.match(/^#\s+(.+)$/m);
            entries.push({
                id,
                description: titleMatch?.[1] || id,
                content,
                createdAt: undefined,
            });
        }
        return entries;
    } catch {
        return [];
    }
}

// ===== TIMELINE =====

export interface TimelineEventEntry {
    type: string;
    timestamp: string;
    data: Record<string, unknown>;
}

/**
 * Read timeline events from a plan.
 *
 * For SQLite plans, reads from the timeline_events table.
 * For directory plans, reads from .history/timeline.jsonl.
 */
export async function readTimelineEvents(
    planPath: string,
    options?: { limit?: number; since?: string }
): Promise<TimelineEventEntry[]> {
    if (planPath.endsWith(".plan")) {
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

    const timelinePath = join(planPath, ".history", "timeline.jsonl");
    try {
        const content = await readFile(timelinePath, "utf-8");
        let events: TimelineEvent[] = content
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line));

        if (options?.since) {
            events = events.filter((e) => e.timestamp >= options.since!);
        }
        if (options?.limit) {
            events = events.slice(-options.limit);
        }
        return events.map((e) => ({
            type: e.type,
            timestamp: e.timestamp,
            data: e.data,
        }));
    } catch {
        return [];
    }
}

/**
 * Read plan metadata (planId and stage) for both formats.
 *
 * For SQLite, reads from the plans table.
 * For directory plans, extracts from LIFECYCLE.md / IDEA.md.
 */
export async function readPlanIdentity(planPath: string): Promise<{ planId: string | null; stage: string | null }> {
    if (planPath.endsWith(".plan")) {
        const provider = createSqliteProvider(planPath);
        try {
            const result = await provider.getMetadata();
            if (!result.success || !result.data) return { planId: null, stage: null };
            return { planId: result.data.id, stage: result.data.stage };
        } finally {
            await provider.close();
        }
    }

    const lifecycle = await readPlanDoc(planPath, "lifecycle", "LIFECYCLE.md");
    let stage: string | null = null;
    if (lifecycle) {
        const match = lifecycle.content.match(/\*\*Stage\*\*:\s*`(\w+)`/);
        if (match) stage = match[1];
    }
    return { planId: null, stage };
}
