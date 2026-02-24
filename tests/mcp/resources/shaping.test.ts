import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import { readShapingResource } from '../../../src/mcp/resources/shaping.js';

describe('readShapingResource', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'riotplan-shaping-resource-'));
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('reads SHAPING.md from filesystem plans', async () => {
        await writeFile(join(testDir, 'SHAPING.md'), '# Shaping', 'utf-8');
        const result = await readShapingResource(testDir);
        expect(result).toEqual({ content: '# Shaping', type: 'shaping' });
    });

    it('returns note when SHAPING.md is missing in filesystem plans', async () => {
        const result = await readShapingResource(testDir);
        expect(result.content).toBeNull();
        expect(result.type).toBe('shaping');
        expect(result.note).toContain('No shaping file found');
    });

    it('reads shaping content from sqlite plans', async () => {
        const planPath = join(testDir, 'sqlite-shaping.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-shaping',
            uuid: '00000000-0000-4000-8000-000000001401',
            name: 'SQLite Shaping',
            createdAt: now,
            updatedAt: now,
            stage: 'shaping',
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: 'shaping',
            filename: 'SHAPING.md',
            content: 'shaping from sqlite',
            createdAt: now,
            updatedAt: now,
        });
        await provider.close();

        const result = await readShapingResource(planPath);
        expect(result).toEqual({ content: 'shaping from sqlite', type: 'shaping' });
    });

    it('returns note when sqlite plan has no shaping files', async () => {
        const planPath = join(testDir, 'sqlite-no-shaping.plan');
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-no-shaping',
            uuid: '00000000-0000-4000-8000-000000001402',
            name: 'SQLite No Shaping',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.close();

        const result = await readShapingResource(planPath);
        expect(result.content).toBeNull();
        expect(result.note).toContain('No shaping file found');
    });

    it('returns note when sqlite file listing fails', async () => {
        const missingPath = join(testDir, 'missing.plan');
        const result = await readShapingResource(missingPath);
        expect(result.content).toBeNull();
        expect(result.note).toContain('No shaping file found');
    });

    it('selects most recently updated shaping artifact', async () => {
        const planPath = join(testDir, 'sqlite-shaping-latest.plan');
        const oldTs = new Date(Date.now() - 60_000).toISOString();
        const newTs = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: 'sqlite-shaping-latest',
            uuid: '00000000-0000-4000-8000-000000001403',
            name: 'SQLite Latest Shaping',
            createdAt: oldTs,
            updatedAt: newTs,
            stage: 'shaping',
            schemaVersion: 1,
        });
        await provider.saveFile({
            type: 'shaping',
            filename: 'SHAPING.md',
            content: 'older shaping',
            createdAt: oldTs,
            updatedAt: oldTs,
        });
        await provider.saveFile({
            type: 'shaping',
            filename: 'SHAPING.md',
            content: 'newer shaping',
            createdAt: newTs,
            updatedAt: newTs,
        });
        await provider.close();

        const result = await readShapingResource(planPath);
        expect(result.content).toBe('newer shaping');
    });
});
