import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
import type { ToolExecutionContext } from '../../../src/mcp/types.js';
import { listPlansTool, planTool } from '../../../src/mcp/tools/switch.js';
import { bindProjectTool } from '../../../src/mcp/tools/project.js';

const execFileAsync = promisify(execFile);

describe('riotplan_list_plans workspace filtering', () => {
    let testDir: string;
    let context: ToolExecutionContext;

    async function createSqlitePlan(planCode: string, parentDir = join(testDir, 'plans')): Promise<string> {
        await mkdir(parentDir, { recursive: true });
        const planPath = join(parentDir, `${planCode}.plan`);
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: planCode,
            uuid: `00000000-0000-4000-8000-${String(Math.floor(Math.random() * 1_000_000_000)).padStart(12, '0')}`,
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
        testDir = join(tmpdir(), `riotplan-switch-tools-test-${Date.now()}`);
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

    it('returns unfiltered plans when workspaceId is omitted', async () => {
        await createSqlitePlan('plan-a');
        await createSqlitePlan('plan-b');

        const result = await listPlansTool.execute({}, context);
        expect(result.success).toBe(true);
        expect(result.data?.plans).toHaveLength(2);
        for (const plan of result.data?.plans || []) {
            expect(typeof plan.createdAt).toBe('string');
            expect(typeof plan.updatedAt).toBe('string');
            expect(Number.isNaN(new Date(plan.createdAt).getTime())).toBe(false);
            expect(Number.isNaN(new Date(plan.updatedAt).getTime())).toBe(false);
        }
    });

    it('does not expose directory override fields in public plan schemas', async () => {
        expect(Object.keys(planTool.schema)).not.toContain('directory');
        expect(Object.keys(listPlansTool.schema)).not.toContain('directory');
    });

    it('creates and lists plans using server-managed directory resolution', async () => {
        const created = await planTool.execute(
            {
                action: 'create',
                code: 'secure-default-root',
                description: 'Server-owned root test',
            },
            context
        );

        expect(created.success).toBe(true);
        expect(created.data?.planId).toBe('secure-default-root');

        const listed = await listPlansTool.execute({}, context);
        expect(listed.success).toBe(true);
        expect((listed.data?.plans || []).some((plan: { id: string }) => plan.id === 'secure-default-root')).toBe(true);
    });

    it('rejects directory/path/root overrides for create and list operations', async () => {
        const blockedArgs = [
            { directory: '/tmp/evil' },
            { path: '/tmp/evil' },
            { root: '/tmp/evil' },
            { planDirectory: '/tmp/evil' },
        ];

        for (const [index, blocked] of blockedArgs.entries()) {
            const createResult = await planTool.execute(
                {
                    action: 'create',
                    code: `blocked-${index}`,
                    description: 'should fail',
                    ...blocked,
                },
                context
            );
            expect(createResult.success).toBe(false);
            expect(createResult.error).toContain(
                'E_INVALID_ARGUMENT: directory is server-managed and cannot be provided by client'
            );

            const listResult = await listPlansTool.execute(blocked, context);
            expect(listResult.success).toBe(false);
            expect(listResult.error).toContain(
                'E_INVALID_ARGUMENT: directory is server-managed and cannot be provided by client'
            );
        }
    });

    it('filters by workspaceId when provided', async () => {
        const alphaPath = await createSqlitePlan('plan-alpha');
        const betaPath = await createSqlitePlan('plan-beta');
        await bindProjectTool.execute(
            {
                planId: alphaPath,
                project: {
                    id: 'project-alpha',
                    workspace: { id: 'workspace-alpha' },
                },
            },
            context
        );
        await bindProjectTool.execute(
            {
                planId: betaPath,
                project: {
                    id: 'project-beta',
                    workspace: { id: 'workspace-beta' },
                },
            },
            context
        );

        const result = await listPlansTool.execute({ workspaceId: 'workspace-alpha' }, context);
        expect(result.success).toBe(true);
        expect(result.data?.plans).toHaveLength(1);
        expect(result.data?.plans[0].id).toBe('plan-alpha');
    });

    it('handles explicit, inferred, and unresolved plans safely under workspace filter', async () => {
        const explicitPath = await createSqlitePlan('plan-explicit');
        await bindProjectTool.execute(
            {
                planId: explicitPath,
                project: {
                    id: 'project-explicit',
                    workspace: { id: 'workspace-explicit' },
                },
            },
            context
        );

        const repoPath = join(testDir, 'repo');
        await setupGitRepo(repoPath, 'https://github.com/acme/rocket.git');
        await createSqlitePlan('plan-inferred', join(repoPath, 'plans'));
        await createSqlitePlan('plan-unresolved');

        const filtered = await listPlansTool.execute({ workspaceId: 'workspace-explicit' }, context);
        expect(filtered.success).toBe(true);
        expect(filtered.data?.plans).toHaveLength(1);
        expect(filtered.data?.plans[0].id).toBe('plan-explicit');

        const unfiltered = await listPlansTool.execute({}, context);
        expect(unfiltered.success).toBe(true);
        expect(unfiltered.data?.plans.length).toBeGreaterThanOrEqual(3);
    });
});
