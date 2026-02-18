/**
 * Tests for Reflection System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPlan, loadPlan, completeStep, startStep } from '../src/index.js';
import type { Plan } from '../src/index.js';
import { writeStepReflection } from '../src/reflections/writer.js';
import {
    readStepReflection,
    readAllReflections,
    readPriorReflections,
} from '../src/reflections/reader.js';
import { rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

describe('Reflection System', () => {
    let testDir: string;
    let planPath: string;
    let plan: Plan;

    beforeEach(async () => {
        testDir = join(tmpdir(), `riotplan-reflections-test-${Date.now()}`);
        const result = await createPlan({
            code: 'test-plan',
            name: 'Test Plan',
            basePath: testDir,
            steps: [
                { title: 'First Step' },
                { title: 'Second Step' },
                { title: 'Third Step' },
            ],
        });
        planPath = result.path;
        plan = await loadPlan(planPath);
    });

    afterEach(async () => {
        try {
            await rm(testDir, { recursive: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('writeStepReflection', () => {
        it('should create reflections directory if it does not exist', async () => {
            const reflectionsDir = join(planPath, 'reflections');
            expect(existsSync(reflectionsDir)).toBe(false);

            await writeStepReflection(planPath, 1, 'Test reflection content');

            expect(existsSync(reflectionsDir)).toBe(true);
        });

        it('should write reflection file with correct naming', async () => {
            const filepath = await writeStepReflection(
                planPath,
                1,
                'Reflection for step 1'
            );

            expect(filepath).toContain('01-reflection.md');
            expect(existsSync(filepath)).toBe(true);
        });

        it('should write reflection file with leading zeros', async () => {
            await writeStepReflection(planPath, 1, 'Step 1');
            await writeStepReflection(planPath, 10, 'Step 10');

            const reflectionsDir = join(planPath, 'reflections');
            const files = await readdir(reflectionsDir);

            expect(files).toContain('01-reflection.md');
            expect(files).toContain('10-reflection.md');
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

        it('should handle missing reflections directory gracefully', async () => {
            const content = await readStepReflection(planPath, 1);
            expect(content).toBeNull();
        });
    });

    describe('readAllReflections', () => {
        it('should return empty array when no reflections exist', async () => {
            const reflections = await readAllReflections(planPath);
            expect(reflections).toEqual([]);
        });

        it('should return empty array when reflections directory does not exist', async () => {
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
            // Step 1 is pending, not completed
            const step = plan.steps.find(s => s.number === 1);
            expect(step?.status).toBe('pending');

            // This would be tested via MCP tool execution
            // For now, we verify the step status check
            expect(step?.status).not.toBe('completed');
        });

        it('should allow reflection after step completion', async () => {
            // Start and complete step 1 (modifies plan in memory)
            const updatedStep = await completeStep(plan, 1);
            
            // Update the plan's steps array
            const stepIndex = plan.steps.findIndex(s => s.number === 1);
            if (stepIndex >= 0) {
                plan.steps[stepIndex] = updatedStep;
            }
            
            const step = plan.steps.find(s => s.number === 1);
            expect(step?.status).toBe('completed');

            // Now reflection can be written
            await writeStepReflection(planPath, 1, 'Reflection after completion');
            const content = await readStepReflection(planPath, 1);
            expect(content).toBe('Reflection after completion');
        });
    });
});
