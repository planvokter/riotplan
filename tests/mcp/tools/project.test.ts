import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolExecutionContext } from '../../../src/mcp/types.js';
import { listPlansTool } from '../../../src/mcp/tools/switch.js';
import {
    bindProjectTool,
    getProjectBindingTool,
    resolveProjectContextTool,
} from '../../../src/mcp/tools/project.js';

describe('project binding tools', () => {
    let testDir: string;
    let context: ToolExecutionContext;

    async function createLegacyPlan(planName: string): Promise<string> {
        const planDir = join(testDir, 'plans', planName);
        await mkdir(planDir, { recursive: true });
        await writeFile(join(planDir, 'STATUS.md'), '# Status\n');
        return planDir;
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

    it('loads old plans without explicit project metadata', async () => {
        await createLegacyPlan('legacy-plan');

        const result = await listPlansTool.execute({}, context);
        expect(result.success).toBe(true);
        expect(result.data?.plans).toHaveLength(1);
        expect(result.data?.plans[0].id).toBe('legacy-plan');
    });

    it('bind/get project metadata on a plan', async () => {
        await createLegacyPlan('project-voice-tone');

        const bindResult = await bindProjectTool.execute(
            {
                planId: 'project-voice-tone',
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
                        relativeRoot: '.',
                        pathHints: ['/Users/tobrien/gitw/kjerneverk/riotdoc'],
                    },
                    relationship: 'primary',
                },
            },
            context
        );

        expect(bindResult.success).toBe(true);

        const getResult = await getProjectBindingTool.execute({ planId: 'project-voice-tone' }, context);
        expect(getResult.success).toBe(true);
        expect(getResult.data?.project?.id).toBe('riotdoc');
        expect(getResult.data?.project?.repo?.owner).toBe('tobrien');
        expect(getResult.data?.source).toBe('manifest');
    });

    it('filters list by associated project', async () => {
        await createLegacyPlan('voice-tone');
        await createLegacyPlan('release-cadence');

        await bindProjectTool.execute(
            {
                planId: 'voice-tone',
                project: { id: 'riotdoc', relationship: 'primary' },
            },
            context
        );
        await bindProjectTool.execute(
            {
                planId: 'release-cadence',
                project: { id: 'riotplan', relationship: 'primary' },
            },
            context
        );

        const filtered = await listPlansTool.execute({ projectId: 'riotdoc' }, context);
        expect(filtered.success).toBe(true);
        expect(filtered.data?.plans).toHaveLength(1);
        expect(filtered.data?.plans[0].id).toBe('voice-tone');
        expect(filtered.data?.plans[0].project?.id).toBe('riotdoc');
    });

    it('resolves same bound plan across different workstation roots via local mapping', async () => {
        await createLegacyPlan('portable-plan');
        await bindProjectTool.execute(
            {
                planId: 'portable-plan',
                project: {
                    id: 'riotdoc',
                    repo: {
                        provider: 'github',
                        owner: 'tobrien',
                        name: 'riotdoc',
                    },
                    workspace: {
                        relativeRoot: '.',
                        pathHints: ['/Users/tobrien/gitw/kjerneverk/riotdoc'],
                    },
                    relationship: 'primary',
                },
            },
            context
        );

        const aliceResolved = await resolveProjectContextTool.execute(
            {
                planId: 'portable-plan',
                cwd: '/tmp/non-repo-alice',
                workspaceMappings: [{ projectId: 'riotdoc', rootPath: '/Users/alice/dev/riotdoc' }],
            },
            context
        );
        expect(aliceResolved.success).toBe(true);
        expect(aliceResolved.data?.resolved).toBe(true);
        expect(aliceResolved.data?.method).toBe('workspace_mapping');
        expect(aliceResolved.data?.projectRoot).toContain('/Users/alice/dev/riotdoc');

        const bobResolved = await resolveProjectContextTool.execute(
            {
                planId: 'portable-plan',
                cwd: '/tmp/non-repo-bob',
                workspaceMappings: [{ projectId: 'riotdoc', rootPath: '/home/bob/src/riotdoc' }],
            },
            context
        );
        expect(bobResolved.success).toBe(true);
        expect(bobResolved.data?.resolved).toBe(true);
        expect(bobResolved.data?.method).toBe('workspace_mapping');
        expect(bobResolved.data?.projectRoot).toContain('/home/bob/src/riotdoc');
    });
});
