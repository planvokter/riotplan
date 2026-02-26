import { mkdir, readdir, rm } from 'node:fs/promises';
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

type StorageFile = {
    name: string;
    download: (options: { destination: string }) => Promise<void>;
    delete: (options?: { ignoreNotFound?: boolean }) => Promise<void>;
};

type BucketLike = {
    getFiles: (options?: { prefix?: string }) => Promise<[StorageFile[]]>;
    upload: (path: string, options: { destination: string }) => Promise<unknown>;
};

type StorageLike = {
    bucket: (name: string) => BucketLike;
};

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

    constructor(options: {
        auth: GcsAuthConfig;
        location: GcsBucketLocation;
        localDirectory: string;
        includeFile?: (relativePath: string) => boolean;
    }) {
        this.auth = options.auth;
        this.bucketName = options.location.bucket;
        this.prefix = normalizePrefix(options.location.prefix);
        this.localDirectory = resolve(options.localDirectory);
        this.includeFile = options.includeFile || (() => true);
    }

    async syncDown(): Promise<void> {
        await mkdir(this.localDirectory, { recursive: true });
        const storage = await createStorageClient(this.auth);
        const bucket = storage.bucket(this.bucketName);
        const [files] = await bucket.getFiles({ prefix: this.prefix || undefined });

        const remoteSet = new Set<string>();
        for (const file of files) {
            const objectName = file.name;
            if (objectName.endsWith('/')) {
                continue;
            }
            const relativePath = toRelativePath(this.prefix, objectName);
            if (!relativePath || !this.includeFile(relativePath)) {
                continue;
            }
            remoteSet.add(relativePath);
            const localPath = join(this.localDirectory, relativePath);
            await mkdir(dirname(localPath), { recursive: true });
            await file.download({ destination: localPath });
        }

        const localFiles = await collectLocalFiles(this.localDirectory);
        for (const localRelative of localFiles) {
            if (!this.includeFile(localRelative)) {
                continue;
            }
            if (!remoteSet.has(localRelative)) {
                await rm(join(this.localDirectory, localRelative), { force: true });
            }
        }
    }

    async syncUp(): Promise<void> {
        await mkdir(this.localDirectory, { recursive: true });
        const storage = await createStorageClient(this.auth);
        const bucket = storage.bucket(this.bucketName);
        const localFiles = await collectLocalFiles(this.localDirectory);
        const localSet = new Set<string>();

        for (const localRelative of localFiles) {
            if (!this.includeFile(localRelative)) {
                continue;
            }
            localSet.add(localRelative);
            const objectName = toObjectName(this.prefix, localRelative);
            await bucket.upload(join(this.localDirectory, localRelative), {
                destination: objectName,
            });
        }

        const [remoteFiles] = await bucket.getFiles({ prefix: this.prefix || undefined });
        for (const remote of remoteFiles) {
            if (remote.name.endsWith('/')) {
                continue;
            }
            const relativePath = toRelativePath(this.prefix, remote.name);
            if (!relativePath || !this.includeFile(relativePath)) {
                continue;
            }
            if (!localSet.has(relativePath)) {
                await remote.delete({ ignoreNotFound: true });
            }
        }
    }
}
