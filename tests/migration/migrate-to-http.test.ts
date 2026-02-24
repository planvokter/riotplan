import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => {
    const provider = {
        initialize: vi.fn(async () => ({ success: true })),
        addStep: vi.fn(async () => ({ success: true })),
        saveFile: vi.fn(async () => ({ success: true })),
        close: vi.fn(async () => undefined),
    };
    return {
        createSqliteProvider: vi.fn(() => provider),
        generatePlanUuid: vi.fn(() => 'uuid-1234'),
        formatPlanFilename: vi.fn((uuid: string, slug: string) => `${uuid}-${slug}.plan`),
        loadPlan: vi.fn(),
        provider,
    };
});

vi.mock('@kjerneverk/riotplan-format', () => ({
    createSqliteProvider: mocks.createSqliteProvider,
    generatePlanUuid: mocks.generatePlanUuid,
    formatPlanFilename: mocks.formatPlanFilename,
}));

vi.mock('../../src/plan/loader.js', () => ({
    loadPlan: mocks.loadPlan,
}));

import { migrateToHttpFormat } from '../../src/migration/migrate-to-http.js';

describe('migrate-to-http', () => {
    let root: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        root = await mkdtemp(join(tmpdir(), 'riotplan-migrate-http-'));
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    async function createPlanDir(parent: string, name: string): Promise<string> {
        const dir = join(parent, name);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'STATUS.md'), '# status', 'utf-8');
        return dir;
    }

    it('migrates detected plans and writes manifest', async () => {
        const sourceDir = join(root, 'src');
        const targetDir = join(root, 'out');
        await mkdir(sourceDir, { recursive: true });
        const planDir = await createPlanDir(sourceDir, 'my-plan');

        mocks.loadPlan.mockResolvedValueOnce({
            metadata: {
                code: 'my-plan',
                name: 'My Plan',
                description: 'desc',
                createdAt: new Date('2024-01-01T00:00:00.000Z'),
            },
            state: { status: 'in_progress' },
            steps: [
                {
                    number: 1,
                    code: 'step-1',
                    title: 'Step 1',
                    description: 'Do thing',
                    status: 'failed',
                    startedAt: new Date('2024-01-01T00:00:00.000Z'),
                    filename: 'plan/01-step.md',
                },
            ],
            files: {
                'IDEA.md': '# Idea',
                'evidence-notes.md': 'evidence',
                'plan/01-step.md': '# Step content',
            },
        });

        const result = await migrateToHttpFormat({ sourceDir, targetDir, projectSlug: 'kjerneverk' });
        expect(result.success).toBe(true);
        expect(result.migratedCount).toBe(1);
        expect(result.entries[0]?.sourcePath).toBe(planDir);
        expect(result.entries[0]?.targetPath).toContain('uuid-1234-my-plan.plan');
        expect(result.manifestPath).toBe(join(targetDir, 'migration-manifest.json'));

        expect(mocks.createSqliteProvider).toHaveBeenCalledTimes(1);
        expect(mocks.provider.initialize).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'my-plan',
                stage: 'executing',
                description: '[kjerneverk] desc',
            })
        );
        expect(mocks.provider.addStep).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'skipped',
                content: '# Step content',
            })
        );
        expect(mocks.provider.saveFile).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'idea', filename: 'IDEA.md' })
        );
        expect(mocks.provider.saveFile).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'evidence', filename: 'evidence-notes.md' })
        );
    });

    it('supports dry-run mode and skips sqlite writes', async () => {
        const sourceDir = join(root, 'src');
        const targetDir = join(root, 'out');
        await mkdir(sourceDir, { recursive: true });
        await createPlanDir(sourceDir, 'dry-plan');
        mocks.loadPlan.mockResolvedValueOnce({
            metadata: { code: 'dry-plan', name: 'Dry', description: '', createdAt: undefined },
            state: { status: 'pending' },
            steps: [],
            files: {},
        });

        const result = await migrateToHttpFormat({ sourceDir, targetDir, dryRun: true });
        expect(result.success).toBe(true);
        expect(result.skippedCount).toBe(1);
        expect(result.migratedCount).toBe(0);
        expect(mocks.createSqliteProvider).not.toHaveBeenCalled();
    });

    it('marks run unsuccessful when a plan migration fails', async () => {
        const sourceDir = join(root, 'src');
        const targetDir = join(root, 'out');
        const doneDir = join(sourceDir, 'done');
        await mkdir(doneDir, { recursive: true });
        await createPlanDir(doneDir, 'good-plan');
        await createPlanDir(doneDir, 'bad-plan');

        mocks.loadPlan
            .mockResolvedValueOnce({
                metadata: { code: 'good-plan', name: 'Good', description: '', createdAt: undefined },
                state: { status: 'completed' },
                steps: [],
                files: {},
            })
            .mockRejectedValueOnce(new Error('cannot load bad plan'));

        const result = await migrateToHttpFormat({ sourceDir, targetDir });
        expect(result.success).toBe(false);
        expect(result.migratedCount).toBe(1);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]?.error).toContain('cannot load bad plan');
        expect(result.entries.some((e) => e.status === 'failed')).toBe(true);
        expect(result.entries.some((e) => e.targetPath?.includes('/done/'))).toBe(true);
    });

    it('returns no-op summary when no plan dirs are found', async () => {
        const sourceDir = join(root, 'empty-src');
        const targetDir = join(root, 'out');
        await mkdir(join(sourceDir, '.hidden'), { recursive: true });
        await writeFile(join(sourceDir, '.hidden', 'STATUS.md'), '# ignored hidden plan', 'utf-8');

        const result = await migrateToHttpFormat({ sourceDir, targetDir });
        expect(result.success).toBe(true);
        expect(result.migratedCount).toBe(0);
        expect(result.errors).toEqual([]);
        expect(mocks.loadPlan).not.toHaveBeenCalled();
    });
});
