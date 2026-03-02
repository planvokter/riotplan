import { createHash } from 'node:crypto';
import { readFile, mkdir, readdir, rm, stat, writeFile, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface GcsAuthConfig {
    projectId?: string;
    keyFilename?: string;
    credentialsJson?: string;
}

export interface GcsBucketLocation {
    bucket: string;
    prefix?: string;
}

export interface GcsSyncDownStats {
    bucket: string;
    prefix: string;
    localDirectory: string;
    remoteListedCount: number;
    remoteIncludedCount: number;
    changedCount: number;
    skippedUnchangedCount: number;
    downloadedCount: number;
    downloadedBytes: number;
    localScannedCount: number;
    removedCount: number;
    elapsedMs: number;
    phases: {
        mkdirMs: number;
        createClientMs: number;
        listRemoteMs: number;
        downloadMs: number;
        listLocalMs: number;
        cleanupMs: number;
    };
}

export interface GcsSyncUpStats {
    bucket: string;
    prefix: string;
    localDirectory: string;
    localScannedCount: number;
    localIncludedCount: number;
    uploadedCount: number;
    remoteListedCount: number;
    removedRemoteCount: number;
    elapsedMs: number;
    phases: {
        mkdirMs: number;
        createClientMs: number;
        listLocalMs: number;
        uploadMs: number;
        listRemoteMs: number;
        cleanupMs: number;
    };
}

type MirrorDebugEvent = (
    event: string,
    details: Record<string, unknown>
) => void;

type StorageFile = {
    name: string;
    download: (options: { destination: string }) => Promise<void>;
    save?: (data: string | Buffer, options?: Record<string, unknown>) => Promise<void>;
    delete: (options?: { ignoreNotFound?: boolean }) => Promise<void>;
    getMetadata?: () => Promise<Array<Record<string, unknown>>>;
    metadata?: {
        md5Hash?: string;
        generation?: string;
        etag?: string;
        size?: number | string;
        updated?: string;
    };
};

export interface SyncManifestObject {
    path: string;
    generation?: string;
    etag?: string;
    md5Hash?: string;
    size?: number;
    updatedAt?: string;
    localPath: string;
    lastSyncedAt: string;
}

export interface SyncManifest {
    version: number;
    createdAt: string;
    updatedAt: string;
    objects: Record<string, SyncManifestObject>;
}

const SYNC_MANIFEST_VERSION = 1;
const SYNC_MANIFEST_FILE = '.riotplan-sync-manifest.json';
const REMOTE_INDEX_SCHEMA_VERSION = 1;
const REMOTE_INDEX_FILE = '.riotplan-sync-index-v1.json';
const REMOTE_INDEX_CACHE_FILE = '.riotplan-remote-index-cache-v1.json';
const REMOTE_INDEX_DOWNLOAD_TMP = '.riotplan-remote-index-download.tmp.json';

export interface RemoteObjectState {
    path: string;
    generation?: string;
    etag?: string;
    md5Hash?: string;
    size?: number;
    updatedAt?: string;
}

export function buildSyncDiff(
    remoteObjects: Record<string, RemoteObjectState>,
    manifestObjects: Record<string, SyncManifestObject> | undefined,
    localFiles: Set<string>
): {
    added: string[];
    changed: string[];
    unchanged: string[];
    deletedLocal: string[];
} {
    const added: string[] = [];
    const changed: string[] = [];
    const unchanged: string[] = [];
    const remotePaths = new Set(Object.keys(remoteObjects));

    for (const relativePath of remotePaths) {
        const remote = remoteObjects[relativePath];
        const localExists = localFiles.has(relativePath);
        const manifest = manifestObjects?.[relativePath];

        if (!localExists) {
            added.push(relativePath);
            continue;
        }
        if (!manifest) {
            changed.push(relativePath);
            continue;
        }

        const byGeneration =
            manifest.generation &&
            remote.generation &&
            manifest.generation === remote.generation;
        const byEtag = manifest.etag && remote.etag && manifest.etag === remote.etag;
        const byMd5 = manifest.md5Hash && remote.md5Hash && manifest.md5Hash === remote.md5Hash;

        if (byGeneration || byEtag || byMd5) {
            unchanged.push(relativePath);
        } else {
            changed.push(relativePath);
        }
    }

    const deletedLocal: string[] = [];
    for (const localRelative of localFiles) {
        if (!remotePaths.has(localRelative)) {
            deletedLocal.push(localRelative);
        }
    }

    return { added, changed, unchanged, deletedLocal };
}

type BucketLike = {
    getFiles: (options?: { prefix?: string }) => Promise<[StorageFile[]]>;
    upload: (path: string, options: { destination: string }) => Promise<unknown>;
    file: (name: string) => StorageFile;
};

type StorageLike = {
    bucket: (name: string) => BucketLike;
};

function isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = (error as any).code;
    const message = String((error as any).message || '').toLowerCase();
    if (typeof code === 'number' && [408, 429, 500, 502, 503, 504].includes(code)) return true;
    if (typeof code === 'string' && ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(code)) return true;
    return message.includes('timeout') || message.includes('temporar') || message.includes('rate');
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= retries) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt >= retries || !isRetryableError(error)) {
                throw error;
            }
            const backoffMs = 100 * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
        attempt += 1;
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function normalizePrefix(prefix?: string): string {
    if (!prefix) {
        return '';
    }
    return prefix.replace(/^\/+/, '').replace(/\/+$/, '');
}

function toObjectName(prefix: string, relativePath: string): string {
    const normalizedRelative = relativePath.split('\\').join('/');
    return prefix ? `${prefix}/${normalizedRelative}` : normalizedRelative;
}

function toRelativePath(prefix: string, objectName: string): string {
    if (!prefix) {
        return objectName;
    }
    if (objectName.startsWith(`${prefix}/`)) {
        return objectName.slice(prefix.length + 1);
    }
    return objectName;
}

function isInternalSyncControlFile(relativePath: string): boolean {
    const normalized = relativePath.split('\\').join('/');
    const base = normalized.split('/').pop() || normalized;
    return (
        base === SYNC_MANIFEST_FILE
        || base === REMOTE_INDEX_FILE
        || base === REMOTE_INDEX_CACHE_FILE
        || base === REMOTE_INDEX_DOWNLOAD_TMP
    );
}

interface RemoteSyncIndex {
    version: number;
    generatedAt: string;
    objects: Record<string, RemoteObjectState>;
}

interface RemoteSyncIndexCache {
    version: number;
    indexObject: string;
    etag?: string;
    generation?: string;
    updatedAt?: string;
    objects: Record<string, RemoteObjectState>;
}

async function loadRemoteSyncIndexCache(localDirectory: string): Promise<RemoteSyncIndexCache | null> {
    const cachePath = join(localDirectory, REMOTE_INDEX_CACHE_FILE);
    try {
        const raw = await readFile(cachePath, 'utf8');
        const parsed = JSON.parse(raw) as RemoteSyncIndexCache;
        if (
            !parsed
            || typeof parsed !== 'object'
            || parsed.version !== REMOTE_INDEX_SCHEMA_VERSION
            || typeof parsed.indexObject !== 'string'
            || !parsed.objects
            || typeof parsed.objects !== 'object'
        ) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

async function saveRemoteSyncIndexCache(localDirectory: string, cache: RemoteSyncIndexCache): Promise<void> {
    const path = join(localDirectory, REMOTE_INDEX_CACHE_FILE);
    const tempPath = `${path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
    await rename(tempPath, path);
}

function metadataStringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function metadataNumberValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}

function parseRemoteMetadata(metadata: Record<string, unknown> | undefined): {
    md5Hash?: string;
    generation?: string;
    etag?: string;
    size?: number;
    updatedAt?: string;
} {
    return {
        md5Hash: metadataStringValue(metadata?.md5Hash),
        generation: metadataStringValue(metadata?.generation),
        etag: metadataStringValue(metadata?.etag),
        size: metadataNumberValue(metadata?.size),
        updatedAt: metadataStringValue(metadata?.updated),
    };
}

function normalizeRemoteIndexObjects(objects: unknown): Record<string, RemoteObjectState> {
    if (!objects || typeof objects !== 'object') {
        return {};
    }
    const normalized: Record<string, RemoteObjectState> = {};
    for (const [rawPath, rawState] of Object.entries(objects as Record<string, unknown>)) {
        const path = typeof rawPath === 'string' ? rawPath : '';
        if (!path || isInternalSyncControlFile(path)) {
            continue;
        }
        const state = rawState as Record<string, unknown>;
        normalized[path] = {
            path,
            generation: metadataStringValue(state?.generation),
            etag: metadataStringValue(state?.etag),
            md5Hash: metadataStringValue(state?.md5Hash),
            size: metadataNumberValue(state?.size),
            updatedAt: metadataStringValue(state?.updatedAt),
        };
    }
    return normalized;
}

async function collectLocalFiles(rootDir: string): Promise<string[]> {
    const entries = await readdir(rootDir, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(rootDir, entry.name);
        if (entry.isDirectory()) {
            const nested = await collectLocalFiles(fullPath);
            for (const child of nested) {
                files.push(join(entry.name, child));
            }
            continue;
        }
        files.push(entry.name);
    }
    return files;
}

async function fileMd5Base64(path: string): Promise<string> {
    const buffer = await readFile(path);
    return createHash('md5').update(buffer).digest('base64');
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

async function resolveRemoteMd5(file: StorageFile): Promise<string | undefined> {
    if (file.metadata?.md5Hash) {
        return file.metadata.md5Hash;
    }
    if (typeof file.getMetadata === 'function') {
        try {
            const [metadata] = await file.getMetadata();
            const md5Hash = typeof metadata?.md5Hash === 'string' ? metadata.md5Hash : undefined;
            if (md5Hash) {
                file.metadata = { ...(file.metadata || {}), md5Hash };
            }
            return md5Hash;
        } catch {
            return undefined;
        }
    }
    return undefined;
}

async function resolveRemoteMetadata(file: StorageFile): Promise<{
    md5Hash?: string;
    generation?: string;
    etag?: string;
    size?: number;
    updatedAt?: string;
}> {
    const fromInline = parseRemoteMetadata(file.metadata as Record<string, unknown> | undefined);
    if (fromInline.md5Hash || fromInline.generation || fromInline.etag || fromInline.size !== undefined || fromInline.updatedAt) {
        return fromInline;
    }
    if (typeof file.getMetadata !== 'function') {
        return fromInline;
    }
    try {
        const [metadata] = await file.getMetadata();
        const parsed = parseRemoteMetadata(metadata);
        const md5Hash = parsed.md5Hash || file.metadata?.md5Hash;
        const generation = parsed.generation;
        const etag = parsed.etag;
        const size = parsed.size;
        const updatedAt = parsed.updatedAt;
        if (md5Hash) {
            file.metadata = { ...(file.metadata || {}), md5Hash };
        }
        return { md5Hash, generation, etag, size, updatedAt };
    } catch {
        return {
            md5Hash: file.metadata?.md5Hash,
        };
    }
}

async function loadRemoteSyncIndex(
    bucket: BucketLike,
    prefix: string,
    localDirectory: string,
    onDebugEvent?: MirrorDebugEvent
): Promise<{
    objects: Record<string, RemoteObjectState> | null;
    indexEtag?: string;
    indexGeneration?: string;
    usedCachedIndex: boolean;
}> {
    const indexObject = toObjectName(prefix, REMOTE_INDEX_FILE);
    const remoteIndexFile = bucket.file(indexObject);
    if (!remoteIndexFile || typeof remoteIndexFile.getMetadata !== 'function') {
        return { objects: null, usedCachedIndex: false };
    }

    let metadata: Record<string, unknown> | undefined;
    try {
        const [resolved] = await withRetry(() => remoteIndexFile.getMetadata!());
        metadata = resolved;
    } catch (error: any) {
        if (error?.code === 404) {
            return { objects: null, usedCachedIndex: false };
        }
        onDebugEvent?.('sync_down.index.metadata_failed', {
            indexObject,
            error: error instanceof Error ? error.message : String(error),
        });
        return { objects: null, usedCachedIndex: false };
    }

    const indexEtag = metadataStringValue(metadata?.etag);
    const indexGeneration = metadataStringValue(metadata?.generation);
    const cache = await loadRemoteSyncIndexCache(localDirectory);
    if (
        cache
        && cache.indexObject === indexObject
        && (
            (indexEtag && cache.etag === indexEtag)
            || (indexGeneration && cache.generation === indexGeneration)
        )
    ) {
        onDebugEvent?.('sync_down.index.cache_hit', {
            indexObject,
            objectCount: Object.keys(cache.objects || {}).length,
        });
        return {
            objects: normalizeRemoteIndexObjects(cache.objects),
            indexEtag,
            indexGeneration,
            usedCachedIndex: true,
        };
    }

    const downloadPath = join(localDirectory, REMOTE_INDEX_DOWNLOAD_TMP);
    try {
        await withRetry(() => remoteIndexFile.download({ destination: downloadPath }));
        const raw = await readFile(downloadPath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<RemoteSyncIndex>;
        if (parsed.version !== REMOTE_INDEX_SCHEMA_VERSION || !parsed.objects || typeof parsed.objects !== 'object') {
            onDebugEvent?.('sync_down.index.invalid_schema', {
                indexObject,
                version: parsed.version ?? null,
            });
            return { objects: null, indexEtag, indexGeneration, usedCachedIndex: false };
        }
        const normalizedObjects = normalizeRemoteIndexObjects(parsed.objects);
        await saveRemoteSyncIndexCache(localDirectory, {
            version: REMOTE_INDEX_SCHEMA_VERSION,
            indexObject,
            etag: indexEtag,
            generation: indexGeneration,
            updatedAt: metadataStringValue(metadata?.updated),
            objects: normalizedObjects,
        });
        onDebugEvent?.('sync_down.index.downloaded', {
            indexObject,
            objectCount: Object.keys(normalizedObjects).length,
        });
        return {
            objects: normalizedObjects,
            indexEtag,
            indexGeneration,
            usedCachedIndex: false,
        };
    } catch (error) {
        onDebugEvent?.('sync_down.index.download_failed', {
            indexObject,
            error: error instanceof Error ? error.message : String(error),
        });
        return { objects: null, indexEtag, indexGeneration, usedCachedIndex: false };
    } finally {
        await rm(downloadPath, { force: true }).catch(() => undefined);
    }
}

async function writeRemoteSyncIndex(
    bucket: BucketLike,
    prefix: string,
    localDirectory: string,
    objects: Record<string, RemoteObjectState>,
    onDebugEvent?: MirrorDebugEvent
): Promise<void> {
    const indexObject = toObjectName(prefix, REMOTE_INDEX_FILE);
    const tempPath = join(localDirectory, `${REMOTE_INDEX_FILE}.tmp`);
    const payload: RemoteSyncIndex = {
        version: REMOTE_INDEX_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        objects,
    };
    try {
        await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        await withRetry(() => bucket.upload(tempPath, { destination: indexObject }));
        onDebugEvent?.('sync_up.index.written', {
            indexObject,
            objectCount: Object.keys(objects).length,
        });
    } finally {
        await rm(tempPath, { force: true }).catch(() => undefined);
    }
}

export async function loadSyncManifest(localDirectory: string): Promise<{
    manifest: SyncManifest | null;
    invalidated: boolean;
}> {
    const manifestPath = join(localDirectory, SYNC_MANIFEST_FILE);
    try {
        const raw = await readFile(manifestPath, 'utf8');
        const parsed = JSON.parse(raw) as SyncManifest;
        if (!parsed || typeof parsed !== 'object' || parsed.version !== SYNC_MANIFEST_VERSION || !parsed.objects) {
            return { manifest: null, invalidated: true };
        }
        return { manifest: parsed, invalidated: false };
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            return { manifest: null, invalidated: false };
        }
        return { manifest: null, invalidated: true };
    }
}

export async function writeSyncManifest(localDirectory: string, objects: Record<string, SyncManifestObject>): Promise<void> {
    const manifestPath = join(localDirectory, SYNC_MANIFEST_FILE);
    const tempManifestPath = `${manifestPath}.tmp`;
    const now = new Date().toISOString();
    const payload: SyncManifest = {
        version: SYNC_MANIFEST_VERSION,
        createdAt: now,
        updatedAt: now,
        objects,
    };
    await writeFile(tempManifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await rename(tempManifestPath, manifestPath);
}

async function createStorageClient(auth: GcsAuthConfig): Promise<StorageLike> {
    let credentials: Record<string, unknown> | undefined;
    if (auth.credentialsJson) {
        try {
            credentials = JSON.parse(auth.credentialsJson) as Record<string, unknown>;
        } catch (error) {
            throw new Error(`Invalid cloud.credentialsJson JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Dynamic import avoids pulling GCS SDK into browser-oriented bundle passes.
    const moduleName = '@google-cloud/storage';
    const storageModule = (await import(moduleName)) as {
        Storage: new (options: Record<string, unknown>) => StorageLike;
    };

    return new storageModule.Storage({
        projectId: auth.projectId,
        keyFilename: auth.keyFilename,
        credentials: credentials as any,
    });
}

export class GcsMirror {
    private readonly auth: GcsAuthConfig;
    private readonly bucketName: string;
    private readonly prefix: string;
    private readonly localDirectory: string;
    private readonly includeFile: (relativePath: string) => boolean;
    private readonly incrementalSyncEnabled: boolean;
    private readonly onDebugEvent?: MirrorDebugEvent;

    constructor(options: {
        auth: GcsAuthConfig;
        location: GcsBucketLocation;
        localDirectory: string;
        includeFile?: (relativePath: string) => boolean;
        incrementalSyncEnabled?: boolean;
        onDebugEvent?: MirrorDebugEvent;
    }) {
        this.auth = options.auth;
        this.bucketName = options.location.bucket;
        this.prefix = normalizePrefix(options.location.prefix);
        this.localDirectory = resolve(options.localDirectory);
        this.includeFile = options.includeFile || (() => true);
        this.incrementalSyncEnabled = options.incrementalSyncEnabled !== false;
        this.onDebugEvent = options.onDebugEvent;
    }

    async syncDown(): Promise<GcsSyncDownStats> {
        const startedAt = Date.now();
        this.onDebugEvent?.('sync_down.start', {
            bucket: this.bucketName,
            prefix: this.prefix,
            localDirectory: this.localDirectory,
        });
        const mkdirStartedAt = Date.now();
        await mkdir(this.localDirectory, { recursive: true });
        const mkdirMs = Date.now() - mkdirStartedAt;
        this.onDebugEvent?.('sync_down.phase.mkdir', { elapsedMs: mkdirMs });

        const clientStartedAt = Date.now();
        const storage = await createStorageClient(this.auth);
        const createClientMs = Date.now() - clientStartedAt;
        this.onDebugEvent?.('sync_down.phase.create_client', { elapsedMs: createClientMs });
        const bucket = storage.bucket(this.bucketName);

        const listRemoteStartedAt = Date.now();
        const remoteIndex = await loadRemoteSyncIndex(bucket, this.prefix, this.localDirectory, this.onDebugEvent);
        let files: StorageFile[] = [];
        let usedRemoteIndex = false;
        if (remoteIndex.objects) {
            usedRemoteIndex = true;
        } else {
            [files] = await withRetry(() => bucket.getFiles({ prefix: this.prefix || undefined }));
        }
        const listRemoteMs = Date.now() - listRemoteStartedAt;
        this.onDebugEvent?.('sync_down.phase.list_remote', {
            elapsedMs: listRemoteMs,
            listedCount: usedRemoteIndex ? Object.keys(remoteIndex.objects || {}).length : files.length,
            source: usedRemoteIndex ? 'gcs-index' : 'bucket-list',
            usedCachedIndex: remoteIndex.usedCachedIndex,
        });

        const { manifest, invalidated } = this.incrementalSyncEnabled
            ? await loadSyncManifest(this.localDirectory)
            : { manifest: null, invalidated: false };
        if (invalidated) {
            this.onDebugEvent?.('sync_down.manifest.invalidated', {
                localDirectory: this.localDirectory,
                reason: 'unsupported_or_corrupt_manifest',
            });
        }

        const localFilesAtStart = await collectLocalFiles(this.localDirectory);
        const localTrackedAtStart = new Set(
            localFilesAtStart.filter((relativePath) => this.includeFile(relativePath))
        );
        const remoteStateByPath: Record<string, RemoteObjectState> = {};
        const remoteFileByPath = new Map<string, StorageFile>();
        if (usedRemoteIndex && remoteIndex.objects) {
            for (const [relativePath, objectState] of Object.entries(remoteIndex.objects)) {
                if (!relativePath || isInternalSyncControlFile(relativePath) || !this.includeFile(relativePath)) {
                    continue;
                }
                remoteStateByPath[relativePath] = objectState;
                remoteFileByPath.set(relativePath, bucket.file(toObjectName(this.prefix, relativePath)));
            }
        } else {
            for (const file of files) {
                const objectName = file.name;
                if (objectName.endsWith('/')) {
                    continue;
                }
                const relativePath = toRelativePath(this.prefix, objectName);
                if (!relativePath || isInternalSyncControlFile(relativePath) || !this.includeFile(relativePath)) {
                    continue;
                }
                remoteFileByPath.set(relativePath, file);
                const remoteMeta = await resolveRemoteMetadata(file);
                remoteStateByPath[relativePath] = {
                    path: relativePath,
                    generation: remoteMeta.generation,
                    etag: remoteMeta.etag,
                    md5Hash: remoteMeta.md5Hash,
                    size: remoteMeta.size,
                    updatedAt: remoteMeta.updatedAt,
                };
            }
        }

        const remoteSet = new Set(Object.keys(remoteStateByPath));
        const remoteIncludedCount = remoteSet.size;
        let diff: ReturnType<typeof buildSyncDiff>;
        if (!this.incrementalSyncEnabled) {
            diff = {
                added: [...remoteSet],
                changed: [],
                unchanged: [],
                deletedLocal: [...localTrackedAtStart].filter((path) => !remoteSet.has(path)),
            };
        } else {
            try {
                diff = buildSyncDiff(remoteStateByPath, manifest?.objects, localTrackedAtStart);
            } catch (error) {
                this.onDebugEvent?.('sync_down.diff_recovery', {
                    reason: error instanceof Error ? error.message : String(error),
                    strategy: 'full_resync',
                });
                diff = {
                    added: [],
                    changed: [...remoteSet],
                    unchanged: [],
                    deletedLocal: [...localTrackedAtStart].filter((path) => !remoteSet.has(path)),
                };
            }
        }
        let changedCount = diff.added.length + diff.changed.length;
        let skippedUnchangedCount = diff.unchanged.length;
        let downloadedCount = 0;
        let downloadedBytes = 0;
        const manifestObjects: Record<string, SyncManifestObject> = {};
        const downloadStartedAt = Date.now();
        const downloadTargets = [...diff.added, ...diff.changed];
        for (const relativePath of downloadTargets) {
            const file = remoteFileByPath.get(relativePath);
            if (!file) {
                continue;
            }
            const localPath = join(this.localDirectory, relativePath);
            let shouldDownload = true;
            const remoteMeta = remoteStateByPath[relativePath];
            const existingManifestEntry = manifest?.objects?.[relativePath];
            const existsLocally = await fileExists(localPath);
            if (this.incrementalSyncEnabled && existsLocally && existingManifestEntry) {
                const unchangedByManifest =
                    existingManifestEntry.generation &&
                    remoteMeta?.generation &&
                    existingManifestEntry.generation === remoteMeta.generation;
                if (unchangedByManifest) {
                    shouldDownload = false;
                }
            }
            if (this.incrementalSyncEnabled && existsLocally && shouldDownload) {
                const remoteMd5 = remoteMeta?.md5Hash || (await resolveRemoteMd5(file));
                if (remoteMd5) {
                    const localMd5 = await fileMd5Base64(localPath);
                    shouldDownload = localMd5 !== remoteMd5;
                }
            }
            if (!shouldDownload) {
                skippedUnchangedCount += 1;
                changedCount -= 1;
                continue;
            }
            await mkdir(dirname(localPath), { recursive: true });
            const downloadFileStartedAt = Date.now();
            await withRetry(() => file.download({ destination: localPath }));
            const fileElapsedMs = Date.now() - downloadFileStartedAt;
            downloadedCount += 1;
            try {
                downloadedBytes += (await stat(localPath)).size;
            } catch {
                // best-effort metric, ignore stat failures
            }
            if (fileElapsedMs >= 250) {
                this.onDebugEvent?.('sync_down.file_download', {
                    path: relativePath,
                    elapsedMs: fileElapsedMs,
                });
            }
            manifestObjects[relativePath] = {
                path: relativePath,
                generation: remoteMeta?.generation,
                etag: remoteMeta?.etag,
                md5Hash: remoteMeta?.md5Hash,
                size: remoteMeta?.size,
                updatedAt: remoteMeta?.updatedAt,
                localPath: relativePath,
                lastSyncedAt: new Date().toISOString(),
            };
        }
        for (const relativePath of remoteSet) {
            if (!manifestObjects[relativePath] && manifest?.objects?.[relativePath]) {
                manifestObjects[relativePath] = {
                    ...manifest.objects[relativePath],
                    lastSyncedAt: new Date().toISOString(),
                };
            }
        }
        const downloadMs = Date.now() - downloadStartedAt;
        this.onDebugEvent?.('sync_down.phase.download', {
            elapsedMs: downloadMs,
            downloadedCount,
            includedCount: remoteIncludedCount,
            changedCount,
            skippedUnchangedCount,
            downloadedBytes,
        });

        const listLocalStartedAt = Date.now();
        const localFiles = await collectLocalFiles(this.localDirectory);
        const listLocalMs = Date.now() - listLocalStartedAt;
        this.onDebugEvent?.('sync_down.phase.list_local', { elapsedMs: listLocalMs, scannedCount: localFiles.length });

        const cleanupStartedAt = Date.now();
        let removedCount = 0;
        this.onDebugEvent?.('sync_down.gc.start', {
            localDirectory: this.localDirectory,
            deletedLocalCandidates: diff.deletedLocal.length,
        });
        for (const localRelative of diff.deletedLocal) {
            if (!remoteSet.has(localRelative)) {
                await rm(join(this.localDirectory, localRelative), { force: true });
                removedCount += 1;
                this.onDebugEvent?.('sync_down.gc.remove_local', {
                    path: localRelative,
                });
            }
        }
        const cleanupMs = Date.now() - cleanupStartedAt;
        this.onDebugEvent?.('sync_down.gc.complete', {
            removedCount,
            elapsedMs: cleanupMs,
        });
        if (this.incrementalSyncEnabled) {
            const manifestWriteStartedAt = Date.now();
            await writeSyncManifest(this.localDirectory, manifestObjects);
            this.onDebugEvent?.('sync_down.manifest.write_complete', {
                objectCount: Object.keys(manifestObjects).length,
                elapsedMs: Date.now() - manifestWriteStartedAt,
            });
        }
        const elapsedMs = Date.now() - startedAt;
        const stats: GcsSyncDownStats = {
            bucket: this.bucketName,
            prefix: this.prefix,
            localDirectory: this.localDirectory,
            remoteListedCount: usedRemoteIndex ? remoteIncludedCount : files.length,
            remoteIncludedCount,
            changedCount,
            skippedUnchangedCount,
            downloadedCount,
            downloadedBytes,
            localScannedCount: localFiles.length,
            removedCount,
            elapsedMs,
            phases: {
                mkdirMs,
                createClientMs,
                listRemoteMs,
                downloadMs,
                listLocalMs,
                cleanupMs,
            },
        };
        this.onDebugEvent?.('sync_down.complete', stats as unknown as Record<string, unknown>);
        return stats;
    }

    async syncUp(): Promise<GcsSyncUpStats> {
        const startedAt = Date.now();
        this.onDebugEvent?.('sync_up.start', {
            bucket: this.bucketName,
            prefix: this.prefix,
            localDirectory: this.localDirectory,
        });
        const mkdirStartedAt = Date.now();
        await mkdir(this.localDirectory, { recursive: true });
        const mkdirMs = Date.now() - mkdirStartedAt;
        const clientStartedAt = Date.now();
        const storage = await createStorageClient(this.auth);
        const createClientMs = Date.now() - clientStartedAt;
        const bucket = storage.bucket(this.bucketName);
        const listRemoteStartedAt = Date.now();
        const [remoteFiles] = await withRetry(() => bucket.getFiles({ prefix: this.prefix || undefined }));
        const listRemoteMs = Date.now() - listRemoteStartedAt;
        const remoteByRelative = new Map<string, StorageFile>();
        for (const remote of remoteFiles) {
            if (remote.name.endsWith('/')) {
                continue;
            }
            const relativePath = toRelativePath(this.prefix, remote.name);
            if (!relativePath || isInternalSyncControlFile(relativePath) || !this.includeFile(relativePath)) {
                continue;
            }
            remoteByRelative.set(relativePath, remote);
        }

        const listLocalStartedAt = Date.now();
        const localFiles = await collectLocalFiles(this.localDirectory);
        const listLocalMs = Date.now() - listLocalStartedAt;
        const localSet = new Set<string>();
        let localIncludedCount = 0;
        let uploadedCount = 0;
        const uploadStartedAt = Date.now();

        for (const localRelative of localFiles) {
            if (isInternalSyncControlFile(localRelative) || !this.includeFile(localRelative)) {
                continue;
            }
            localIncludedCount += 1;
            localSet.add(localRelative);
            const localPath = join(this.localDirectory, localRelative);
            const remoteFile = remoteByRelative.get(localRelative);
            let shouldUpload = true;
            if (remoteFile) {
                const remoteMd5 = await resolveRemoteMd5(remoteFile);
                if (remoteMd5) {
                    const localMd5 = await fileMd5Base64(localPath);
                    shouldUpload = localMd5 !== remoteMd5;
                }
            }
            if (!shouldUpload) {
                continue;
            }
            const objectName = toObjectName(this.prefix, localRelative);
            const uploadFileStartedAt = Date.now();
            await withRetry(() =>
                bucket.upload(localPath, {
                    destination: objectName,
                })
            );
            const fileElapsedMs = Date.now() - uploadFileStartedAt;
            uploadedCount += 1;
            if (fileElapsedMs >= 250) {
                this.onDebugEvent?.('sync_up.file_upload', {
                    path: localRelative,
                    elapsedMs: fileElapsedMs,
                });
            }
        }
        const uploadMs = Date.now() - uploadStartedAt;

        let removedRemoteCount = 0;
        const cleanupStartedAt = Date.now();
        this.onDebugEvent?.('sync_up.gc.start', {
            bucket: this.bucketName,
            prefix: this.prefix,
            remoteCandidates: remoteFiles.length,
        });
        for (const remote of remoteFiles) {
            if (remote.name.endsWith('/')) {
                continue;
            }
            const relativePath = toRelativePath(this.prefix, remote.name);
            if (!relativePath || isInternalSyncControlFile(relativePath) || !this.includeFile(relativePath)) {
                continue;
            }
            if (!localSet.has(relativePath)) {
                await withRetry(() => remote.delete({ ignoreNotFound: true }));
                removedRemoteCount += 1;
                this.onDebugEvent?.('sync_up.gc.remove_remote', {
                    path: relativePath,
                });
            }
        }
        const cleanupMs = Date.now() - cleanupStartedAt;
        this.onDebugEvent?.('sync_up.gc.complete', {
            removedRemoteCount,
            elapsedMs: cleanupMs,
        });

        const indexStartedAt = Date.now();
        const indexObjects: Record<string, RemoteObjectState> = {};
        for (const localRelative of localSet) {
            const localPath = join(this.localDirectory, localRelative);
            const localStats = await stat(localPath).catch(() => null);
            const md5Hash = await fileMd5Base64(localPath).catch(() => undefined);
            indexObjects[localRelative] = {
                path: localRelative,
                md5Hash,
                size: localStats?.size,
                updatedAt: localStats?.mtime ? localStats.mtime.toISOString() : undefined,
            };
        }
        await writeRemoteSyncIndex(bucket, this.prefix, this.localDirectory, indexObjects, this.onDebugEvent);
        this.onDebugEvent?.('sync_up.phase.write_index', {
            elapsedMs: Date.now() - indexStartedAt,
            objectCount: Object.keys(indexObjects).length,
        });

        const elapsedMs = Date.now() - startedAt;
        const stats: GcsSyncUpStats = {
            bucket: this.bucketName,
            prefix: this.prefix,
            localDirectory: this.localDirectory,
            localScannedCount: localFiles.length,
            localIncludedCount,
            uploadedCount,
            remoteListedCount: remoteFiles.length,
            removedRemoteCount,
            elapsedMs,
            phases: {
                mkdirMs,
                createClientMs,
                listLocalMs,
                uploadMs,
                listRemoteMs,
                cleanupMs,
            },
        };
        this.onDebugEvent?.('sync_up.complete', stats as unknown as Record<string, unknown>);
        return stats;
    }
}
