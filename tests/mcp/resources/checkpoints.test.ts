import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { readCheckpointResource, readCheckpointsListResource } from '../../../src/mcp/resources/checkpoints.js';

describe('checkpoint resources', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'riotplan-checkpoints-resource-'));
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('lists filesystem checkpoints sorted by mtime descending', async () => {
        const checkpointsDir = join(testDir, '.history', 'checkpoints');
        await mkdir(checkpointsDir, { recursive: true });
        const oldFile = join(checkpointsDir, 'old.json');
        const newFile = join(checkpointsDir, 'new.json');
        await writeFile(oldFile, '{"ok":true}', 'utf-8');
        await writeFile(newFile, '{"ok":true}', 'utf-8');
        await writeFile(join(checkpointsDir, 'ignore.txt'), 'x', 'utf-8');
        await utimes(oldFile, new Date('2024-01-01T00:00:00.000Z'), new Date('2024-01-01T00:00:00.000Z'));
        await utimes(newFile, new Date('2025-01-01T00:00:00.000Z'), new Date('2025-01-01T00:00:00.000Z'));

        const result = await readCheckpointsListResource(testDir);
        expect(result.count).toBe(2);
        expect(result.checkpoints[0].name).toBe('new');
        expect(result.checkpoints[1].name).toBe('old');
    });

    it('returns empty list when checkpoints directory is missing', async () => {
        const result = await readCheckpointsListResource(testDir);
        expect(result.count).toBe(0);
        expect(result.checkpoints).toEqual([]);
        expect(result.note).toContain('No checkpoints directory found');
    });

    it('reads checkpoint + optional prompt from filesystem', async () => {
        const checkpointsDir = join(testDir, '.history', 'checkpoints');
        const promptsDir = join(testDir, '.history', 'prompts');
        await mkdir(checkpointsDir, { recursive: true });
        await mkdir(promptsDir, { recursive: true });
        await writeFile(join(checkpointsDir, 'snap.json'), '{"stage":"idea"}', 'utf-8');
        await writeFile(join(promptsDir, 'snap.md'), 'prompt text', 'utf-8');

        const result = await readCheckpointResource(testDir, 'snap');
        expect(result.name).toBe('snap');
        expect(result.checkpoint).toEqual({ stage: 'idea' });
        expect(result.prompt).toBe('prompt text');
        expect(result.type).toBe('checkpoint');
    });

    it('returns checkpoint with null prompt when prompt file is absent', async () => {
        const checkpointsDir = join(testDir, '.history', 'checkpoints');
        await mkdir(checkpointsDir, { recursive: true });
        await writeFile(join(checkpointsDir, 'snap.json'), '{"stage":"idea"}', 'utf-8');

        const result = await readCheckpointResource(testDir, 'snap');
        expect(result.prompt).toBeNull();
    });

    it('throws when filesystem checkpoint is missing', async () => {
        await expect(readCheckpointResource(testDir, 'missing')).rejects.toThrow('Checkpoint not found: missing');
    });

    it('lists sqlite checkpoints', async () => {
        const planPath = join(testDir, 'sqlite-checkpoints.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-checkpoints',
            uuid: '00000000-0000-4000-8000-000000001201',
            name: 'SQLite Checkpoints',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.createCheckpoint({
            name: 'c1',
            message: 'first',
            createdAt: now,
            snapshot: { metadata: {}, steps: [], files: [] },
        } as any);
        await provider.close();

        const result = await readCheckpointsListResource(planPath);
        expect(result.count).toBe(1);
        expect(result.checkpoints[0].name).toBe('c1');
        expect(result.checkpoints[0].file).toBe('c1.json');
    });

    it('reads sqlite checkpoint', async () => {
        const planPath = join(testDir, 'sqlite-one-checkpoint.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-one-checkpoint',
            uuid: '00000000-0000-4000-8000-000000001202',
            name: 'SQLite One Checkpoint',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.createCheckpoint({
            name: 'c1',
            message: 'first',
            createdAt: now,
            snapshot: { metadata: { id: 'x' }, steps: [], files: [] },
        } as any);
        await provider.close();

        const result = await readCheckpointResource(planPath, 'c1');
        expect(result.name).toBe('c1');
        expect(result.type).toBe('checkpoint');
        expect(result.prompt).toBeNull();
        expect(result.checkpoint).toBeTruthy();
    });

    it('throws when sqlite checkpoint does not exist', async () => {
        const planPath = join(testDir, 'sqlite-no-checkpoint.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-no-checkpoint',
            uuid: '00000000-0000-4000-8000-000000001203',
            name: 'SQLite Missing Checkpoint',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.close();

        await expect(readCheckpointResource(planPath, 'none')).rejects.toThrow('Checkpoint not found: none');
    });
});
