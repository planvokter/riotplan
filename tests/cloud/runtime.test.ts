import { afterEach, describe, expect, it } from 'vitest';
import { createCloudRuntime } from '../../src/cloud/runtime.js';

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
});
