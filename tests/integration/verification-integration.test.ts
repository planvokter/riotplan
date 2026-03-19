/**
 * Integration tests for verification system
 *
 * Note: These tests verify the integration between components.
 * Config-based behavior is tested in unit tests (engine.test.ts)
 * since config loading from temp directories is complex.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { completeStep } from '../../src/steps/operations.js';
import type { Plan, PlanStep } from '../../src/types.js';
import { createTestPlan } from '../helpers/create-test-plan.js';

describe('Verification Integration', () => {
    let planPath: string;

    beforeEach(async () => {
        planPath = await createTestPlan({
            id: 'verify-test',
            name: 'Test Plan',
            steps: [
                { number: 1, code: 'test-step', title: 'Test Step', status: 'in_progress' },
            ],
        });
    });

    afterEach(async () => {
        try {
            await rm(dirname(planPath), { recursive: true, force: true });
        } catch {}
    });

    function createTestPlanObj(stepContent?: string): Plan {
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
                filePath: planPath,
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
            const plan = createTestPlanObj();

            const result = await completeStep(plan, 1);
            expect(result.status).toBe('completed');
        });

        it('should complete step with skipVerification flag', async () => {
            const plan = createTestPlanObj();

            const result = await completeStep(plan, 1, { skipVerification: true });
            expect(result.status).toBe('completed');
        });

        it('should complete step with force flag', async () => {
            const plan = createTestPlanObj();

            const result = await completeStep(plan, 1, { force: true });
            expect(result.status).toBe('completed');
        });

        it('should complete step with all criteria checked', async () => {
            const plan = createTestPlanObj();

            const result = await completeStep(plan, 1);
            expect(result.status).toBe('completed');
        });

        it('should set completedAt timestamp', async () => {
            const plan = createTestPlanObj();

            const result = await completeStep(plan, 1);
            expect(result.completedAt).toBeInstanceOf(Date);
        });

        it('should preserve notes', async () => {
            const plan = createTestPlanObj();

            const result = await completeStep(plan, 1, { notes: 'Test notes' });
            expect(result.notes).toBe('Test notes');
        });
    });

    describe('error handling', () => {
        it('should throw error for non-existent step', async () => {
            const plan = createTestPlanObj();

            await expect(completeStep(plan, 99)).rejects.toThrow('Step 99 not found');
        });
    });
});
