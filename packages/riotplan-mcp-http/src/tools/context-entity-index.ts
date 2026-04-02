import { join } from 'node:path';
import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as yaml from 'js-yaml';
import Logging from '@fjell/logging';

const logger = Logging.getLogger('@planvokter/riotplan-http').get('context-entity-index');
const INDEX_SCHEMA_VERSION = 1;
const INDEX_PATH = '.riotplan/context-entities-index-v1.json';
const REFRESH_TTL_MS = 5_000;

type EntityType = 'project';

interface IndexedEntityEntry {
    entityType: EntityType;
    path: string;
    id: string;
    name: string;
    slug?: string;
    payload: Record<string, unknown>;
    sourceUpdatedAt: string | null;
    sourceSize: number;
    hydratedAt: string;
}

interface PersistedEntityIndex {
    version: number;
    builtAt: string;
    byType: Record<EntityType, Record<string, IndexedEntityEntry>>;
}

interface FileMetadata {
    path: string;
    size: number;
    updatedAt: string | null;
}

const ENTITY_DIRECTORY: Record<EntityType, string> = {
    project: 'projects',
};

function normalizePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/');
}

function metadataVersionKey(metadata: FileMetadata): string {
    return [metadata.updatedAt || '', String(metadata.size || 0)].join('|');
}

function entryVersionKey(entry: IndexedEntityEntry): string {
    return [entry.sourceUpdatedAt || '', String(entry.sourceSize || 0)].join('|');
}

function isYamlPath(pathValue: string): boolean {
    const lower = pathValue.toLowerCase();
    return lower.endsWith('.yaml') || lower.endsWith('.yml');
}

async function collectFilesRecursive(rootDir: string): Promise<FileMetadata[]> {
    const files: FileMetadata[] = [];
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
                await scan(fullPath);
                continue;
            }
            try {
                const s = await stat(fullPath);
                files.push({
                    path: fullPath,
                    size: s.size,
                    updatedAt: s.mtime ? s.mtime.toISOString() : null,
                });
            } catch {
                // Ignore transient races.
            }
        }
    }
    await scan(rootDir);
    return files;
}

class ContextEntityIndexService {
    private readonly byType = new Map<EntityType, Map<string, IndexedEntityEntry>>([['project', new Map()]]);
    private readonly dirtyTypes = new Set<EntityType>();
    private sidecarLoaded = false;
    private persistInFlight = false;
    private persistRequested = false;
    private readonly lastRefreshAtByType = new Map<EntityType, number>();
    private readonly refreshInFlightByType = new Map<EntityType, Promise<void>>();

    constructor(private readonly contextRoot: string) {}

    markDirty(entityType?: EntityType): void {
        if (entityType) {
            this.dirtyTypes.add(entityType);
            return;
        }
        this.dirtyTypes.add('project');
    }

    async list(entityType: EntityType): Promise<Array<Record<string, unknown>>> {
        await this.refreshTypeIfNeeded(entityType);
        const entries = this.byType.get(entityType) || new Map();
        return Array.from(entries.values()).map((entry) => entry.payload);
    }

    async find(entityType: EntityType, entityId: string): Promise<Record<string, unknown> | null> {
        await this.refreshTypeIfNeeded(entityType);
        const normalized = entityId.trim().toLowerCase();
        const entries = this.byType.get(entityType) || new Map();
        for (const entry of entries.values()) {
            const idLower = entry.id.toLowerCase();
            const slugLower = (entry.slug || '').toLowerCase();
            if (idLower === normalized || slugLower === normalized) {
                return entry.payload;
            }
            if (normalized && (idLower.startsWith(normalized) || normalized.startsWith(idLower))) {
                return entry.payload;
            }
        }
        return null;
    }

    private async refreshTypeIfNeeded(entityType: EntityType): Promise<void> {
        if (!this.sidecarLoaded) {
            await this.loadSidecar();
        }
        const now = Date.now();
        const needsRefresh = this.dirtyTypes.has(entityType)
            || (this.byType.get(entityType)?.size || 0) === 0
            || now - (this.lastRefreshAtByType.get(entityType) || 0) > REFRESH_TTL_MS;
        if (!needsRefresh) {
            return;
        }
        await this.refreshTypeOnce(entityType);
    }

    private async refreshTypeOnce(entityType: EntityType): Promise<void> {
        const existing = this.refreshInFlightByType.get(entityType);
        if (existing) {
            await existing;
            return;
        }
        const refreshPromise = this.refreshType(entityType).finally(() => {
            this.refreshInFlightByType.delete(entityType);
        });
        this.refreshInFlightByType.set(entityType, refreshPromise);
        await refreshPromise;
    }

    private async refreshType(entityType: EntityType): Promise<void> {
        const startedAt = Date.now();
        const directory = join(this.contextRoot, ENTITY_DIRECTORY[entityType]);
        const listed = (await collectFilesRecursive(directory))
            .map((metadata) => ({ ...metadata, path: normalizePath(metadata.path) }))
            .filter((metadata) => isYamlPath(metadata.path));
        const byPath = new Map(listed.map((metadata) => [metadata.path, metadata]));
        const existing = this.byType.get(entityType) || new Map<string, IndexedEntityEntry>();
        let changedCount = 0;
        let cacheHitCount = 0;
        let removedCount = 0;
        let hydrateSuccess = 0;
        let hydrateFailed = 0;

        for (const [pathValue] of existing.entries()) {
            if (!byPath.has(pathValue)) {
                existing.delete(pathValue);
                removedCount++;
            }
        }

        for (const metadata of listed) {
            const cached = existing.get(metadata.path);
            const sameVersion = cached ? entryVersionKey(cached) === metadataVersionKey(metadata) : false;
            if (sameVersion && !this.dirtyTypes.has(entityType)) {
                cacheHitCount++;
                continue;
            }

            changedCount++;
            try {
                const raw = await readFile(metadata.path, 'utf8');
                const parsed = yaml.load(raw);
                if (!parsed || typeof parsed !== 'object') {
                    hydrateFailed++;
                    continue;
                }
                const payload = parsed as Record<string, unknown>;
                const id = typeof payload.id === 'string' ? payload.id : '';
                const name = typeof payload.name === 'string' ? payload.name : '';
                if (!id || !name) {
                    hydrateFailed++;
                    continue;
                }
                const slug = typeof payload.slug === 'string' ? payload.slug : undefined;
                existing.set(metadata.path, {
                    entityType,
                    path: metadata.path,
                    id,
                    name,
                    slug,
                    payload,
                    sourceUpdatedAt: metadata.updatedAt || null,
                    sourceSize: Number(metadata.size || 0),
                    hydratedAt: new Date().toISOString(),
                });
                hydrateSuccess++;
            } catch (error) {
                hydrateFailed++;
                logger.warning('entities.index.hydrate.failed', {
                    entityType,
                    path: metadata.path,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        this.byType.set(entityType, existing);
        this.lastRefreshAtByType.set(entityType, Date.now());
        this.dirtyTypes.delete(entityType);
        this.schedulePersist();

        logger.info('entities.index.refresh.complete', {
            entityType,
            listed: listed.length,
            yamlCandidates: listed.length,
            cacheHitCount,
            changedCount,
            removedCount,
            hydrateSuccess,
            hydrateFailed,
            indexedEntries: existing.size,
            elapsedMs: Date.now() - startedAt,
        });
    }

    private async loadSidecar(): Promise<void> {
        this.sidecarLoaded = true;
        const sidecarPath = join(this.contextRoot, INDEX_PATH);
        try {
            const raw = await readFile(sidecarPath, 'utf8');
            const parsed = JSON.parse(raw) as Partial<PersistedEntityIndex>;
            if (parsed.version !== INDEX_SCHEMA_VERSION || !parsed.byType || typeof parsed.byType !== 'object') {
                logger.warning('entities.index.sidecar.invalid_schema', {
                    indexPath: sidecarPath,
                    version: parsed.version ?? null,
                });
                return;
            }
            const projectEntries = parsed.byType.project;
            if (projectEntries && typeof projectEntries === 'object') {
                const map = this.byType.get('project') || new Map<string, IndexedEntityEntry>();
                for (const [pathValue, entry] of Object.entries(projectEntries)) {
                    if (!entry || typeof entry !== 'object') continue;
                    map.set(pathValue, {
                        ...entry,
                        entityType: 'project',
                        path: normalizePath(entry.path || pathValue),
                        id: String(entry.id || ''),
                        name: String(entry.name || ''),
                        payload: (entry.payload || {}) as Record<string, unknown>,
                        sourceUpdatedAt: entry.sourceUpdatedAt || null,
                        sourceSize: Number(entry.sourceSize || 0),
                        hydratedAt: entry.hydratedAt || new Date(0).toISOString(),
                    });
                }
                this.byType.set('project', map);
            }
            logger.info('entities.index.sidecar.loaded', {
                indexPath: sidecarPath,
                project: this.byType.get('project')?.size || 0,
            });
        } catch {
            // No sidecar yet.
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
                const payload: PersistedEntityIndex = {
                    version: INDEX_SCHEMA_VERSION,
                    builtAt: new Date().toISOString(),
                    byType: {
                        project: Object.fromEntries(this.byType.get('project')?.entries() || []),
                    },
                };
                const sidecarPath = join(this.contextRoot, INDEX_PATH);
                try {
                    await mkdir(join(this.contextRoot, '.riotplan'), { recursive: true });
                    await writeFile(sidecarPath, JSON.stringify(payload), 'utf8');
                } catch (error) {
                    logger.warning('entities.index.sidecar.save_failed', {
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

const servicesByRoot = new Map<string, ContextEntityIndexService>();

function getOrCreateService(contextRoot: string): ContextEntityIndexService {
    const key = normalizePath(contextRoot);
    const existing = servicesByRoot.get(key);
    if (existing) return existing;
    const created = new ContextEntityIndexService(contextRoot);
    servicesByRoot.set(key, created);
    return created;
}

export async function listContextEntitiesFromIndex(contextRoot: string, entityType: EntityType): Promise<Array<Record<string, unknown>>> {
    return getOrCreateService(contextRoot).list(entityType);
}

export async function findContextEntityFromIndex(
    contextRoot: string,
    entityType: EntityType,
    entityId: string
): Promise<Record<string, unknown> | null> {
    return getOrCreateService(contextRoot).find(entityType, entityId);
}

export function markContextEntityIndexDirty(contextRoot: string, entityType?: EntityType): void {
    getOrCreateService(contextRoot).markDirty(entityType);
}

