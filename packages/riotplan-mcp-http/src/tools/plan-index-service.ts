import { basename, join } from 'node:path';
import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import Logging from '@fjell/logging';
import { createSqliteProvider } from '@planvokter/riotplan-format';
import { readProjectBinding, type ProjectBinding } from './project-binding-shared.js';
import { getPlanCategory, type PlanCategory } from '@planvokter/riotplan';

const logger = Logging.getLogger('@planvokter/riotplan-http').get('plan-index');
const INDEX_SCHEMA_VERSION = 1;
const DEFAULT_INDEX_PATH = '.riotplan/plans-index-v1.json';

export interface PlanIndexEntry {
    id: string;
    name: string;
    path: string;
    uuid?: string;
    title?: string;
    stage?: string;
    createdAt?: string;
    updatedAt?: string;
    category: PlanCategory;
    project?: ProjectBinding | null;
    projectSource?: 'explicit' | 'inferred' | 'none';
    sourceSize: number;
    sourceUpdatedAt: string | null;
    hydratedAt: string;
}

interface PersistedPlanIndex {
    version: number;
    builtAt: string;
    entries: Record<string, PlanIndexEntry>;
}

interface PlanFileMetadata {
    path: string;
    size: number;
    updatedAt: string | null;
}

function normalizePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/');
}

function metadataVersionKey(metadata: PlanFileMetadata): string {
    return [metadata.updatedAt || '', String(Number(metadata.size || 0))].join('|');
}

function entryVersionKey(entry: PlanIndexEntry): string {
    return [entry.sourceUpdatedAt || '', String(Number(entry.sourceSize || 0))].join('|');
}

async function collectPlanFiles(rootDir: string): Promise<PlanFileMetadata[]> {
    const results: PlanFileMetadata[] = [];
    async function scan(dir: string): Promise<void> {
        let entries: Dirent<string>[];
        try {
            entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' });
        } catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.')) {
                    await scan(fullPath);
                }
                continue;
            }
            if (!entry.name.endsWith('.plan')) continue;
            try {
                const s = await stat(fullPath);
                results.push({
                    path: fullPath,
                    size: s.size,
                    updatedAt: s.mtime ? s.mtime.toISOString() : null,
                });
            } catch {
                // Ignore transient file-system races.
            }
        }
    }
    await scan(rootDir);
    return results;
}

class PlanIndexService {
    private readonly entries = new Map<string, PlanIndexEntry>();
    private sidecarLoaded = false;
    private refreshInFlight: Promise<void> | null = null;
    private persistInFlight = false;
    private persistRequested = false;
    private lastRefreshAt = 0;

    constructor(
        private readonly rootDirectory: string,
        private readonly indexPath: string = DEFAULT_INDEX_PATH,
        private readonly refreshTtlMs: number = 5_000
    ) {}

    async list(): Promise<PlanIndexEntry[]> {
        await this.refreshIfNeeded();
        return Array.from(this.entries.values());
    }

    private async refreshIfNeeded(): Promise<void> {
        if (!this.sidecarLoaded) {
            await this.loadSidecar();
        }
        const now = Date.now();
        if (this.entries.size > 0 && now - this.lastRefreshAt <= this.refreshTtlMs) {
            return;
        }
        await this.refreshOnce();
        this.lastRefreshAt = Date.now();
    }

    private async refreshOnce(): Promise<void> {
        if (this.refreshInFlight) {
            await this.refreshInFlight;
            return;
        }
        this.refreshInFlight = this.refresh().finally(() => {
            this.refreshInFlight = null;
        });
        await this.refreshInFlight;
    }

    private async refresh(): Promise<void> {
        const startedAt = Date.now();
        const listed = await collectPlanFiles(this.rootDirectory);
        const byPath = new Map(listed.map((metadata) => [metadata.path, metadata]));

        let cacheHits = 0;
        let changedCount = 0;
        let hydrateSuccess = 0;
        let hydrateFailed = 0;
        let removedCount = 0;

        for (const [entryPath] of this.entries) {
            if (!byPath.has(entryPath)) {
                this.entries.delete(entryPath);
                removedCount++;
            }
        }

        for (const metadata of listed) {
            const cached = this.entries.get(metadata.path);
            const sameVersion = cached ? entryVersionKey(cached) === metadataVersionKey(metadata) : false;
            if (sameVersion) {
                cacheHits++;
                continue;
            }
            changedCount++;
            const hydrated = await this.hydrateEntry(metadata);
            if (!hydrated) {
                hydrateFailed++;
                continue;
            }
            hydrateSuccess++;
            this.entries.set(metadata.path, hydrated);
        }

        this.schedulePersist();
        logger.info('plans.index.refresh.complete', {
            rootDirectory: this.rootDirectory,
            listedPlans: listed.length,
            cacheHits,
            changedCount,
            hydrateSuccess,
            hydrateFailed,
            removedCount,
            indexedEntries: this.entries.size,
            elapsedMs: Date.now() - startedAt,
        });
    }

    private async hydrateEntry(metadata: PlanFileMetadata): Promise<PlanIndexEntry | null> {
        let provider: ReturnType<typeof createSqliteProvider> | null = null;
        try {
            provider = createSqliteProvider(metadata.path);
            const exists = await provider.exists();
            if (!exists) {
                return null;
            }
            const metaResult = await provider.getMetadata();
            if (!metaResult.success || !metaResult.data) {
                return null;
            }
            const m = metaResult.data;
            const binding = await readProjectBinding(metadata.path);
            return {
                id: m.id || basename(metadata.path, '.plan'),
                name: basename(metadata.path, '.plan'),
                path: metadata.path,
                uuid: m.uuid,
                title: m.name,
                stage: m.stage,
                createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
                updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : undefined,
                category: getPlanCategory(metadata.path),
                project: binding.project,
                projectSource: binding.source,
                sourceSize: Number(metadata.size || 0),
                sourceUpdatedAt: metadata.updatedAt || null,
                hydratedAt: new Date().toISOString(),
            } satisfies PlanIndexEntry;
        } catch (error) {
            logger.warning('plans.index.hydrate.failed', {
                path: metadata.path,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        } finally {
            try {
                await provider?.close();
            } catch {
                // Ignore close failures.
            }
        }
    }

    private async loadSidecar(): Promise<void> {
        this.sidecarLoaded = true;
        try {
            const sidecarPath = join(this.rootDirectory, this.indexPath);
            const raw = await readFile(sidecarPath, 'utf8');
            const parsed = JSON.parse(raw) as Partial<PersistedPlanIndex>;
            if (parsed.version !== INDEX_SCHEMA_VERSION || !parsed.entries || typeof parsed.entries !== 'object') {
                logger.warning('plans.index.sidecar.invalid_schema', {
                    indexPath: sidecarPath,
                    version: parsed.version ?? null,
                });
                return;
            }
            for (const [pathValue, entry] of Object.entries(parsed.entries)) {
                if (!entry || typeof entry !== 'object') continue;
                this.entries.set(pathValue, {
                    ...entry,
                    path: pathValue,
                    sourceSize: Number(entry.sourceSize || 0),
                    sourceUpdatedAt: entry.sourceUpdatedAt || null,
                    hydratedAt: entry.hydratedAt || new Date(0).toISOString(),
                });
            }
            logger.info('plans.index.sidecar.loaded', {
                indexPath: sidecarPath,
                loadedEntries: this.entries.size,
            });
        } catch {
            // No sidecar yet or unreadable sidecar; index will rebuild.
        }
    }

    private schedulePersist(): void {
        this.persistRequested = true;
        if (this.persistInFlight) return;
        void this.persistLoop();
    }

    private async persistLoop(): Promise<void> {
        this.persistInFlight = true;
        try {
            while (this.persistRequested) {
                this.persistRequested = false;
                const payload: PersistedPlanIndex = {
                    version: INDEX_SCHEMA_VERSION,
                    builtAt: new Date().toISOString(),
                    entries: Object.fromEntries(this.entries.entries()),
                };
                const sidecarPath = join(this.rootDirectory, this.indexPath);
                try {
                    await mkdir(join(this.rootDirectory, '.riotplan'), { recursive: true });
                    await writeFile(sidecarPath, JSON.stringify(payload), 'utf8');
                } catch (error) {
                    logger.warning('plans.index.sidecar.save_failed', {
                        indexPath: sidecarPath,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        } finally {
            this.persistInFlight = false;
        }
    }
}

const serviceInstances = new Map<string, PlanIndexService>();

function getService(rootDirectory: string): PlanIndexService {
    const key = normalizePath(rootDirectory);
    const existing = serviceInstances.get(key);
    if (existing) return existing;
    const created = new PlanIndexService(rootDirectory);
    serviceInstances.set(key, created);
    return created;
}

export async function listPlansViaIndex(rootDirectory: string): Promise<PlanIndexEntry[]> {
    return getService(rootDirectory).list();
}

