import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GcsMirror } from './gcs-sync.js';
import type { GcsSyncDownStats, GcsSyncUpStats } from './gcs-sync.js';

export interface CloudStorageConfig {
    enabled?: boolean;
    incrementalSyncEnabled?: boolean;
    syncFreshnessTtlMs?: number;
    syncTimeoutMs?: number;
    planBucket?: string;
    planPrefix?: string;
    contextBucket?: string;
    contextPrefix?: string;
    projectId?: string;
    keyFilename?: string;
    credentialsJson?: string;
    cacheDirectory?: string;
}

export interface CloudRuntimeConfig {
    cloud?: CloudStorageConfig;
}

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
    syncDown: (options?: { forceRefresh?: boolean }) => Promise<{
        plan: GcsSyncDownStats | null;
        context: GcsSyncDownStats | null;
        syncFreshHit: boolean;
        coalescedWaiterCount: number;
    }>;
    syncUpPlans: () => Promise<GcsSyncUpStats | null>;
    syncUpContext: () => Promise<GcsSyncUpStats | null>;
}

export interface CloudRuntimeDiagnostics {
    debug?: (event: string, details?: Record<string, unknown>) => void;
}

type InFlightOperation<T> = {
    promise: Promise<T>;
    waiterCount: number;
};

type DebouncedOperationState<T> = {
    promise: Promise<T>;
    waiterCount: number;
};

const inFlightOperations = new Map<string, InFlightOperation<unknown>>();
const debouncedOperations = new Map<string, DebouncedOperationState<unknown>>();
const lastSuccessfulSyncAtByScope = new Map<string, number>();

function toInt(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function resolveFreshnessTtlMs(config: CloudRuntimeConfig | null | undefined): number {
    const fromConfig = (config?.cloud as Record<string, unknown> | undefined)?.syncFreshnessTtlMs;
    if (typeof fromConfig === 'number' && Number.isFinite(fromConfig) && fromConfig >= 0) {
        return fromConfig;
    }
    return toInt(process.env.RIOTPLAN_CLOUD_SYNC_FRESHNESS_TTL_MS) || 5_000;
}

function resolveSyncTimeoutMs(config: CloudRuntimeConfig | null | undefined): number {
    const fromConfig = (config?.cloud as Record<string, unknown> | undefined)?.syncTimeoutMs;
    if (typeof fromConfig === 'number' && Number.isFinite(fromConfig) && fromConfig > 0) {
        return fromConfig;
    }
    return toInt(process.env.RIOTPLAN_CLOUD_SYNC_TIMEOUT_MS) || 120_000;
}

function resolveSyncUpDebounceMs(_config: CloudRuntimeConfig | null | undefined): number {
    const fromEnv = toInt(process.env.RIOTPLAN_CLOUD_SYNC_UP_DEBOUNCE_MS);
    if (typeof fromEnv === 'number') {
        return fromEnv;
    }
    // Internal server-side default; not exposed through MCP schemas.
    return 400;
}

export async function runCoalescedOperation<T>(
    key: string,
    operation: () => Promise<T>,
    options?: { timeoutMs?: number }
): Promise<{ result: T; coalesced: boolean; waiterCount: number }> {
    const existing = inFlightOperations.get(key) as InFlightOperation<T> | undefined;
    if (existing) {
        existing.waiterCount += 1;
        const result = await existing.promise;
        return {
            result,
            coalesced: true,
            waiterCount: existing.waiterCount,
        };
    }

    const timeoutMs = options?.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 0;
    const entry: InFlightOperation<T> = {
        waiterCount: 0,
        promise: (async () => {
            try {
                if (!timeoutMs) {
                    return await operation();
                }
                return await Promise.race([
                    operation(),
                    new Promise<T>((_, reject) => {
                        setTimeout(() => {
                            reject(new Error(`Coalesced operation timed out after ${timeoutMs}ms`));
                        }, timeoutMs);
                    }),
                ]);
            } finally {
                inFlightOperations.delete(key);
            }
        })(),
    };
    inFlightOperations.set(key, entry);
    const result = await entry.promise;
    return {
        result,
        coalesced: false,
        waiterCount: entry.waiterCount,
    };
}

export async function runDebouncedCoalescedOperation<T>(
    key: string,
    operation: () => Promise<T>,
    options?: { debounceMs?: number; timeoutMs?: number }
): Promise<{ result: T; coalesced: boolean; waiterCount: number }> {
    const existing = debouncedOperations.get(key) as DebouncedOperationState<T> | undefined;
    if (existing) {
        existing.waiterCount += 1;
        const result = await existing.promise;
        return {
            result,
            coalesced: true,
            waiterCount: existing.waiterCount,
        };
    }

    const debounceMs = options?.debounceMs && options.debounceMs > 0 ? options.debounceMs : 0;
    const timeoutMs = options?.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const promise = new Promise<T>((resolve, reject) => {
        const execute = async () => {
            const run = async () => operation();
            const task = timeoutMs
                ? Promise.race([
                    run(),
                    new Promise<T>((_, timeoutReject) => {
                        setTimeout(() => {
                            timeoutReject(new Error(`Debounced operation timed out after ${timeoutMs}ms`));
                        }, timeoutMs);
                    }),
                ])
                : run();
            try {
                resolve(await task);
            } catch (error) {
                reject(error);
            } finally {
                debouncedOperations.delete(key);
            }
        };

        if (debounceMs > 0) {
            timer = setTimeout(() => {
                void execute();
            }, debounceMs);
            return;
        }

        void execute();
    });

    const state: DebouncedOperationState<T> = {
        promise,
        waiterCount: 0,
    };
    debouncedOperations.set(key, state);

    try {
        const result = await promise;
        return {
            result,
            coalesced: false,
            waiterCount: state.waiterCount,
        };
    } catch (error) {
        if (timer) {
            clearTimeout(timer);
        }
        throw error;
    }
}

export async function createCloudRuntime(
    config: CloudRuntimeConfig | null | undefined,
    localPlanDirectory: string,
    diagnostics?: CloudRuntimeDiagnostics
): Promise<CloudRuntime> {
    const cloudConfig = config?.cloud;
    const incrementalSyncEnabled = (cloudConfig as Record<string, unknown> | undefined)?.incrementalSyncEnabled !== false;
    const freshnessTtlMs = incrementalSyncEnabled ? resolveFreshnessTtlMs(config) : 0;
    const syncTimeoutMs = resolveSyncTimeoutMs(config);
    const syncUpDebounceMs = resolveSyncUpDebounceMs(config);
    const enabled =
        isTruthy(cloudConfig?.enabled) ||
        isTruthy(process.env.RIOTPLAN_CLOUD_ENABLED) ||
        isTruthy(process.env.RIOTPLAN_GCS_ENABLED);

    if (!enabled) {
        return {
            enabled: false,
            workingDirectory: localPlanDirectory,
            contextDirectory: localPlanDirectory,
            syncDown: async () => ({
                plan: null,
                context: null,
                syncFreshHit: false,
                coalescedWaiterCount: 0,
            }),
            syncUpPlans: async () => null,
            syncUpContext: async () => null,
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
        incrementalSyncEnabled,
        onDebugEvent: (event, details) => {
            diagnostics?.debug?.(`plan.${event}`, details);
        },
    });

    const contextMirror = new GcsMirror({
        auth,
        location: {
            bucket: contextBucket,
            prefix: cloudConfig?.contextPrefix,
        },
        localDirectory: contextMirrorDir,
        incrementalSyncEnabled,
        onDebugEvent: (event, details) => {
            diagnostics?.debug?.(`context.${event}`, details);
        },
    });

    return {
        enabled: true,
        workingDirectory: planMirrorDir,
        contextDirectory: contextMirrorDir,
        syncDown: async (options) => {
            const startedAt = Date.now();
            const planScope = `sync_down:${planMirrorDir}:plan`;
            const contextScope = `sync_down:${contextMirrorDir}:context`;
            const now = Date.now();
            const planFresh = freshnessTtlMs > 0 && now - (lastSuccessfulSyncAtByScope.get(planScope) || 0) <= freshnessTtlMs;
            const contextFresh = freshnessTtlMs > 0 && now - (lastSuccessfulSyncAtByScope.get(contextScope) || 0) <= freshnessTtlMs;
            if (!options?.forceRefresh && planFresh && contextFresh) {
                diagnostics?.debug?.('sync_down.fresh_hit', {
                    freshnessTtlMs,
                    planScope,
                    contextScope,
                });
                return {
                    plan: null,
                    context: null,
                    syncFreshHit: true,
                    coalescedWaiterCount: 0,
                };
            }
            diagnostics?.debug?.('sync_down.start', {
                planBucket,
                contextBucket,
                planMirrorDir,
                contextMirrorDir,
                incrementalSyncEnabled,
                freshnessTtlMs,
                syncTimeoutMs,
            });
            const [planSync, contextSync] = await Promise.all([
                runCoalescedOperation(planScope, () => planMirror.syncDown(), { timeoutMs: syncTimeoutMs }),
                runCoalescedOperation(contextScope, () => contextMirror.syncDown(), { timeoutMs: syncTimeoutMs }),
            ]);
            const planStats = planSync.result;
            const contextStats = contextSync.result;
            lastSuccessfulSyncAtByScope.set(planScope, Date.now());
            lastSuccessfulSyncAtByScope.set(contextScope, Date.now());
            const coalescedWaiterCount = planSync.waiterCount + contextSync.waiterCount;
            const syncFreshHit = planStats.downloadedCount === 0 && contextStats.downloadedCount === 0;
            diagnostics?.debug?.('sync_down.complete', {
                elapsedMs: Date.now() - startedAt,
                syncFreshHit,
                coalescedWaiterCount,
                syncOutcome: syncFreshHit ? 'fresh-hit' : 'full-or-incremental',
                plan: planStats,
                context: contextStats,
            });
            return {
                plan: planStats,
                context: contextStats,
                syncFreshHit,
                coalescedWaiterCount,
            };
        },
        syncUpPlans: async () => {
            const startedAt = Date.now();
            diagnostics?.debug?.('sync_up_plans.start', { planBucket, planMirrorDir });
            const syncUpScope = `sync_up:${planMirrorDir}:plan`;
            const syncResult = await runDebouncedCoalescedOperation(
                syncUpScope,
                () => planMirror.syncUp(),
                { debounceMs: syncUpDebounceMs, timeoutMs: syncTimeoutMs }
            );
            const stats = syncResult.result;
            if (syncResult.coalesced || syncResult.waiterCount > 0) {
                diagnostics?.debug?.('sync_up_plans.coalesced', {
                    scope: syncUpScope,
                    coalesced: syncResult.coalesced,
                    coalescedWaiterCount: syncResult.waiterCount,
                    debounceMs: syncUpDebounceMs,
                });
            }
            diagnostics?.debug?.('sync_up_plans.complete', {
                elapsedMs: Date.now() - startedAt,
                plan: stats,
                coalesced: syncResult.coalesced,
                coalescedWaiterCount: syncResult.waiterCount,
                debounceMs: syncUpDebounceMs,
            });
            return stats;
        },
        syncUpContext: async () => {
            const startedAt = Date.now();
            diagnostics?.debug?.('sync_up_context.start', { contextBucket, contextMirrorDir });
            const syncUpScope = `sync_up:${contextMirrorDir}:context`;
            const syncResult = await runDebouncedCoalescedOperation(
                syncUpScope,
                () => contextMirror.syncUp(),
                { debounceMs: syncUpDebounceMs, timeoutMs: syncTimeoutMs }
            );
            const stats = syncResult.result;
            if (syncResult.coalesced || syncResult.waiterCount > 0) {
                diagnostics?.debug?.('sync_up_context.coalesced', {
                    scope: syncUpScope,
                    coalesced: syncResult.coalesced,
                    coalescedWaiterCount: syncResult.waiterCount,
                    debounceMs: syncUpDebounceMs,
                });
            }
            diagnostics?.debug?.('sync_up_context.complete', {
                elapsedMs: Date.now() - startedAt,
                context: stats,
                coalesced: syncResult.coalesced,
                coalescedWaiterCount: syncResult.waiterCount,
                debounceMs: syncUpDebounceMs,
            });
            return stats;
        },
    };
}
