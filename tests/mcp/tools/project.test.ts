import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
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

    async function createSqlitePlan(planCode: string): Promise<string> {
        const planPath = join(testDir, 'plans', `${planCode}.plan`);
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
    });

    it('rejects bind but infers get context for sqlite plans', async () => {
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
                        relativeRoot: '.',
                        pathHints: ['/Users/tobrien/gitw/kjerneverk/riotdoc'],
                    },
                    relationship: 'primary',
                },
            },
            context
        );

        expect(bindResult.success).toBe(false);
        expect(String(bindResult.error)).toContain('not yet persisted');

        const getResult = await getProjectBindingTool.execute({ planId: planPath }, context);
        expect(getResult.success).toBe(true);
        const getData = getResult.data as { source: string; migration: { manifestCreated: boolean } };
        expect(getData.source).toMatch(/inferred|none/);
        expect(getData.migration.manifestCreated).toBe(false);
    });

    it('resolves sqlite project context using inferred binding when available', async () => {
        const planPath = await createSqlitePlan('portable-plan');

        const aliceResolved = await resolveProjectContextTool.execute(
            {
                planId: planPath,
                cwd: '/tmp/non-repo-alice',
                workspaceMappings: [{ projectId: 'riotdoc', rootPath: '/Users/alice/dev/riotdoc' }],
            },
            context
        );
        expect(aliceResolved.success).toBe(true);
        const resolvedData = aliceResolved.data as { source: string };
        expect(resolvedData.source).toMatch(/inferred|none/);
    });
});
