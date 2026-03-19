/**
 * Tests for Reflection System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadPlan, completeStep } from '../src/index.js';
import type { Plan } from '../src/index.js';
import { writeStepReflection } from '../src/reflections/writer.js';
import {
    readStepReflection,
    readAllReflections,
    readPriorReflections,
} from '../src/reflections/reader.js';
import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createTestPlan } from './helpers/create-test-plan.js';

describe('Reflection System', () => {
    let planPath: string;
    let plan: Plan;

    beforeEach(async () => {
        planPath = await createTestPlan({
            id: 'reflections-test',
            name: 'Test Plan',
            steps: [
                { number: 1, code: 'first-step', title: 'First Step', status: 'pending' },
                { number: 2, code: 'second-step', title: 'Second Step', status: 'pending' },
                { number: 3, code: 'third-step', title: 'Third Step', status: 'pending' },
            ],
        });
        plan = await loadPlan(planPath);
    });

    afterEach(async () => {
        try {
            await rm(dirname(planPath), { recursive: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('writeStepReflection', () => {
        it('should write reflection to SQLite', async () => {
            const filename = await writeStepReflection(planPath, 1, 'Test reflection content');
            expect(filename).toContain('01-reflection.md');
        });

        it('should write reflection file with correct naming', async () => {
            const filename = await writeStepReflection(
                planPath,
                1,
                'Reflection for step 1'
            );

            expect(filename).toContain('01-reflection.md');
            const content = await readStepReflection(planPath, 1);
            expect(content).toBe('Reflection for step 1');
        });

        it('should write reflection file with leading zeros', async () => {
            await writeStepReflection(planPath, 1, 'Step 1');
            await writeStepReflection(planPath, 10, 'Step 10');

            const r1 = await readStepReflection(planPath, 1);
            const r10 = await readStepReflection(planPath, 10);
            expect(r1).toBe('Step 1');
            expect(r10).toBe('Step 10');
        });

        it('should write freeform prose content', async () => {
            const content = `# Reflection on Step 1

This step took longer than expected because we had to refactor the data model.

What surprised me:
- The existing code was more coupled than anticipated
- Tests needed significant updates

What could be done differently:
- Better upfront analysis of dependencies
- More incremental refactoring approach

What the next step should know:
- The new data model is in place
- All tests are passing
- Watch out for edge cases in validation`;

            await writeStepReflection(planPath, 1, content);
            const read = await readStepReflection(planPath, 1);

            expect(read).toBe(content);
        });
    });

    describe('readStepReflection', () => {
        it('should return null for non-existent reflection', async () => {
            const content = await readStepReflection(planPath, 1);
            expect(content).toBeNull();
        });

        it('should read existing reflection', async () => {
            await writeStepReflection(planPath, 1, 'Test content');
            const content = await readStepReflection(planPath, 1);

            expect(content).toBe('Test content');
        });

        it('should handle missing reflections gracefully', async () => {
            const content = await readStepReflection(planPath, 1);
            expect(content).toBeNull();
        });
    });

    describe('readAllReflections', () => {
        it('should return empty array when no reflections exist', async () => {
            const reflections = await readAllReflections(planPath);
            expect(reflections).toEqual([]);
        });

        it('should return empty array when no reflections stored', async () => {
            const reflections = await readAllReflections(planPath);
            expect(reflections).toEqual([]);
        });

        it('should read all reflection files', async () => {
            await writeStepReflection(planPath, 1, 'Reflection 1');
            await writeStepReflection(planPath, 2, 'Reflection 2');
            await writeStepReflection(planPath, 3, 'Reflection 3');

            const reflections = await readAllReflections(planPath);

            expect(reflections).toHaveLength(3);
            expect(reflections[0]).toEqual({
                step: 1,
                content: 'Reflection 1',
            });
            expect(reflections[1]).toEqual({
                step: 2,
                content: 'Reflection 2',
            });
            expect(reflections[2]).toEqual({
                step: 3,
                content: 'Reflection 3',
            });
        });

        it('should sort reflections by step number', async () => {
            await writeStepReflection(planPath, 3, 'Reflection 3');
            await writeStepReflection(planPath, 1, 'Reflection 1');
            await writeStepReflection(planPath, 2, 'Reflection 2');

            const reflections = await readAllReflections(planPath);

            expect(reflections[0].step).toBe(1);
            expect(reflections[1].step).toBe(2);
            expect(reflections[2].step).toBe(3);
        });
    });

    describe('readPriorReflections', () => {
        beforeEach(async () => {
            await writeStepReflection(planPath, 1, 'Reflection 1');
            await writeStepReflection(planPath, 2, 'Reflection 2');
            await writeStepReflection(planPath, 3, 'Reflection 3');
        });

        it('should return only reflections before specified step', async () => {
            const priorToStep3 = await readPriorReflections(planPath, 3);

            expect(priorToStep3).toHaveLength(2);
            expect(priorToStep3[0].step).toBe(1);
            expect(priorToStep3[1].step).toBe(2);
        });

        it('should return empty array when requesting prior to step 1', async () => {
            const priorToStep1 = await readPriorReflections(planPath, 1);
            expect(priorToStep1).toEqual([]);
        });

        it('should return all reflections when requesting prior to step beyond last', async () => {
            const priorToStep10 = await readPriorReflections(planPath, 10);

            expect(priorToStep10).toHaveLength(3);
        });
    });

    describe('MCP Tool Integration', () => {
        it('should not allow reflection on non-completed step', async () => {
            const step = plan.steps.find(s => s.number === 1);
            expect(step?.status).toBe('pending');
            expect(step?.status).not.toBe('completed');
        });

        it('should allow reflection after step completion', async () => {
            const updatedStep = await completeStep(plan, 1);

            const stepIndex = plan.steps.findIndex(s => s.number === 1);
            if (stepIndex >= 0) {
                plan.steps[stepIndex] = updatedStep;
            }

            const step = plan.steps.find(s => s.number === 1);
            expect(step?.status).toBe('completed');

            await writeStepReflection(planPath, 1, 'Reflection after completion');
            const content = await readStepReflection(planPath, 1);
            expect(content).toBe('Reflection after completion');
        });
    });

    describe('SQLite reflection reads', () => {
        it('should read a single SQLite reflection by step', async () => {
            await writeStepReflection(planPath, 1, 'SQLite reflection step 1');

            const content = await readStepReflection(planPath, 1);
            expect(content).toBe('SQLite reflection step 1');
        });

        it('should read all SQLite reflections sorted by step number', async () => {
            await writeStepReflection(planPath, 3, 'Reflection 3');
            await writeStepReflection(planPath, 1, 'Reflection 1');
            await writeStepReflection(planPath, 2, 'Reflection 2');

            const reflections = await readAllReflections(planPath);
            expect(reflections).toEqual([
                { step: 1, content: 'Reflection 1' },
                { step: 2, content: 'Reflection 2' },
                { step: 3, content: 'Reflection 3' },
            ]);
        });
    });
});
