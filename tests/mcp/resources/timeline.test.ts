import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { readTimelineResource } from '../../../src/mcp/resources/timeline.js';

describe('readTimelineResource', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'riotplan-timeline-resource-'));
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('reads timeline events from sqlite plan', async () => {
        const planPath = join(testDir, 'sqlite-timeline.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-timeline',
            uuid: '00000000-0000-4000-8000-000000001501',
            name: 'SQLite Timeline',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.addTimelineEvent({
            id: 'evt-1',
            timestamp: now,
            type: 'note_added',
            data: { note: 'hello' },
        });
        await provider.close();

        const result = await readTimelineResource(planPath);
        expect(result.type).toBe('timeline');
        expect(result.count).toBe(1);
        expect(result.events[0].type).toBe('note_added');
    });

    it('throws when sqlite timeline lookup fails', async () => {
        const missingPlanPath = join(testDir, 'missing.plan');
        await expect(readTimelineResource(missingPlanPath)).rejects.toThrow(/Failed to read timeline|no such table/);
    });

    it('reads JSONL timeline from filesystem plans', async () => {
        const historyDir = join(testDir, '.history');
        await mkdir(historyDir, { recursive: true });
        const lines = [
            JSON.stringify({ id: '1', type: 'note_added' }),
            '',
            '   ',
            JSON.stringify({ id: '2', type: 'decision_made' }),
        ].join('\n');
        await writeFile(join(historyDir, 'timeline.jsonl'), lines, 'utf-8');

        const result = await readTimelineResource(testDir);
        expect(result.count).toBe(2);
        expect(result.events[0].type).toBe('note_added');
        expect(result.events[1].type).toBe('decision_made');
    });

    it('throws specific error when filesystem timeline is missing', async () => {
        await expect(readTimelineResource(testDir)).rejects.toThrow('Timeline not found');
    });

    it('rethrows malformed JSON parsing errors', async () => {
        const historyDir = join(testDir, '.history');
        await mkdir(historyDir, { recursive: true });
        await writeFile(join(historyDir, 'timeline.jsonl'), '{"valid":1}\n{bad json}', 'utf-8');

        await expect(readTimelineResource(testDir)).rejects.toThrow();
    });
});
