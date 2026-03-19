/**
 * Tests for Retrospective Reference Reader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
    loadRetrospectiveAsContext,
    retrospectiveExists,
    loadMultipleRetrospectives,
} from '../src/retrospective/reference.js';
import { createTestPlan } from './helpers/create-test-plan.js';

describe('Retrospective Reference Reader', () => {
    let planPath: string;

    beforeEach(async () => {
        planPath = await createTestPlan({
            id: 'retro-ref-test',
            name: 'Test Plan',
            steps: [],
        });
    });

    afterEach(async () => {
        try {
            await rm(dirname(planPath), { recursive: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('loadRetrospectiveAsContext', () => {
        it('should load and wrap retrospective with context', async () => {
            const retroContent = `# Plan Retrospective

## What Went Right

- Tests passed on first try
- Code was clean and maintainable

## What Went Wrong

- Underestimated complexity of middleware
- Session timeout logic was tricky

## Lessons Learned

- Do upfront dependency analysis
- Test edge cases early`;

            const planWithRetro = await createTestPlan({
                id: 'plan-with-retro',
                name: 'Plan With Retro',
                steps: [],
                files: [
                    { type: 'other', filename: 'RETROSPECTIVE.md', content: retroContent },
                ],
            });

            const result = await loadRetrospectiveAsContext(
                planWithRetro,
                'Similar authentication approach'
            );

            expect(result).toContain(planWithRetro);
            expect(result).toContain('Similar authentication approach');
            expect(result).toContain('What Went Right');
            expect(result).toContain('What Went Wrong');
            expect(result).toContain('Lessons Learned');
            expect(result).toContain('Consider the lessons above');
            expect(result).toContain('What patterns from that experience apply here?');
            expect(result).toContain('What mistakes should be avoided?');

            await rm(dirname(planWithRetro), { recursive: true }).catch(() => {});
        });

        it('should throw error if retrospective does not exist', async () => {
            await expect(
                loadRetrospectiveAsContext(planPath, 'Test reason')
            ).rejects.toThrow('Retrospective not found');
        });

        it('should include full context wrapping', async () => {
            const planWithRetro = await createTestPlan({
                id: 'plan-context-wrap',
                name: 'Context Plan',
                steps: [],
                files: [
                    { type: 'other', filename: 'RETROSPECTIVE.md', content: 'Test retrospective content' },
                ],
            });

            const result = await loadRetrospectiveAsContext(
                planWithRetro,
                'Testing context wrapping'
            );

            expect(result).toContain('## Referenced Retrospective');
            expect(result).toContain('**Source**:');
            expect(result).toContain('**Why this is relevant**:');
            expect(result).toContain('---');
            expect(result).toContain('Test retrospective content');

            await rm(dirname(planWithRetro), { recursive: true }).catch(() => {});
        });
    });

    describe('retrospectiveExists', () => {
        it('should return true when retrospective exists', async () => {
            const planWithRetro = await createTestPlan({
                id: 'retro-exists',
                name: 'Retro Exists',
                steps: [],
                files: [
                    { type: 'other', filename: 'RETROSPECTIVE.md', content: 'Test content' },
                ],
            });

            await expect(retrospectiveExists(planWithRetro)).resolves.toBe(true);

            await rm(dirname(planWithRetro), { recursive: true }).catch(() => {});
        });

        it('should return false when retrospective does not exist', async () => {
            await expect(retrospectiveExists(planPath)).resolves.toBe(false);
        });
    });

    describe('loadMultipleRetrospectives', () => {
        it('should load and combine multiple retrospectives', async () => {
            const plan1Path = await createTestPlan({
                id: 'plan-1',
                name: 'Plan 1',
                steps: [],
                files: [
                    { type: 'other', filename: 'RETROSPECTIVE.md', content: '# Plan 1 Retrospective\n\nLessons from plan 1' },
                ],
            });

            const plan2Path = await createTestPlan({
                id: 'plan-2',
                name: 'Plan 2',
                steps: [],
                files: [
                    { type: 'other', filename: 'RETROSPECTIVE.md', content: '# Plan 2 Retrospective\n\nLessons from plan 2' },
                ],
            });

            const result = await loadMultipleRetrospectives([
                { path: plan1Path, reason: 'Similar architecture' },
                { path: plan2Path, reason: 'Related API design' },
            ]);

            expect(result).toContain('Plan 1 Retrospective');
            expect(result).toContain('Plan 2 Retrospective');
            expect(result).toContain('Similar architecture');
            expect(result).toContain('Related API design');
            expect(result).toContain(plan1Path);
            expect(result).toContain(plan2Path);
            expect(result).toContain('---');

            await rm(dirname(plan1Path), { recursive: true }).catch(() => {});
            await rm(dirname(plan2Path), { recursive: true }).catch(() => {});
        });

        it('should handle empty array', async () => {
            const result = await loadMultipleRetrospectives([]);
            expect(result).toBe('');
        });

        it('should fail if any retrospective is missing', async () => {
            const plan1Path = await createTestPlan({
                id: 'plan-with-retro',
                name: 'Plan With Retro',
                steps: [],
                files: [
                    { type: 'other', filename: 'RETROSPECTIVE.md', content: 'Test content' },
                ],
            });

            const plan2Path = await createTestPlan({
                id: 'plan-without-retro',
                name: 'Plan Without Retro',
                steps: [],
            });

            await expect(
                loadMultipleRetrospectives([
                    { path: plan1Path, reason: 'Reason 1' },
                    { path: plan2Path, reason: 'Reason 2' },
                ])
            ).rejects.toThrow('Retrospective not found');

            await rm(dirname(plan1Path), { recursive: true }).catch(() => {});
            await rm(dirname(plan2Path), { recursive: true }).catch(() => {});
        });
    });

    describe('context framing', () => {
        it('should format context with proper markdown structure', async () => {
            const planWithRetro = await createTestPlan({
                id: 'retro-format',
                name: 'Format Plan',
                steps: [],
                files: [
                    { type: 'other', filename: 'RETROSPECTIVE.md', content: '# Test Retrospective' },
                ],
            });

            const result = await loadRetrospectiveAsContext(
                planWithRetro,
                'Test reason'
            );

            const lines = result.split('\n');
            expect(lines[0]).toBe('## Referenced Retrospective');
            expect(lines[1]).toBe('');
            expect(lines[2]).toContain('**Source**:');
            expect(lines[3]).toContain('**Why this is relevant**:');

            await rm(dirname(planWithRetro), { recursive: true }).catch(() => {});
        });

        it('should include guiding questions for exploration', async () => {
            const planWithRetro = await createTestPlan({
                id: 'retro-questions',
                name: 'Questions Plan',
                steps: [],
                files: [
                    { type: 'other', filename: 'RETROSPECTIVE.md', content: 'Content' },
                ],
            });

            const result = await loadRetrospectiveAsContext(
                planWithRetro,
                'Reason'
            );

            expect(result).toContain('What patterns from that experience apply here?');
            expect(result).toContain('What mistakes should be avoided?');
            expect(result).toContain('What assumptions were wrong that might be wrong again?');
            expect(result).toContain('What worked well that could be reused?');

            await rm(dirname(planWithRetro), { recursive: true }).catch(() => {});
        });
    });
});
