import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    runCoalescedOperation,
    runDebouncedCoalescedOperation,
    createCloudRuntime,
} from '../src/runtime.js';

vi.mock('../src/gcs-sync.js', () => {
    const syncDownStats = {
        bucket: 'test-bucket',
        prefix: '',
        localDirectory: '/tmp',
        remoteListedCount: 0,
        remoteIncludedCount: 0,
        changedCount: 0,
        skippedUnchangedCount: 0,
        downloadedCount: 0,
        downloadedBytes: 0,
        localScannedCount: 0,
        removedCount: 0,
        elapsedMs: 10,
        phases: {
            mkdirMs: 0,
            createClientMs: 0,
            listRemoteMs: 0,
            downloadMs: 0,
            listLocalMs: 0,
            cleanupMs: 0,
        },
    };
    const syncUpStats = {
        bucket: 'test-bucket',
        prefix: '',
        localDirectory: '/tmp',
        localScannedCount: 0,
        localIncludedCount: 0,
        uploadedCount: 0,
        remoteListedCount: 0,
        removedRemoteCount: 0,
        elapsedMs: 10,
        phases: {
            mkdirMs: 0,
            createClientMs: 0,
            listLocalMs: 0,
            uploadMs: 0,
            listRemoteMs: 0,
            cleanupMs: 0,
        },
    };
    return {
        GcsMirror: class MockGcsMirror {
            syncDown = () => Promise.resolve(syncDownStats);
            syncUp = () => Promise.resolve(syncUpStats);
        },
    };
});

describe('runCoalescedOperation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('single call returns result with coalesced=false and waiterCount=0', async () => {
        const key = `coalesce-single-${Date.now()}`;
        const result = await runCoalescedOperation(key, async () => 'ok');

        expect(result).toEqual({
            result: 'ok',
            coalesced: false,
            waiterCount: 0,
        });
    });

    it('concurrent calls to same key coalesce - subsequent callers get coalesced=true', async () => {
        const key = `coalesce-concurrent-${Date.now()}`;
        let resolveOp: (value: string) => void;
        const operationPromise = new Promise<string>((resolve) => {
            resolveOp = resolve;
        });

        const firstPromise = runCoalescedOperation(key, () => operationPromise);
        const secondPromise = runCoalescedOperation(key, () => operationPromise);
        const thirdPromise = runCoalescedOperation(key, () => operationPromise);

        resolveOp!('done');
        const [first, second, third] = await Promise.all([
            firstPromise,
            secondPromise,
            thirdPromise,
        ]);

        expect(first.result).toBe('done');
        expect(first.coalesced).toBe(false);
        expect(first.waiterCount).toBeGreaterThanOrEqual(0);

        expect(second.result).toBe('done');
        expect(second.coalesced).toBe(true);
        expect(second.waiterCount).toBeGreaterThan(0);

        expect(third.result).toBe('done');
        expect(third.coalesced).toBe(true);
        expect(third.waiterCount).toBeGreaterThan(0);
    });

    it('different keys do not coalesce', async () => {
        const key1 = `coalesce-diff-a-${Date.now()}`;
        const key2 = `coalesce-diff-b-${Date.now()}`;

        const [r1, r2] = await Promise.all([
            runCoalescedOperation(key1, async () => 'a'),
            runCoalescedOperation(key2, async () => 'b'),
        ]);

        expect(r1).toEqual({ result: 'a', coalesced: false, waiterCount: 0 });
        expect(r2).toEqual({ result: 'b', coalesced: false, waiterCount: 0 });
    });

    it('cleans up in-flight map after completion', async () => {
        const key = `coalesce-cleanup-${Date.now()}`;
        await runCoalescedOperation(key, async () => 42);
        await runCoalescedOperation(key, async () => 99);

        expect(await runCoalescedOperation(key, async () => 100)).toEqual({
            result: 100,
            coalesced: false,
            waiterCount: 0,
        });
    });

    it('supports timeoutMs option - times out when operation exceeds timeout', async () => {
        const key = `coalesce-timeout-${Date.now()}`;
        const neverResolves = new Promise<string>(() => {});

        const resultPromise = runCoalescedOperation(key, () => neverResolves, {
            timeoutMs: 50,
        });

        vi.advanceTimersByTime(60);
        await expect(resultPromise).rejects.toThrow(
            /Coalesced operation timed out after 50ms/
        );
    });

    it('completes successfully when operation finishes before timeout', async () => {
        const key = `coalesce-timeout-ok-${Date.now()}`;
        const result = await runCoalescedOperation(
            key,
            async () => 'fast',
            { timeoutMs: 5000 }
        );

        expect(result).toEqual({
            result: 'fast',
            coalesced: false,
            waiterCount: 0,
        });
    });

    it('propagates operation errors', async () => {
        const key = `coalesce-error-${Date.now()}`;
        const err = new Error('operation failed');

        await expect(
            runCoalescedOperation(key, async () => {
                throw err;
            })
        ).rejects.toThrow('operation failed');
    });
});

describe('runDebouncedCoalescedOperation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('single call with no debounce runs immediately', async () => {
        const key = `debounce-immediate-${Date.now()}`;
        const resultPromise = runDebouncedCoalescedOperation(
            key,
            async () => 'ok',
            { debounceMs: 0 }
        );

        const result = await resultPromise;
        expect(result).toEqual({
            result: 'ok',
            coalesced: false,
            waiterCount: 0,
        });
    });

    it('single call with debounceMs runs after delay', async () => {
        const key = `debounce-delayed-${Date.now()}`;
        const resultPromise = runDebouncedCoalescedOperation(
            key,
            async () => 'delayed',
            { debounceMs: 100 }
        );

        await vi.advanceTimersByTimeAsync(100);
        const result = await resultPromise;

        expect(result).toEqual({
            result: 'delayed',
            coalesced: false,
            waiterCount: 0,
        });
    });

    it('multiple concurrent calls coalesce', async () => {
        const key = `debounce-coalesce-${Date.now()}`;
        let resolveOp: (value: string) => void;
        const operationPromise = new Promise<string>((resolve) => {
            resolveOp = resolve;
        });

        const firstPromise = runDebouncedCoalescedOperation(
            key,
            () => operationPromise,
            { debounceMs: 0 }
        );
        const secondPromise = runDebouncedCoalescedOperation(
            key,
            () => operationPromise,
            { debounceMs: 0 }
        );

        resolveOp!('coalesced');
        const [first, second] = await Promise.all([firstPromise, secondPromise]);

        expect(first.result).toBe('coalesced');
        expect(first.coalesced).toBe(false);

        expect(second.result).toBe('coalesced');
        expect(second.coalesced).toBe(true);
    });

    it('handles operation errors', async () => {
        const key = `debounce-error-${Date.now()}`;

        await expect(
            runDebouncedCoalescedOperation(
                key,
                async () => {
                    throw new Error('debounced op failed');
                },
                { debounceMs: 0 }
            )
        ).rejects.toThrow('debounced op failed');
    });

    it('supports timeoutMs option', async () => {
        const key = `debounce-timeout-${Date.now()}`;
        const neverResolves = new Promise<string>(() => {});

        const resultPromise = runDebouncedCoalescedOperation(
            key,
            () => neverResolves,
            { debounceMs: 0, timeoutMs: 50 }
        );

        vi.advanceTimersByTime(60);
        await expect(resultPromise).rejects.toThrow(
            /Debounced operation timed out after 50ms/
        );
    });
});

describe('createCloudRuntime', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.useRealTimers();
        process.env = { ...originalEnv };
        delete process.env.RIOTPLAN_CLOUD_ENABLED;
        delete process.env.RIOTPLAN_GCS_ENABLED;
        delete process.env.RIOTPLAN_PLAN_BUCKET;
        delete process.env.RIOTPLAN_CONTEXT_BUCKET;
        delete process.env.RIOTPLAN_GCS_PLAN_BUCKET;
        delete process.env.RIOTPLAN_GCS_CONTEXT_BUCKET;
    });

    it('returns disabled runtime when cloud is not enabled', async () => {
        const runtime = await createCloudRuntime(
            { cloud: { enabled: false } },
            '/tmp/plans'
        );

        expect(runtime.enabled).toBe(false);
        expect(runtime.workingDirectory).toBe('/tmp/plans');
        expect(runtime.contextDirectory).toBe('/tmp/plans');

        const syncDownResult = await runtime.syncDown();
        expect(syncDownResult).toEqual({
            plan: null,
            context: null,
            syncFreshHit: false,
            coalescedWaiterCount: 0,
        });

        const syncUpPlansResult = await runtime.syncUpPlans();
        expect(syncUpPlansResult).toBeNull();

        const syncUpContextResult = await runtime.syncUpContext();
        expect(syncUpContextResult).toBeNull();
    });

    it('returns disabled runtime when config is undefined', async () => {
        const runtime = await createCloudRuntime(undefined, '/tmp/plans');

        expect(runtime.enabled).toBe(false);
        expect(await runtime.syncDown()).toEqual({
            plan: null,
            context: null,
            syncFreshHit: false,
            coalescedWaiterCount: 0,
        });
        expect(await runtime.syncUpPlans()).toBeNull();
        expect(await runtime.syncUpContext()).toBeNull();
    });

    it('returns disabled runtime when config.cloud is undefined', async () => {
        const runtime = await createCloudRuntime({}, '/tmp/plans');

        expect(runtime.enabled).toBe(false);
        expect(await runtime.syncUpPlans()).toBeNull();
    });

    it('throws when enabled but missing bucket config', async () => {
        await expect(
            createCloudRuntime(
                {
                    cloud: {
                        enabled: true,
                        planBucket: undefined,
                        contextBucket: undefined,
                    },
                },
                '/tmp/plans'
            )
        ).rejects.toThrow(
            'Cloud mode enabled but missing bucket config. Set cloud.planBucket + cloud.contextBucket or RIOTPLAN_PLAN_BUCKET + RIOTPLAN_CONTEXT_BUCKET.'
        );
    });

    it('throws when enabled via config with only planBucket (missing contextBucket)', async () => {
        await expect(
            createCloudRuntime(
                {
                    cloud: {
                        enabled: true,
                        planBucket: 'my-plan-bucket',
                        contextBucket: undefined,
                    },
                },
                '/tmp/plans'
            )
        ).rejects.toThrow(
            'Cloud mode enabled but missing bucket config. Set cloud.planBucket + cloud.contextBucket or RIOTPLAN_PLAN_BUCKET + RIOTPLAN_CONTEXT_BUCKET.'
        );
    });

    it('throws when enabled via env but missing buckets', async () => {
        process.env.RIOTPLAN_CLOUD_ENABLED = 'true';

        await expect(
            createCloudRuntime(undefined, '/tmp/plans')
        ).rejects.toThrow(
            'Cloud mode enabled but missing bucket config. Set cloud.planBucket + cloud.contextBucket or RIOTPLAN_PLAN_BUCKET + RIOTPLAN_CONTEXT_BUCKET.'
        );
    });

    it('returns enabled runtime when buckets are configured', async () => {
        const localPlanDir = join(tmpdir(), `riotplan-cloud-test-${Date.now()}`);
        const runtime = await createCloudRuntime(
            {
                cloud: {
                    enabled: true,
                    planBucket: 'my-plan-bucket',
                    contextBucket: 'my-context-bucket',
                },
            },
            localPlanDir
        );

        expect(runtime.enabled).toBe(true);
        expect(runtime.workingDirectory).toContain('.cloud-cache');
        expect(runtime.contextDirectory).toContain('.cloud-cache');

        const syncDownResult = await runtime.syncDown();
        expect(syncDownResult.plan).not.toBeNull();
        expect(syncDownResult.context).not.toBeNull();
        expect(syncDownResult.plan?.bucket).toBe('test-bucket');
        expect(syncDownResult.context?.bucket).toBe('test-bucket');

        const syncUpPlansResult = await runtime.syncUpPlans();
        expect(syncUpPlansResult).not.toBeNull();
        expect(syncUpPlansResult?.bucket).toBe('test-bucket');

        const syncUpContextResult = await runtime.syncUpContext();
        expect(syncUpContextResult).not.toBeNull();
        expect(syncUpContextResult?.bucket).toBe('test-bucket');
    });

    it('syncDown with forceRefresh bypasses freshness cache and runs sync', async () => {
        const localPlanDir = join(tmpdir(), `riotplan-cloud-test-fresh-${Date.now()}`);
        const runtime = await createCloudRuntime(
            {
                cloud: {
                    enabled: true,
                    planBucket: 'p',
                    contextBucket: 'c',
                },
            },
            localPlanDir
        );

        const first = await runtime.syncDown();
        expect(first.plan).not.toBeNull();

        const second = await runtime.syncDown({ forceRefresh: true });
        expect(second.plan).not.toBeNull();
        expect(second.context).not.toBeNull();
    });

    it('calls diagnostics.debug when provided', async () => {
        const debug = vi.fn();
        const localPlanDir = join(tmpdir(), `riotplan-cloud-test-dbg-${Date.now()}`);
        const runtime = await createCloudRuntime(
            {
                cloud: {
                    enabled: true,
                    planBucket: 'p',
                    contextBucket: 'c',
                },
            },
            localPlanDir,
            { debug }
        );

        await runtime.syncDown();
        expect(debug).toHaveBeenCalledWith(
            'sync_down.start',
            expect.objectContaining({
                planBucket: 'p',
                contextBucket: 'c',
            })
        );

        await runtime.syncUpPlans();
        expect(debug).toHaveBeenCalledWith(
            'sync_up_plans.start',
            expect.any(Object)
        );

        await runtime.syncUpContext();
        expect(debug).toHaveBeenCalledWith(
            'sync_up_context.start',
            expect.any(Object)
        );
    });
});
