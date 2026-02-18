/**
 * Integration tests for verification system
 * 
 * Note: These tests verify the integration between components.
 * Config-based behavior is tested in unit tests (engine.test.ts)
 * since config loading from temp directories is complex.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { completeStep } from '../../src/steps/operations.js';
import type { Plan, PlanStep } from '../../src/types.js';

describe('Verification Integration', () => {
    let tempDir: string;
    let planPath: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'riotplan-verify-test-'));
        planPath = tempDir;
        
        // Create plan structure
        mkdirSync(join(tempDir, 'plan'), { recursive: true });
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    function createTestPlan(stepContent: string): Plan {
        const stepFile = join(tempDir, 'plan', '01-test-step.md');
        writeFileSync(stepFile, stepContent);

        return {
            metadata: {
                code: 'test-plan',
                name: 'Test Plan',
                path: planPath,
            },
            files: {},
            steps: [{
                number: 1,
                code: 'test-step',
                filename: '01-test-step.md',
                title: 'Test Step',
                status: 'in_progress',
                filePath: stepFile,
            }] as PlanStep[],
            state: {
                status: 'in_progress',
                lastUpdatedAt: new Date(),
                blockers: [],
                issues: [],
                progress: 0,
            },
        } as Plan;
    }

    describe('completeStep integration', () => {
        it('should complete step without verification when no config', async () => {
            const plan = createTestPlan(`# Step 01

## Acceptance Criteria

- [ ] Unchecked criterion
`);

            // Without config, verification doesn't run
            const result = await completeStep(plan, 1);
            expect(result.status).toBe('completed');
        });

        it('should complete step with skipVerification flag', async () => {
            const plan = createTestPlan(`# Step 01

## Acceptance Criteria

- [ ] Unchecked criterion
`);

            const result = await completeStep(plan, 1, { skipVerification: true });
            expect(result.status).toBe('completed');
        });

        it('should complete step with force flag', async () => {
            const plan = createTestPlan(`# Step 01

## Acceptance Criteria

- [ ] Unchecked criterion
`);

            const result = await completeStep(plan, 1, { force: true });
            expect(result.status).toBe('completed');
        });

        it('should complete step with all criteria checked', async () => {
            const plan = createTestPlan(`# Step 01

## Acceptance Criteria

- [x] Checked criterion 1
- [x] Checked criterion 2
`);

            const result = await completeStep(plan, 1);
            expect(result.status).toBe('completed');
        });

        it('should set completedAt timestamp', async () => {
            const plan = createTestPlan(`# Step 01`);

            const result = await completeStep(plan, 1);
            expect(result.completedAt).toBeInstanceOf(Date);
        });

        it('should preserve notes', async () => {
            const plan = createTestPlan(`# Step 01`);

            const result = await completeStep(plan, 1, { notes: 'Test notes' });
            expect(result.notes).toBe('Test notes');
        });
    });

    describe('error handling', () => {
        it('should throw error for non-existent step', async () => {
            const plan = createTestPlan(`# Step 01`);

            await expect(completeStep(plan, 99)).rejects.toThrow('Step 99 not found');
        });
    });
});
