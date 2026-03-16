import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveDirectory } from '../../../src/mcp/tools/shared.js';

describe('resolveDirectory plan containment', () => {
    it('resolves a plan inside the configured working directory', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'riotplan-shared-in-'));
        try {
            const plansDir = join(baseDir, 'plans');
            await mkdir(plansDir, { recursive: true });
            const planPath = join(plansDir, 'inside.plan');
            await writeFile(planPath, '');

            const resolved = resolveDirectory(
                { planId: planPath },
                { workingDirectory: baseDir } as any
            );

            expect(resolved).toBe(planPath);
        } finally {
            await rm(baseDir, { recursive: true, force: true });
        }
    });

    it('rejects absolute plan paths outside the configured working directory', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'riotplan-shared-base-'));
        const outsideDir = await mkdtemp(join(tmpdir(), 'riotplan-shared-out-'));
        try {
            const outsidePlanPath = join(outsideDir, 'outside.plan');
            await writeFile(outsidePlanPath, '');

            expect(() =>
                resolveDirectory(
                    { planId: outsidePlanPath },
                    { workingDirectory: baseDir } as any
                )
            ).toThrow(`Plan not found for planId: ${outsidePlanPath}`);
        } finally {
            await rm(baseDir, { recursive: true, force: true });
            await rm(outsideDir, { recursive: true, force: true });
        }
    });
});
