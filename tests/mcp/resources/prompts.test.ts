import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { readPromptResource, readPromptsListResource } from '../../../src/mcp/resources/prompts.js';

describe('prompt resources', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'riotplan-prompts-resource-'));
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('lists markdown prompts from filesystem directory', async () => {
        const promptsDir = join(testDir, '.history', 'prompts');
        await mkdir(promptsDir, { recursive: true });
        await writeFile(join(promptsDir, 'b.md'), 'B', 'utf-8');
        await writeFile(join(promptsDir, 'a.md'), 'A', 'utf-8');
        await writeFile(join(promptsDir, 'ignore.txt'), 'x', 'utf-8');

        const result = await readPromptsListResource(testDir);
        expect(result).toEqual({
            prompts: ['a.md', 'b.md'],
            count: 2,
            type: 'prompts_list',
        });
    });

    it('returns empty list when prompts directory is missing', async () => {
        const result = await readPromptsListResource(testDir);
        expect(result.prompts).toEqual([]);
        expect(result.count).toBe(0);
        expect(result.note).toContain('No prompts directory found');
    });

    it('reads a prompt file from filesystem', async () => {
        const promptsDir = join(testDir, '.history', 'prompts');
        await mkdir(promptsDir, { recursive: true });
        await writeFile(join(promptsDir, 'session.md'), 'hello', 'utf-8');

        const result = await readPromptResource(testDir, 'session.md');
        expect(result).toEqual({
            file: 'session.md',
            content: 'hello',
            type: 'prompt',
        });
    });

    it('throws when prompt file is missing on filesystem', async () => {
        await expect(readPromptResource(testDir, 'missing.md')).rejects.toThrow('Prompt file not found: missing.md');
    });

    it('lists prompt files from sqlite plans', async () => {
        const planPath = join(testDir, 'sqlite-prompts.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-prompts',
            uuid: '00000000-0000-4000-8000-000000001101',
            name: 'SQLite Prompts',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: 'prompt',
            filename: '02-followup.md',
            content: 'followup',
            createdAt: now,
            updatedAt: now,
        });
        await provider.saveFile({
            type: 'prompt',
            filename: '01-intro.md',
            content: 'intro',
            createdAt: now,
            updatedAt: now,
        });
        await provider.saveFile({
            type: 'summary',
            filename: 'SUMMARY.md',
            content: 'summary',
            createdAt: now,
            updatedAt: now,
        });
        await provider.close();

        const result = await readPromptsListResource(planPath);
        expect(result.prompts).toEqual(['01-intro.md', '02-followup.md']);
        expect(result.count).toBe(2);
    });

    it('reads an individual prompt from sqlite plans', async () => {
        const planPath = join(testDir, 'sqlite-one.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-one',
            uuid: '00000000-0000-4000-8000-000000001102',
            name: 'SQLite One Prompt',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: 'prompt',
            filename: 'session.md',
            content: 'from sqlite',
            createdAt: now,
            updatedAt: now,
        });
        await provider.close();

        const result = await readPromptResource(planPath, 'session.md');
        expect(result.content).toBe('from sqlite');
    });

    it('throws when sqlite prompt is missing', async () => {
        const planPath = join(testDir, 'sqlite-missing.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-missing',
            uuid: '00000000-0000-4000-8000-000000001103',
            name: 'SQLite Missing Prompt',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.close();

        await expect(readPromptResource(planPath, 'nope.md')).rejects.toThrow('Prompt file not found: nope.md');
    });
});
