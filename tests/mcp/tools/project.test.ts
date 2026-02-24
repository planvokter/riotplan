import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import type { ToolExecutionContext } from '../../../src/mcp/types.js';
import { listPlansTool } from '../../../src/mcp/tools/switch.js';
import {
    bindProjectTool,
    getProjectBindingTool,
    resolveProjectContextTool,
} from '../../../src/mcp/tools/project.js';

const execFileAsync = promisify(execFile);

describe('project binding tools', () => {
    let testDir: string;
    let context: ToolExecutionContext;

    async function createSqlitePlan(planCode: string, parentDir = join(testDir, 'plans')): Promise<string> {
        await mkdir(parentDir, { recursive: true });
        const planPath = join(parentDir, `${planCode}.plan`);
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: planCode,
            uuid: '00000000-0000-4000-8000-000000000111',
            name: planCode,
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.close();
        return planPath;
    }

    async function setupGitRepo(path: string, remoteUrl: string): Promise<void> {
        await mkdir(path, { recursive: true });
        await execFileAsync('git', ['-C', path, 'init']);
        await execFileAsync('git', ['-C', path, 'remote', 'add', 'origin', remoteUrl]);
    }

    beforeEach(async () => {
        testDir = join(tmpdir(), `riotplan-project-tools-test-${Date.now()}`);
        await mkdir(join(testDir, 'plans'), { recursive: true });
        context = {
            workingDirectory: testDir,
            session: null,
            mcpServer: null as any,
            sendNotification: async () => {},
        };
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('lists sqlite plans', async () => {
        await createSqlitePlan('sqlite-plan');

        const result = await listPlansTool.execute({}, context);
        expect(result.success).toBe(true);
        expect(result.data?.plans).toHaveLength(1);
        expect(result.data?.plans[0].id).toBe('sqlite-plan');
        expect(result.data?.plans[0].type).toBe('sqlite');
        expect(result.data?.plans[0].projectSource).toBe('none');
    });

    it('binds and reads explicit project metadata for sqlite plans', async () => {
        const planPath = await createSqlitePlan('project-voice-tone');

        const bindResult = await bindProjectTool.execute(
            {
                planId: planPath,
                project: {
                    id: 'riotdoc',
                    name: 'RiotDoc',
                    repo: {
                        provider: 'github',
                        owner: 'tobrien',
                        name: 'riotdoc',
                        url: 'https://github.com/tobrien/riotdoc',
                    },
                    workspace: {
                        id: 'workspace-a',
                        relativeRoot: '.',
                        pathHints: ['/tmp/workspace-a/riotdoc'],
                    },
                    relationship: 'primary',
                },
            },
            context
        );

        expect(bindResult.success).toBe(true);

        const getResult = await getProjectBindingTool.execute({ planId: planPath }, context);
        expect(getResult.success).toBe(true);
        const getData = getResult.data as {
            source: string;
            project: { id: string; workspace?: { id?: string } };
            migration: { manifestCreated: boolean };
        };
        expect(getData.source).toBe('explicit');
        expect(getData.project.id).toBe('riotdoc');
        expect(getData.project.workspace?.id).toBe('workspace-a');
        expect(getData.migration.manifestCreated).toBe(false);
    });

    it('resolves project context using explicit binding workspace mapping', async () => {
        const planPath = await createSqlitePlan('portable-plan-explicit');
        const bindResult = await bindProjectTool.execute(
            {
                planId: planPath,
                project: {
                    id: 'riotdoc',
                    repo: {
                        provider: 'github',
                        owner: 'tobrien',
                        name: 'riotdoc',
                        url: 'https://github.com/tobrien/riotdoc',
                    },
                    workspace: {
                        id: 'workspace-a',
                        relativeRoot: '.',
                        pathHints: [],
                    },
                },
            },
            context
        );
        expect(bindResult.success).toBe(true);

        const resolved = await resolveProjectContextTool.execute(
            {
                planId: planPath,
                cwd: '/tmp/non-repo',
                workspaceMappings: [{ projectId: 'riotdoc', rootPath: '/tmp/workspace-a/riotdoc' }],
            },
            context
        );
        expect(resolved.success).toBe(true);
        expect(resolved.data?.source).toBe('explicit');
        expect(resolved.data?.resolved).toBe(true);
        expect(resolved.data?.method).toBe('workspace_mapping');
    });

    it('falls back to inferred binding for sqlite plans in a git repo', async () => {
        const repoPath = join(testDir, 'repo');
        await setupGitRepo(repoPath, 'https://github.com/acme/rocket.git');
        const planPath = await createSqlitePlan('portable-plan-inferred', join(repoPath, 'plans'));

        const getResult = await getProjectBindingTool.execute({ planId: planPath }, context);
        expect(getResult.success).toBe(true);
        expect(getResult.data?.source).toBe('inferred');
        expect(getResult.data?.project?.id).toBe('acme/rocket');

        const resolved = await resolveProjectContextTool.execute(
            {
                planId: planPath,
                cwd: '/tmp/non-repo',
                workspaceMappings: [{ projectId: 'acme/rocket', rootPath: '/tmp/workspace-b/rocket' }],
            },
            context
        );
        expect(resolved.success).toBe(true);
        expect(resolved.data?.resolved).toBe(true);
        expect(resolved.data?.method).toBe('workspace_mapping');
        expect(resolved.data?.source).toBe('inferred');
    });

    it('returns unresolved binding when explicit and inferred metadata are unavailable', async () => {
        const planPath = await createSqlitePlan('portable-plan-unresolved');

        const getResult = await getProjectBindingTool.execute({ planId: planPath }, context);
        expect(getResult.success).toBe(true);
        expect(getResult.data?.source).toBe('none');
        expect(getResult.data?.project).toBeNull();

        const resolved = await resolveProjectContextTool.execute(
            {
                planId: planPath,
                cwd: '/tmp/non-repo',
            },
            context
        );
        expect(resolved.success).toBe(true);
        expect(resolved.data?.resolved).toBe(false);
        expect(resolved.data?.source).toBe('none');
    });
});
