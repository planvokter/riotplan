import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';
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

    async function createPlan(planId: string): Promise<string> {
        const planPath = join(testDir, `${planId}.plan`);
        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        await provider.initialize({
            id: planId,
            uuid: '00000000-0000-4000-8000-000000000121',
            name: 'Project Voice Tone',
            description: 'Refine tone and voice for project communication.',
            createdAt: now,
            updatedAt: now,
            stage: 'idea',
            schemaVersion: 1,
        });
        await provider.close();
        return planPath;
    }

    it('reads sqlite plan metadata', async () => {
        const planDir = await createPlan('project-voice-tone');

        const result = await readPlanResource(planDir);

        expect(result.exists).toBe(true);
        expect(result.planId).toBe('project-voice-tone');
        expect(result.code).toBe('project-voice-tone');
        expect(result.name).toBe('Project Voice Tone');
        expect(result.metadata?.code).toBe('project-voice-tone');
        expect(result.metadata?.name).toBe('Project Voice Tone');
        expect(result).toHaveProperty('state');
    });

    it('returns exists=false when sqlite plan does not exist', async () => {
        const planDir = await createPlan('legacy-plan');
        await rm(planDir, { force: true });

        const result = await readPlanResource(planDir);

        expect(result.exists).toBe(false);
        expect(result.planId).toBeNull();
    });
});
