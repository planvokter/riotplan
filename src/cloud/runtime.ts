import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { RiotPlanConfig } from '../config/schema.js';
import { GcsMirror } from './gcs-sync.js';

function isTruthy(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return /^(1|true|yes|on)$/i.test(value);
    }
    return false;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}

export interface CloudRuntimeDirectories {
    workingDirectory: string;
    contextDirectory: string;
}

export interface CloudRuntime extends CloudRuntimeDirectories {
    enabled: boolean;
    syncDown: () => Promise<void>;
    syncUpPlans: () => Promise<void>;
    syncUpContext: () => Promise<void>;
}

export async function createCloudRuntime(
    config: RiotPlanConfig | null | undefined,
    localPlanDirectory: string
): Promise<CloudRuntime> {
    const cloudConfig = config?.cloud;
    const enabled =
        isTruthy(cloudConfig?.enabled) ||
        isTruthy(process.env.RIOTPLAN_CLOUD_ENABLED) ||
        isTruthy(process.env.RIOTPLAN_GCS_ENABLED);

    if (!enabled) {
        return {
            enabled: false,
            workingDirectory: localPlanDirectory,
            contextDirectory: localPlanDirectory,
            syncDown: async () => {},
            syncUpPlans: async () => {},
            syncUpContext: async () => {},
        };
    }

    const planBucket = firstNonEmpty(
        cloudConfig?.planBucket,
        process.env.RIOTPLAN_PLAN_BUCKET,
        process.env.RIOTPLAN_GCS_PLAN_BUCKET
    );
    const contextBucket = firstNonEmpty(
        cloudConfig?.contextBucket,
        process.env.RIOTPLAN_CONTEXT_BUCKET,
        process.env.RIOTPLAN_GCS_CONTEXT_BUCKET
    );

    if (!planBucket || !contextBucket) {
        throw new Error(
            'Cloud mode enabled but missing bucket config. Set cloud.planBucket + cloud.contextBucket or RIOTPLAN_PLAN_BUCKET + RIOTPLAN_CONTEXT_BUCKET.'
        );
    }

    const cacheRoot = resolve(
        firstNonEmpty(cloudConfig?.cacheDirectory, process.env.RIOTPLAN_CLOUD_CACHE_DIR) ||
            join(localPlanDirectory, '.cloud-cache')
    );
    const planMirrorDir = join(cacheRoot, 'plans');
    const contextMirrorDir = join(cacheRoot, 'context');

    await mkdir(planMirrorDir, { recursive: true });
    await mkdir(contextMirrorDir, { recursive: true });

    const auth = {
        projectId: firstNonEmpty(cloudConfig?.projectId, process.env.GOOGLE_CLOUD_PROJECT),
        keyFilename: firstNonEmpty(cloudConfig?.keyFilename, process.env.GOOGLE_APPLICATION_CREDENTIALS),
        credentialsJson: firstNonEmpty(cloudConfig?.credentialsJson, process.env.GOOGLE_CREDENTIALS_JSON),
    };

    const planMirror = new GcsMirror({
        auth,
        location: {
            bucket: planBucket,
            prefix: cloudConfig?.planPrefix,
        },
        localDirectory: planMirrorDir,
        includeFile: (relativePath) => relativePath.endsWith('.plan'),
    });

    const contextMirror = new GcsMirror({
        auth,
        location: {
            bucket: contextBucket,
            prefix: cloudConfig?.contextPrefix,
        },
        localDirectory: contextMirrorDir,
    });

    return {
        enabled: true,
        workingDirectory: planMirrorDir,
        contextDirectory: contextMirrorDir,
        syncDown: async () => {
            await Promise.all([planMirror.syncDown(), contextMirror.syncDown()]);
        },
        syncUpPlans: async () => {
            await planMirror.syncUp();
        },
        syncUpContext: async () => {
            await contextMirror.syncUp();
        },
    };
}
