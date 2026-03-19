import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

export interface TestPlanOptions {
    id?: string;
    name?: string;
    description?: string;
    stage?: string;
    steps?: Array<{
        number: number;
        code: string;
        title: string;
        status?: string;
        content?: string;
        description?: string;
        startedAt?: string;
        completedAt?: string;
    }>;
    files?: Array<{
        type: string;
        filename: string;
        content: string;
    }>;
}

export async function createTestPlan(options: TestPlanOptions = {}): Promise<string> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'riotplan-test-'));
    const planPath = join(tmpDir, `${options.id || 'test-plan'}.plan`);

    const now = new Date().toISOString();
    const provider = createSqliteProvider(planPath);
    const initResult = await provider.initialize({
        id: options.id || 'test-plan',
        uuid: randomUUID(),
        name: options.name || 'Test Plan',
        description: options.description,
        stage: (options.stage || 'executing') as any,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
    });

    if (!initResult.success) {
        await provider.close();
        throw new Error(`Failed to initialize test plan: ${initResult.error}`);
    }

    if (options.steps) {
        for (const step of options.steps) {
            await provider.addStep({
                number: step.number,
                code: step.code,
                title: step.title,
                description: step.description,
                status: (step.status || 'pending') as any,
                content: step.content || `# Step ${String(step.number).padStart(2, '0')}: ${step.title}\n\n## Objective\n\nTest step.`,
                startedAt: step.startedAt,
                completedAt: step.completedAt,
            });
        }
    }

    if (options.files) {
        for (const file of options.files) {
            await provider.saveFile({
                type: file.type as any,
                filename: file.filename,
                content: file.content,
                createdAt: now,
                updatedAt: now,
            });
        }
    }

    await provider.close();
    return planPath;
}
