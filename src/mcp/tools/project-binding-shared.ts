import { basename, dirname, join, resolve } from 'node:path';
import { access, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import type { ToolExecutionContext } from '../types.js';
import { ensurePlanManifest, resolveDirectory } from './shared.js';

const execFileAsync = promisify(execFile);

export const ProjectRepoSchema = z.object({
    provider: z.string().optional().default('github'),
    owner: z.string().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
});

export const ProjectWorkspaceSchema = z.object({
    id: z.string().optional(),
    relativeRoot: z.string().optional().default('.'),
    pathHints: z.array(z.string()).optional().default([]),
});

export const ProjectBindingSchema = z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    repo: ProjectRepoSchema.optional(),
    workspace: ProjectWorkspaceSchema.optional(),
    relationship: z.enum(['primary', 'related']).optional().default('primary'),
});

export type ProjectBinding = z.infer<typeof ProjectBindingSchema>;

export const WorkspaceMappingSchema = z.object({
    projectId: z.string(),
    rootPath: z.string(),
    repoKey: z.string().optional(),
});

export type WorkspaceMapping = z.infer<typeof WorkspaceMappingSchema>;

type ManifestLike = {
    id?: string;
    title?: string;
    stage?: string;
    project?: ProjectBinding;
    [k: string]: unknown;
};

const SQLITE_PROJECT_BINDING_FILE = 'project-binding.json';
const SQLITE_PROJECT_BINDING_TYPE = 'other';

type RepoIdentity = {
    provider: string;
    owner: string;
    name: string;
    url?: string;
    key: string;
};

function normalizeSegment(value: string | undefined): string {
    return (value || '').trim().toLowerCase();
}

export function repoKeyFromParts(provider: string, owner: string, name: string): string {
    return `${normalizeSegment(provider)}:${normalizeSegment(owner)}/${normalizeSegment(name)}`;
}

function parseGitUrl(remoteUrl: string): RepoIdentity | null {
    const trimmed = remoteUrl.trim();
    if (!trimmed) return null;

    // git@github.com:owner/repo.git
    const sshMatch = trimmed.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
    if (sshMatch) {
        const host = sshMatch[1].toLowerCase();
        const owner = sshMatch[2];
        const name = sshMatch[3];
        const provider = host.includes('github') ? 'github' : host;
        return { provider, owner, name, url: trimmed, key: repoKeyFromParts(provider, owner, name) };
    }

    // https://github.com/owner/repo(.git)
    const httpMatch = trimmed.match(/^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/);
    if (httpMatch) {
        const host = httpMatch[1].toLowerCase();
        const owner = httpMatch[2];
        const name = httpMatch[3];
        const provider = host.includes('github') ? 'github' : host;
        return { provider, owner, name, url: trimmed, key: repoKeyFromParts(provider, owner, name) };
    }

    return null;
}

export function normalizeProjectBinding(input: ProjectBinding): ProjectBinding {
    const project: ProjectBinding = {
        ...input,
        workspace: {
            id: input.workspace?.id,
            relativeRoot: input.workspace?.relativeRoot || '.',
            pathHints: input.workspace?.pathHints || [],
        },
        relationship: input.relationship || 'primary',
    };

    if (project.repo?.url && (!project.repo.owner || !project.repo.name)) {
        const parsed = parseGitUrl(project.repo.url);
        if (parsed) {
            project.repo = {
                provider: project.repo.provider || parsed.provider,
                owner: project.repo.owner || parsed.owner,
                name: project.repo.name || parsed.name,
                url: project.repo.url || parsed.url,
            };
        }
    }

    if (!project.id && project.repo?.owner && project.repo?.name) {
        project.id = `${project.repo.owner}/${project.repo.name}`;
    }

    return project;
}

export function getProjectMatchKeys(project?: ProjectBinding | null): string[] {
    if (!project) return [];
    const keys = new Set<string>();
    if (project.id) keys.add(project.id.toLowerCase());
    if (project.repo?.owner && project.repo?.name) {
        keys.add(`${project.repo.owner}/${project.repo.name}`.toLowerCase());
        keys.add(repoKeyFromParts(project.repo.provider || 'github', project.repo.owner, project.repo.name));
    }
    if (project.repo?.url) {
        const parsed = parseGitUrl(project.repo.url);
        if (parsed) {
            keys.add(parsed.key);
            keys.add(`${parsed.owner}/${parsed.name}`.toLowerCase());
        }
    }
    return [...keys];
}

export function getWorkspaceMatchKeys(project?: ProjectBinding | null): string[] {
    if (!project) return [];
    const keys = new Set<string>();
    if (project.workspace?.id) {
        keys.add(project.workspace.id.toLowerCase());
    }
    return [...keys];
}

async function readManifestRaw(planPath: string): Promise<ManifestLike | null> {
    try {
        const yaml = await import('yaml');
        const manifestPath = join(planPath, 'plan.yaml');
        const content = await readFile(manifestPath, 'utf-8');
        const parsed = yaml.parse(content);
        return parsed && typeof parsed === 'object' ? (parsed as ManifestLike) : null;
    } catch {
        return null;
    }
}

async function writeManifestRaw(planPath: string, manifest: ManifestLike): Promise<void> {
    const yaml = await import('yaml');
    const manifestPath = join(planPath, 'plan.yaml');
    await writeFile(manifestPath, yaml.stringify(manifest), 'utf-8');
}

export async function resolvePlanPathFromId(planId: string, context: ToolExecutionContext): Promise<string> {
    return resolveDirectory({ planId }, context);
}

export async function getGitRepoIdentity(startPath: string): Promise<{ rootPath: string; repo: RepoIdentity } | null> {
    try {
        const { stdout: topLevel } = await execFileAsync('git', ['-C', startPath, 'rev-parse', '--show-toplevel']);
        const repoRoot = topLevel.trim();
        if (!repoRoot) return null;

        let remoteUrl = '';
        try {
            const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'remote', 'get-url', 'origin']);
            remoteUrl = stdout.trim();
        } catch {
            const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'remote', '-v']);
            const first = stdout
                .split('\n')
                .map((line) => line.trim())
                .find((line) => line.length > 0);
            if (first) {
                const parts = first.split(/\s+/);
                remoteUrl = parts[1] || '';
            }
        }

        const parsed = parseGitUrl(remoteUrl);
        if (!parsed) return null;
        return { rootPath: repoRoot, repo: parsed };
    } catch {
        return null;
    }
}

export async function inferProjectBindingFromPath(pathValue: string): Promise<ProjectBinding | null> {
    const fsPath = pathValue.endsWith('.plan') ? dirname(pathValue) : pathValue;
    const identity = await getGitRepoIdentity(fsPath);
    if (!identity) return null;
    return {
        id: `${identity.repo.owner}/${identity.repo.name}`.toLowerCase(),
        name: identity.repo.name,
        repo: {
            provider: identity.repo.provider,
            owner: identity.repo.owner,
            name: identity.repo.name,
            url: identity.repo.url,
        },
        workspace: {
            relativeRoot: '.',
            pathHints: [identity.rootPath],
        },
        relationship: 'primary',
    };
}

export async function readProjectBinding(
    planPath: string,
    options?: { createManifestIfMissing?: boolean }
): Promise<{
    project: ProjectBinding | null;
    source: 'explicit' | 'inferred' | 'none';
    migration: { manifestCreated: boolean };
}> {
    const migration = { manifestCreated: false };
    if (planPath.endsWith('.plan')) {
        const explicit = await readSqliteProjectBinding(planPath);
        if (explicit) {
            return { project: explicit, source: 'explicit', migration };
        }
        const inferred = await inferProjectBindingFromPath(planPath);
        if (inferred) {
            return { project: inferred, source: 'inferred', migration };
        }
        return { project: null, source: 'none', migration };
    }

    let manifest = await readManifestRaw(planPath);

    if (!manifest && options?.createManifestIfMissing) {
        await ensurePlanManifest(planPath, { id: basename(planPath), title: basename(planPath) });
        manifest = await readManifestRaw(planPath);
        migration.manifestCreated = Boolean(manifest);
    }

    if (manifest?.project) {
        const normalized = normalizeProjectBinding(ProjectBindingSchema.parse(manifest.project));
        return { project: normalized, source: 'explicit', migration };
    }

    const inferred = await inferProjectBindingFromPath(planPath);
    if (inferred) {
        return { project: inferred, source: 'inferred', migration };
    }

    return { project: null, source: 'none', migration };
}

export async function bindProjectToPlan(planPath: string, project: ProjectBinding): Promise<{
    project: ProjectBinding;
    migration: { manifestCreated: boolean };
}> {
    const validated = normalizeProjectBinding(ProjectBindingSchema.parse(project));
    if (planPath.endsWith('.plan')) {
        await writeSqliteProjectBinding(planPath, validated);
        return { project: validated, migration: { manifestCreated: false } };
    }

    let manifest = await readManifestRaw(planPath);
    let manifestCreated = false;
    if (!manifest) {
        await ensurePlanManifest(planPath, { id: basename(planPath), title: basename(planPath) });
        manifest = await readManifestRaw(planPath);
        manifestCreated = Boolean(manifest);
    }
    const nextManifest: ManifestLike = {
        ...(manifest || {}),
        id: (manifest?.id as string | undefined) || basename(planPath),
        title: (manifest?.title as string | undefined) || basename(planPath),
        project: validated,
    };
    await writeManifestRaw(planPath, nextManifest);
    return { project: validated, migration: { manifestCreated } };
}

async function readSqliteProjectBinding(planPath: string): Promise<ProjectBinding | null> {
    const provider = createSqliteProvider(planPath);
    try {
        const fileResult = await provider.getFile(SQLITE_PROJECT_BINDING_TYPE, SQLITE_PROJECT_BINDING_FILE);
        if (!fileResult.success || !fileResult.data?.content) {
            return null;
        }
        const parsed = JSON.parse(fileResult.data.content);
        return normalizeProjectBinding(ProjectBindingSchema.parse(parsed));
    } catch {
        return null;
    } finally {
        await provider.close();
    }
}

async function writeSqliteProjectBinding(planPath: string, project: ProjectBinding): Promise<void> {
    const provider = createSqliteProvider(planPath);
    try {
        const existing = await provider.getFile(SQLITE_PROJECT_BINDING_TYPE, SQLITE_PROJECT_BINDING_FILE);
        const now = new Date().toISOString();
        await provider.saveFile({
            type: SQLITE_PROJECT_BINDING_TYPE,
            filename: SQLITE_PROJECT_BINDING_FILE,
            content: JSON.stringify(project, null, 2),
            createdAt: existing.success && existing.data?.createdAt ? existing.data.createdAt : now,
            updatedAt: now,
        });
    } finally {
        await provider.close();
    }
}

function normalizeMappings(rawMappings: unknown): WorkspaceMapping[] {
    if (!Array.isArray(rawMappings)) return [];
    const parsed: WorkspaceMapping[] = [];
    for (const item of rawMappings) {
        const result = WorkspaceMappingSchema.safeParse(item);
        if (result.success) parsed.push(result.data);
    }
    return parsed;
}

export async function resolveProjectContext(args: {
    planPath: string;
    cwd: string;
    project: ProjectBinding | null;
    workspaceMappings?: unknown;
    contextConfig?: unknown;
}): Promise<{
    resolved: boolean;
    method: 'repo_identity' | 'workspace_mapping' | 'path_hint' | 'none';
    projectRoot?: string;
    project?: ProjectBinding | null;
}> {
    const { cwd, project } = args;
    if (!project) {
        return { resolved: false, method: 'none', project: null };
    }

    const matchKeys = new Set(getProjectMatchKeys(project));

    // 1) Match repo identity from current cwd
    const cwdRepo = await getGitRepoIdentity(cwd);
    if (cwdRepo && matchKeys.has(cwdRepo.repo.key)) {
        const relativeRoot = project.workspace?.relativeRoot || '.';
        const projectRoot = resolve(cwdRepo.rootPath, relativeRoot);
        return { resolved: true, method: 'repo_identity', projectRoot, project };
    }

    // 2) Local workspace mappings from explicit args or context config
    const mergedMappings = [
        ...normalizeMappings(args.workspaceMappings),
        ...normalizeMappings((args.contextConfig as any)?.projectMappings),
    ];
    const normalizedId = project.id.toLowerCase();
    for (const mapping of mergedMappings) {
        const mappingKey = (mapping.repoKey || '').toLowerCase();
        if (mapping.projectId.toLowerCase() === normalizedId || (mappingKey && matchKeys.has(mappingKey))) {
            const relativeRoot = project.workspace?.relativeRoot || '.';
            const projectRoot = resolve(mapping.rootPath, relativeRoot);
            return { resolved: true, method: 'workspace_mapping', projectRoot, project };
        }
    }

    // 3) Optional path hints fallback
    for (const hint of project.workspace?.pathHints || []) {
        try {
            await access(hint);
            const relativeRoot = project.workspace?.relativeRoot || '.';
            const projectRoot = resolve(hint, relativeRoot);
            return { resolved: true, method: 'path_hint', projectRoot, project };
        } catch {
            // Ignore stale hint
        }
    }

    return { resolved: false, method: 'none', project };
}
