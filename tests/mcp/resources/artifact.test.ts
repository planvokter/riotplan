import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { readArtifactResource } from '../../../src/mcp/resources/artifact.js';

describe('readArtifactResource', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'riotplan-artifact-resource-'));
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('reads filesystem artifact content', async () => {
        await writeFile(join(testDir, 'SUMMARY.md'), '# Summary', 'utf-8');
        const result = await readArtifactResource(testDir, 'summary');
        expect(result).toEqual({
            type: 'summary',
            filename: 'SUMMARY.md',
            content: '# Summary',
        });
    });

    it('returns note when filesystem artifact does not exist', async () => {
        const result = await readArtifactResource(testDir, 'provenance');
        expect(result.type).toBe('provenance');
        expect(result.filename).toBe('PROVENANCE.md');
        expect(result.content).toBeNull();
        expect(result.note).toContain('not found');
    });

    it('normalizes dash-case artifact type aliases', async () => {
        await writeFile(join(testDir, 'EXECUTION_PLAN.md'), 'plan', 'utf-8');
        const result = await readArtifactResource(testDir, 'execution-plan');
        expect(result.type).toBe('execution_plan');
        expect(result.filename).toBe('EXECUTION_PLAN.md');
    });

    it('throws on unsupported artifact type', async () => {
        await expect(readArtifactResource(testDir, 'unknown-type')).rejects.toThrow('Unsupported artifact type');
    });

    it('reads sqlite artifact by matching type', async () => {
        const planPath = join(testDir, 'typed.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'typed',
            uuid: '00000000-0000-4000-8000-000000001001',
            name: 'Typed Artifact',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: 'summary',
            filename: 'SUMMARY.md',
            content: 'latest summary',
            createdAt: now,
            updatedAt: now,
        });
        await provider.close();

        const result = await readArtifactResource(planPath, 'summary');
        expect(result.type).toBe('summary');
        expect(result.filename).toBe('SUMMARY.md');
        expect(result.content).toBe('latest summary');
    });

    it('falls back to sqlite filename match when type differs', async () => {
        const planPath = join(testDir, 'fallback.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'fallback',
            uuid: '00000000-0000-4000-8000-000000001002',
            name: 'Fallback Artifact',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: 'status',
            filename: 'SUMMARY.md',
            content: 'summary via filename fallback',
            createdAt: now,
            updatedAt: now,
        });
        await provider.close();

        const result = await readArtifactResource(planPath, 'summary');
        expect(result.filename).toBe('SUMMARY.md');
        expect(result.content).toBe('summary via filename fallback');
    });

    it('returns missing note for sqlite artifact when not found', async () => {
        const planPath = join(testDir, 'missing.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'missing',
            uuid: '00000000-0000-4000-8000-000000001003',
            name: 'Missing Artifact',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.close();

        const result = await readArtifactResource(planPath, 'status');
        expect(result.content).toBeNull();
        expect(result.note).toContain('not found');
    });

    it('throws sqlite provider errors when files query fails', async () => {
        const missingPlan = join(testDir, 'no-db.plan');
        await mkdir(testDir, { recursive: true });
        await expect(readArtifactResource(missingPlan, 'summary')).rejects.toThrow(/plan_files|Failed to read artifact/);
    });
});
