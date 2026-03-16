import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkpointCreate, checkpointRestore } from '../../../src/mcp/tools/history.js';

describe('checkpoint restore', () => {
    it('restores captured build artifacts and step files', async () => {
        const planDir = await mkdtemp(join(tmpdir(), 'riotplan-history-restore-'));
        const stepDir = join(planDir, 'plan');

        try {
            await mkdir(stepDir, { recursive: true });
            await writeFile(join(planDir, 'IDEA.md'), '# Idea v1\n');
            await writeFile(join(planDir, 'SHAPING.md'), '# Shaping v1\n');
            await writeFile(join(planDir, 'LIFECYCLE.md'), '**Stage**: `shaping`\n');
            await writeFile(join(planDir, 'SUMMARY.md'), '# Summary v1\n');
            await writeFile(join(planDir, 'STATUS.md'), '# Status v1\n');
            await writeFile(join(stepDir, '01-first-step.md'), '# Step 01 v1\n');

            await checkpointCreate({
                planId: planDir,
                name: 'before-changes',
                message: 'baseline checkpoint',
                capturePrompt: false,
            });

            await writeFile(join(planDir, 'SUMMARY.md'), '# Summary v2\n');
            await writeFile(join(planDir, 'STATUS.md'), '# Status v2\n');
            await writeFile(join(stepDir, '01-first-step.md'), '# Step 01 v2\n');

            await checkpointRestore({
                planId: planDir,
                checkpoint: 'before-changes',
            });

            expect(await readFile(join(planDir, 'SUMMARY.md'), 'utf-8')).toBe('# Summary v1\n');
            expect(await readFile(join(planDir, 'STATUS.md'), 'utf-8')).toBe('# Status v1\n');
            expect(await readFile(join(stepDir, '01-first-step.md'), 'utf-8')).toBe('# Step 01 v1\n');
        } finally {
            await rm(planDir, { recursive: true, force: true });
        }
    });
});
