import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readPlanResource } from '../../../src/mcp/resources/plan.js';

describe('readPlanResource', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `riotplan-plan-resource-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    async function createPlan(planId: string, options?: { projectPath?: string }): Promise<string> {
        const planDir = join(testDir, planId);
        await mkdir(planDir, { recursive: true });
        await writeFile(
            join(planDir, 'SUMMARY.md'),
            '# Project Voice Tone\n\nRefine tone and voice for project communication.\n',
            'utf-8'
        );
        await writeFile(join(planDir, 'STATUS.md'), '# Status\n', 'utf-8');

        if (options?.projectPath) {
            await writeFile(
                join(planDir, 'plan.yaml'),
                `id: ${planId}\n` +
                    'title: Project Voice Tone\n' +
                    'created: 2026-02-17T17:25:38.812Z\n' +
                    `projectPath: ${options.projectPath}\n`,
                'utf-8'
            );
        }

        return planDir;
    }

    it('returns projectPath when plan.yaml includes it', async () => {
        const planDir = await createPlan('project-voice-tone', {
            projectPath: '/Users/tobrien/gitw/kjerneverk/riotdoc',
        });

        const result = await readPlanResource(planDir);

        expect(result.exists).toBe(true);
        expect(result.planId).toBe('project-voice-tone');
        expect(result.code).toBe('project-voice-tone');
        expect(result.name).toBe('Project Voice Tone');
        expect(result.metadata?.projectPath).toBe('/Users/tobrien/gitw/kjerneverk/riotdoc');
        expect(result.metadata?.code).toBe('project-voice-tone');
        expect(result.metadata?.name).toBe('Project Voice Tone');
        expect(result).toHaveProperty('state');
    });

    it('works for plans without projectPath and preserves existing fields', async () => {
        const planDir = await createPlan('legacy-plan');

        const result = await readPlanResource(planDir);

        expect(result.exists).toBe(true);
        expect(result.planId).toBe('legacy-plan');
        expect(result.code).toBe('legacy-plan');
        expect(result.name).toBe('Project Voice Tone');
        expect(result.metadata?.code).toBe('legacy-plan');
        expect(result.metadata?.name).toBe('Project Voice Tone');
        expect(result.metadata?.projectPath).toBeUndefined();
        expect(result.state?.status).toBeDefined();
    });
});
