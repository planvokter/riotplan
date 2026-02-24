import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { readIdeaResource } from '../../../src/mcp/resources/idea.js';

describe('readIdeaResource', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'riotplan-idea-resource-'));
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('reads IDEA.md from filesystem plans', async () => {
        await writeFile(join(testDir, 'IDEA.md'), '# Idea', 'utf-8');
        const result = await readIdeaResource(testDir);
        expect(result).toEqual({ content: '# Idea', type: 'idea' });
    });

    it('throws when IDEA.md is missing in filesystem plans', async () => {
        await expect(readIdeaResource(testDir)).rejects.toThrow('IDEA.md not found');
    });

    it('reads idea artifact from sqlite plans', async () => {
        const planPath = join(testDir, 'sqlite-idea.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-idea',
            uuid: '00000000-0000-4000-8000-000000001301',
            name: 'SQLite Idea',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: 'idea',
            filename: 'IDEA.md',
            content: 'idea from sqlite',
            createdAt: now,
            updatedAt: now,
        });
        await provider.close();

        const result = await readIdeaResource(planPath);
        expect(result).toEqual({ content: 'idea from sqlite', type: 'idea' });
    });

    it('throws when sqlite idea artifact is missing', async () => {
        const planPath = join(testDir, 'sqlite-no-idea.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-no-idea',
            uuid: '00000000-0000-4000-8000-000000001302',
            name: 'SQLite Missing Idea',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.close();

        await expect(readIdeaResource(planPath)).rejects.toThrow('IDEA.md not found');
    });
});
