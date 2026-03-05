import { afterEach, describe, expect, it } from 'vitest';
import {
    createCloudRuntime,
    runCoalescedOperation,
    runDebouncedCoalescedOperation,
} from '../../src/cloud/runtime.js';

const ORIGINAL_ENV = { ...process.env };

describe('createCloudRuntime', () => {
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('defaults to local mode when cloud is disabled', async () => {
        const runtime = await createCloudRuntime(null, '/tmp/riotplan/plans');
        expect(runtime.enabled).toBe(false);
        expect(runtime.workingDirectory).toBe('/tmp/riotplan/plans');
        expect(runtime.contextDirectory).toBe('/tmp/riotplan/plans');
    });

    it('requires both plan and context buckets when cloud mode is enabled', async () => {
        await expect(
            createCloudRuntime(
                {
                    cloud: {
                        enabled: true,
                        planBucket: 'plans-only',
                    },
                } as any,
                '/tmp/riotplan/plans'
            )
        ).rejects.toThrow('missing bucket config');
    });

    it('creates mirrored cloud runtime directories when configured', async () => {
        const runtime = await createCloudRuntime(
            {
                cloud: {
                    enabled: true,
                    planBucket: 'riotplan-plan-bucket',
                    contextBucket: 'riotplan-context-bucket',
                    cacheDirectory: '/tmp/riotplan-gcs-cache',
                },
            } as any,
            '/tmp/riotplan/plans'
        );

        expect(runtime.enabled).toBe(true);
        expect(runtime.workingDirectory).toContain('/tmp/riotplan-gcs-cache/plans');
        expect(runtime.contextDirectory).toContain('/tmp/riotplan-gcs-cache/context');
    });

    it('coalesces concurrent operations to a single execution', async () => {
        let executions = 0;
        const operation = async () => {
            executions += 1;
            await new Promise((resolve) => setTimeout(resolve, 10));
            return 'ok';
        };

        const [a, b, c] = await Promise.all([
            runCoalescedOperation('coalesce:test', operation),
            runCoalescedOperation('coalesce:test', operation),
            runCoalescedOperation('coalesce:test', operation),
        ]);

        expect(executions).toBe(1);
        expect(a.result).toBe('ok');
        expect(b.result).toBe('ok');
        expect(c.result).toBe('ok');
        expect([a.coalesced, b.coalesced, c.coalesced].filter(Boolean).length).toBe(2);
        expect(Math.max(a.waiterCount, b.waiterCount, c.waiterCount)).toBe(2);
    });

    it('releases coalesced entries after timeout/failure', async () => {
        const longOperation = async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return 'late';
        };

        await expect(
            Promise.all([
                runCoalescedOperation('coalesce:timeout', longOperation, { timeoutMs: 5 }),
                runCoalescedOperation('coalesce:timeout', longOperation, { timeoutMs: 5 }),
            ])
        ).rejects.toThrow('timed out');

        const quick = await runCoalescedOperation(
            'coalesce:timeout',
            async () => 'recovered',
            { timeoutMs: 100 }
        );
        expect(quick.result).toBe('recovered');
    });

    it('handles parallel burst with single upstream execution', async () => {
        let executions = 0;
        const burstOperation = async () => {
            executions += 1;
            await new Promise((resolve) => setTimeout(resolve, 5));
            return 'burst-ok';
        };
        const burst = Array.from({ length: 10 }, () =>
            runCoalescedOperation('coalesce:burst', burstOperation, { timeoutMs: 100 })
        );
        const results = await Promise.all(burst);
        expect(executions).toBe(1);
        expect(results.every((r) => r.result === 'burst-ok')).toBe(true);
    });

    it('debounces and coalesces burst operations', async () => {
        let executions = 0;
        const operation = async () => {
            executions += 1;
            return 'debounced-ok';
        };

        const [a, b, c] = await Promise.all([
            runDebouncedCoalescedOperation('debounce:test', operation, { debounceMs: 20, timeoutMs: 100 }),
            runDebouncedCoalescedOperation('debounce:test', operation, { debounceMs: 20, timeoutMs: 100 }),
            runDebouncedCoalescedOperation('debounce:test', operation, { debounceMs: 20, timeoutMs: 100 }),
        ]);

        expect(executions).toBe(1);
        expect(a.result).toBe('debounced-ok');
        expect(b.result).toBe('debounced-ok');
        expect(c.result).toBe('debounced-ok');
        expect([a.coalesced, b.coalesced, c.coalesced].filter(Boolean).length).toBe(2);
        expect(Math.max(a.waiterCount, b.waiterCount, c.waiterCount)).toBe(2);
    });

    it('runs immediately when debounce is disabled', async () => {
        let executions = 0;
        const operation = async () => {
            executions += 1;
            return 'no-debounce';
        };

        const result = await runDebouncedCoalescedOperation(
            'debounce:none',
            operation,
            { debounceMs: 0, timeoutMs: 100 }
        );

        expect(executions).toBe(1);
        expect(result.result).toBe('no-debounce');
        expect(result.coalesced).toBe(false);
    });
});
