/**
 * Artifact Resource Handler
 *
 * Provides access to canonical plan artifacts (STATUS.md, EXECUTION_PLAN.md, etc.).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSqliteProvider } from '@planvokter/riotplan-format';

type ArtifactKey =
    | 'idea'
    | 'shaping'
    | 'summary'
    | 'execution_plan'
    | 'status'
    | 'provenance';

function normalizeArtifactType(raw: string): ArtifactKey {
    const normalized = raw.trim().toLowerCase().replace(/-/g, '_');
    switch (normalized) {
        case 'idea':
        case 'shaping':
        case 'summary':
        case 'execution_plan':
        case 'status':
        case 'provenance':
            return normalized;
        default:
            throw new Error(`Unsupported artifact type: ${raw}`);
    }
}

function artifactFilename(type: ArtifactKey): string {
    switch (type) {
        case 'idea':
            return 'IDEA.md';
        case 'shaping':
            return 'SHAPING.md';
        case 'summary':
            return 'SUMMARY.md';
        case 'execution_plan':
            return 'EXECUTION_PLAN.md';
        case 'status':
            return 'STATUS.md';
        case 'provenance':
            return 'PROVENANCE.md';
    }
}

export async function readArtifactResource(planPath: string, artifactTypeRaw: string): Promise<any> {
    const artifactType = normalizeArtifactType(artifactTypeRaw);
    const filename = artifactFilename(artifactType);

    if (planPath.endsWith('.plan')) {
        const provider = createSqliteProvider(planPath);
        const filesResult = await provider.getFiles();
        await provider.close();

        if (!filesResult.success || !filesResult.data) {
            throw new Error(filesResult.error || `Failed to read artifact: ${artifactType}`);
        }

        const byType = filesResult.data
            .filter((f) => f.type === artifactType)
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        const byName = filesResult.data
            .filter((f) => f.filename === filename)
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        const selected = byType[0] ?? byName[0];

        if (!selected) {
            return {
                type: artifactType,
                filename,
                content: null,
                note: `${filename} not found`,
            };
        }

        return {
            type: artifactType,
            filename: selected.filename,
            content: selected.content,
            updatedAt: selected.updatedAt,
        };
    }

    const path = join(planPath, filename);
    try {
        const content = await readFile(path, 'utf-8');
        return {
            type: artifactType,
            filename,
            content,
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
                type: artifactType,
                filename,
                content: null,
                note: `${filename} not found`,
            };
        }
        throw error;
    }
}

