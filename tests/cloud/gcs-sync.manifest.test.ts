import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSyncDiff, loadSyncManifest, writeSyncManifest } from '../../src/cloud/gcs-sync.js';

const tempDirs: string[] = [];

describe('gcs sync manifest', () => {
    afterEach(async () => {
        await Promise.all(
            tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
        );
    });

    it('writes and loads manifest successfully', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'riotplan-manifest-'));
        tempDirs.push(dir);

        await writeSyncManifest(dir, {
            'plans/demo.plan': {
                path: 'plans/demo.plan',
                generation: '123',
                etag: 'etag-1',
                md5Hash: 'abc',
                size: 42,
                updatedAt: '2026-01-01T00:00:00.000Z',
                localPath: 'plans/demo.plan',
                lastSyncedAt: '2026-01-01T00:00:00.000Z',
            },
        });

        const loaded = await loadSyncManifest(dir);
        expect(loaded.invalidated).toBe(false);
        expect(loaded.manifest?.version).toBe(1);
        expect(loaded.manifest?.objects['plans/demo.plan']?.generation).toBe('123');
    });

    it('invalidates corrupt manifest content safely', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'riotplan-manifest-'));
        tempDirs.push(dir);
        await writeFile(join(dir, '.riotplan-sync-manifest.json'), '{invalid json}', 'utf8');

        const loaded = await loadSyncManifest(dir);
        expect(loaded.manifest).toBeNull();
        expect(loaded.invalidated).toBe(true);
    });

    it('builds added/changed/unchanged/deleted diff sets', () => {
        const diff = buildSyncDiff(
            {
                'a.plan': { path: 'a.plan', generation: '1', md5Hash: 'aaa' },
                'b.plan': { path: 'b.plan', generation: '2', md5Hash: 'bbb' },
                'd.plan': { path: 'd.plan', generation: '4', md5Hash: 'ddd' },
            },
            {
                'a.plan': {
                    path: 'a.plan',
                    generation: '1',
                    md5Hash: 'aaa',
                    localPath: 'a.plan',
                    lastSyncedAt: '2026-01-01T00:00:00.000Z',
                },
                'b.plan': {
                    path: 'b.plan',
                    generation: '1',
                    md5Hash: 'old',
                    localPath: 'b.plan',
                    lastSyncedAt: '2026-01-01T00:00:00.000Z',
                },
                'c.plan': {
                    path: 'c.plan',
                    generation: '3',
                    md5Hash: 'ccc',
                    localPath: 'c.plan',
                    lastSyncedAt: '2026-01-01T00:00:00.000Z',
                },
            },
            new Set(['a.plan', 'b.plan', 'c.plan'])
        );

        expect(diff.unchanged).toContain('a.plan');
        expect(diff.changed).toContain('b.plan');
        expect(diff.added).toContain('d.plan');
        expect(diff.deletedLocal).toContain('c.plan');
    });
});

