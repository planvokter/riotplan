/**
 * Evidence Resource Handler
 * 
 * Provides access to evidence/ directory
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createSqliteProvider } from '@planvokter/riotplan-format';

const EVIDENCE_META_MARKER = "<!-- riotplan-evidence-record";

type ReferenceSource = {
    id: string;
    type: "filepath" | "url" | "other";
    value: string;
    label?: string;
    metadata?: Record<string, unknown>;
};

function parseEmbeddedRecord(content: string): Record<string, unknown> | null {
    const markerIndex = content.indexOf(EVIDENCE_META_MARKER);
    if (markerIndex === -1) {
        return null;
    }
    const afterMarker = content.slice(markerIndex + EVIDENCE_META_MARKER.length);
    const endIndex = afterMarker.indexOf("-->");
    if (endIndex === -1) {
        return null;
    }
    const raw = afterMarker.slice(0, endIndex).trim();
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function looksLikeUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return ["http:", "https:"].includes(parsed.protocol);
    } catch {
        return false;
    }
}

function looksLikeFilePath(value: string): boolean {
    if (!value) return false;
    return (
        value.startsWith("/") ||
        value.startsWith("./") ||
        value.startsWith("../") ||
        value.startsWith("~/") ||
        value.includes("/") ||
        value.includes("\\") ||
        /^[a-zA-Z]:[\\/]/.test(value)
    );
}

function stableRefId(type: string, value: string): string {
    const normalized = `${type}:${value}`.replace(/[^a-zA-Z0-9:_-]/g, "-");
    return `ref_${normalized.slice(0, 24)}`;
}

function deriveReferenceSources(sources: string[]): ReferenceSource[] {
    return sources.map((raw) => {
        const value = String(raw).trim();
        const type = looksLikeUrl(value) ? "url" : looksLikeFilePath(value) ? "filepath" : "other";
        return {
            id: stableRefId(type, value),
            type,
            value,
        };
    });
}

function parseRecordFromContent(content: string, fallbackFile: string): Record<string, unknown> {
    try {
        const json = JSON.parse(content) as Record<string, unknown>;
        const rawSources = Array.isArray(json.sources) ? json.sources.map((s) => String(s)) : [];
        const existingRefs = Array.isArray(json.referenceSources)
            ? (json.referenceSources as ReferenceSource[])
            : deriveReferenceSources(rawSources);
        return {
            ...json,
            file: String(json.file || fallbackFile),
            sources: existingRefs.map((ref) => ref.value),
            referenceSources: existingRefs,
        };
    } catch {
        const embedded = parseEmbeddedRecord(content) || {};
        const rawSources = Array.isArray(embedded.sources) ? embedded.sources.map((s) => String(s)) : [];
        const existingRefs = Array.isArray(embedded.referenceSources)
            ? (embedded.referenceSources as ReferenceSource[])
            : deriveReferenceSources(rawSources);
        return {
            ...embedded,
            file: String(embedded.file || fallbackFile),
            sources: existingRefs.map((ref) => ref.value),
            referenceSources: existingRefs,
        };
    }
}

export async function readEvidenceListResource(planPath: string): Promise<any> {
    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const evidenceResult = await provider.getEvidence();
        await provider.close();
        if (!evidenceResult.success) {
            throw new Error(evidenceResult.error || 'Failed to read evidence');
        }
        const evidence = (evidenceResult.data || []).map((record) => ({
            name: record.filePath || record.id,
            size: (record.content || '').length,
            modified: record.createdAt,
        }));
        return {
            evidence,
            count: evidence.length,
            type: 'evidence_list',
        };
    }

    const evidenceDir = join(planPath, 'evidence');
    
    try {
        const files = await readdir(evidenceDir);
        const evidenceFiles = await Promise.all(
            files.map(async (file) => {
                const filePath = join(evidenceDir, file);
                const stats = await stat(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                };
            })
        );
        
        return {
            evidence: evidenceFiles,
            count: evidenceFiles.length,
            type: 'evidence_list',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
                evidence: [],
                count: 0,
                type: 'evidence_list',
                note: 'No evidence directory found',
            };
        }
        throw error;
    }
}

export async function readEvidenceResource(planPath: string, evidenceFile: string): Promise<any> {
    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const evidenceResult = await provider.getEvidence();
        await provider.close();
        if (!evidenceResult.success || !evidenceResult.data) {
            throw new Error(evidenceResult.error || `Evidence file not found: ${evidenceFile}`);
        }
        const evidence = evidenceResult.data.find((record) =>
            record.id === evidenceFile || record.filePath === evidenceFile
        );
        if (!evidence) {
            throw new Error(`Evidence file not found: ${evidenceFile}`);
        }
        const content = evidence.content || evidence.summary || '';
        const record = parseRecordFromContent(content, evidence.filePath || evidence.id);
        return {
            file: evidenceFile,
            content,
            size: content.length,
            modified: evidence.createdAt,
            record,
            type: 'evidence',
        };
    }

    const evidencePath = join(planPath, 'evidence', evidenceFile);
    
    try {
        const content = await readFile(evidencePath, 'utf-8');
        const stats = await stat(evidencePath);
        const record = parseRecordFromContent(content, evidenceFile);
        
        return {
            file: evidenceFile,
            content,
            size: stats.size,
            modified: stats.mtime,
            record,
            type: 'evidence',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Evidence file not found: ${evidenceFile}`);
        }
        throw error;
    }
}
