/**
 * Tests for Retrospective Generator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPlan, completeStep, startStep } from '../src/index.js';
import {
    loadRetrospectiveContext,
    formatRetrospectivePrompt,
    generateRetrospective,
} from '../src/retrospective/generator.js';
import { writeStepReflection } from '../src/reflections/writer.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Retrospective Generator', () => {
    let testDir: string;
    let planPath: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'riotplan-retro-test-'));
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
    });

    afterEach(async () => {
        try {
            await rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('loadRetrospectiveContext', () => {
        it('should load plan and reflections', async () => {
            // Complete a step and add reflection
            const step1 = completeStep(await import('../src/index.js').then(m => m.loadPlan(planPath)), 1);
            await writeStepReflection(
                planPath,
                1,
                'Reflection for step 1'
            );

            const context = await loadRetrospectiveContext(planPath);

            expect(context.plan).toBeDefined();
            expect(context.plan.metadata.name).toBe('Test Plan');
            expect(context.reflections).toHaveLength(1);
            expect(context.reflections[0].content).toBe('Reflection for step 1');
        });

        it('should load plan files if they exist', async () => {
            const context = await loadRetrospectiveContext(planPath);

            expect(context.summary).toBeDefined();
            expect(context.executionPlan).toBeDefined();
            expect(context.status).toBeDefined();
        });

        it('should load step files', async () => {
            const context = await loadRetrospectiveContext(planPath);

            expect(context.stepFiles).toHaveLength(3);
            expect(context.stepFiles[0].number).toBe(1);
            expect(context.stepFiles[0].title).toContain('First Step');
        });

        it('should handle plans without reflections', async () => {
            const context = await loadRetrospectiveContext(planPath);

            expect(context.reflections).toHaveLength(0);
        });
    });

    describe('formatRetrospectivePrompt', () => {
        it('should format prompt with all context', async () => {
            await writeStepReflection(planPath, 1, 'Test reflection');
            const context = await loadRetrospectiveContext(planPath);

            const prompt = formatRetrospectivePrompt(context);

            expect(prompt).toContain('Test Plan');
            expect(prompt).toContain('SUMMARY.md');
            expect(prompt).toContain('EXECUTION_PLAN.md');
            expect(prompt).toContain('STATUS.md');
            expect(prompt).toContain('Step 1 Reflection');
            expect(prompt).toContain('Test reflection');
        });

        it('should note when no reflections exist', async () => {
            const context = await loadRetrospectiveContext(planPath);

            const prompt = formatRetrospectivePrompt(context);

            expect(prompt).toContain('No step reflections were captured');
        });

        it('should include all step files', async () => {
            const context = await loadRetrospectiveContext(planPath);

            const prompt = formatRetrospectivePrompt(context);

            expect(prompt).toContain('First Step');
            expect(prompt).toContain('Second Step');
            expect(prompt).toContain('Third Step');
        });
    });

    describe('generateRetrospective', () => {
        it('should throw error if plan not completed', async () => {
            await expect(
                generateRetrospective(planPath)
            ).rejects.toThrow('Plan is not completed');
        });

        it('should succeed with force flag even if not completed', async () => {
            const result = await generateRetrospective(planPath, {
                force: true,
            });

            expect(result.context).toBeDefined();
            expect(result.prompt).toBeDefined();
        });

        it('should succeed for completed plan', async () => {
            // Complete all steps
            const { loadPlan } = await import('../src/index.js');
            let plan = await loadPlan(planPath);
            
            for (let i = 1; i <= 3; i++) {
                const updatedStep = completeStep(plan, i);
                const stepIndex = plan.steps.findIndex(s => s.number === i);
                if (stepIndex >= 0) {
                    plan.steps[stepIndex] = updatedStep;
                }
            }

            const result = await generateRetrospective(planPath, {
                force: true,
            });

            expect(result.context).toBeDefined();
            expect(result.prompt).toBeDefined();
            expect(result.context.plan.metadata.name).toBe('Test Plan');
        });

        it('should warn if no reflections exist', async () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn');

            await generateRetrospective(planPath, { force: true });

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('No step reflections found')
            );

            consoleWarnSpy.mockRestore();
        });
    });
});
