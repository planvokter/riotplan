import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mirrorSyncDown = vi.fn(async () => ({
    bucket: 'mock',
    prefix: '',
    localDirectory: '/tmp/mock',
    remoteListedCount: 1,
    remoteIncludedCount: 1,
    changedCount: 0,
    skippedUnchangedCount: 1,
    downloadedCount: 0,
    downloadedBytes: 0,
    localScannedCount: 1,
    removedCount: 0,
    elapsedMs: 1,
    phases: {
        mkdirMs: 0,
        createClientMs: 0,
        listRemoteMs: 0,
        downloadMs: 0,
        listLocalMs: 0,
        cleanupMs: 0,
    },
}));

const mirrorSyncUp = vi.fn(async () => ({
    bucket: 'mock',
    prefix: '',
    localDirectory: '/tmp/mock',
    localScannedCount: 0,
    localIncludedCount: 0,
    uploadedCount: 0,
    remoteListedCount: 0,
    removedRemoteCount: 0,
    elapsedMs: 0,
    phases: {
        mkdirMs: 0,
        createClientMs: 0,
        listLocalMs: 0,
        uploadMs: 0,
        listRemoteMs: 0,
        cleanupMs: 0,
    },
}));

vi.mock('../../src/cloud/gcs-sync.js', () => ({
    GcsMirror: class {
        syncDown = mirrorSyncDown;
        syncUp = mirrorSyncUp;
    },
}));

describe('createCloudRuntime freshness TTL', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
        mirrorSyncDown.mockClear();
        mirrorSyncUp.mockClear();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('skips syncDown within freshness TTL and resyncs on force refresh', async () => {
        const { createCloudRuntime } = await import('../../src/cloud/runtime.js');
        const runtime = await createCloudRuntime(
            {
                cloud: {
                    enabled: true,
                    planBucket: 'plans',
                    contextBucket: 'context',
                    cacheDirectory: `/tmp/riotplan-ttl-${Date.now()}`,
                    syncFreshnessTtlMs: 10_000,
                },
            } as any,
            '/tmp/riotplan/plans'
        );

        await runtime.syncDown();
        expect(mirrorSyncDown).toHaveBeenCalledTimes(2);

        await runtime.syncDown();
        expect(mirrorSyncDown).toHaveBeenCalledTimes(2);

        await runtime.syncDown({ forceRefresh: true });
        expect(mirrorSyncDown).toHaveBeenCalledTimes(4);
    });

    it('does not short-circuit when TTL is disabled', async () => {
        const { createCloudRuntime } = await import('../../src/cloud/runtime.js');
        const runtime = await createCloudRuntime(
            {
                cloud: {
                    enabled: true,
                    planBucket: 'plans',
                    contextBucket: 'context',
                    cacheDirectory: `/tmp/riotplan-ttl-off-${Date.now()}`,
                    syncFreshnessTtlMs: 0,
                },
            } as any,
            '/tmp/riotplan/plans'
        );

        await runtime.syncDown();
        await runtime.syncDown();
        expect(mirrorSyncDown).toHaveBeenCalledTimes(4);
    });

    it('uses full-sync behavior when incremental sync is disabled', async () => {
        const { createCloudRuntime } = await import('../../src/cloud/runtime.js');
        const runtime = await createCloudRuntime(
            {
                cloud: {
                    enabled: true,
                    incrementalSyncEnabled: false,
                    planBucket: 'plans',
                    contextBucket: 'context',
                    cacheDirectory: `/tmp/riotplan-incremental-off-${Date.now()}`,
                    syncFreshnessTtlMs: 10_000,
                },
            } as any,
            '/tmp/riotplan/plans'
        );

        await runtime.syncDown();
        await runtime.syncDown();
        expect(mirrorSyncDown).toHaveBeenCalledTimes(4);
    });
});

