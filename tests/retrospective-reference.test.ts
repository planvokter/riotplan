/**
 * Tests for Retrospective Reference Reader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    loadRetrospectiveAsContext,
    retrospectiveExists,
    loadMultipleRetrospectives,
} from '../src/retrospective/reference.js';

describe('Retrospective Reference Reader', () => {
    let testDir: string;
    let planPath: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `riotplan-retro-ref-test-${Date.now()}`);
        planPath = join(testDir, 'test-plan');
        await mkdir(planPath, { recursive: true });
    });

    afterEach(async () => {
        try {
            await rm(testDir, { recursive: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('loadRetrospectiveAsContext', () => {
        it('should load and wrap retrospective with context', async () => {
            // Create a sample retrospective
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

            await writeFile(
                join(planPath, 'retrospective.md'),
                retroContent,
                'utf-8'
            );

            const result = await loadRetrospectiveAsContext(
                planPath,
                'Similar authentication approach'
            );

            // Should include source path
            expect(result).toContain(planPath);
            
            // Should include reason
            expect(result).toContain('Similar authentication approach');
            
            // Should include original content
            expect(result).toContain('What Went Right');
            expect(result).toContain('What Went Wrong');
            expect(result).toContain('Lessons Learned');
            
            // Should include framing questions
            expect(result).toContain('Consider the lessons above');
            expect(result).toContain('What patterns from that experience apply here?');
            expect(result).toContain('What mistakes should be avoided?');
        });

        it('should throw error if retrospective does not exist', async () => {
            await expect(
                loadRetrospectiveAsContext(planPath, 'Test reason')
            ).rejects.toThrow('Retrospective not found');
        });

        it('should include full context wrapping', async () => {
            const retroContent = 'Test retrospective content';
            await writeFile(
                join(planPath, 'retrospective.md'),
                retroContent,
                'utf-8'
            );

            const result = await loadRetrospectiveAsContext(
                planPath,
                'Testing context wrapping'
            );

            // Check for all required sections
            expect(result).toContain('## Referenced Retrospective');
            expect(result).toContain('**Source**:');
            expect(result).toContain('**Why this is relevant**:');
            expect(result).toContain('---');
            expect(result).toContain('Test retrospective content');
        });
    });

    describe('retrospectiveExists', () => {
        it('should return true when retrospective exists', async () => {
            await writeFile(
                join(planPath, 'retrospective.md'),
                'Test content',
                'utf-8'
            );

            expect(retrospectiveExists(planPath)).toBe(true);
        });

        it('should return false when retrospective does not exist', () => {
            expect(retrospectiveExists(planPath)).toBe(false);
        });
    });

    describe('loadMultipleRetrospectives', () => {
        it('should load and combine multiple retrospectives', async () => {
            // Create two plans with retrospectives
            const plan1Path = join(testDir, 'plan-1');
            const plan2Path = join(testDir, 'plan-2');
            
            await mkdir(plan1Path, { recursive: true });
            await mkdir(plan2Path, { recursive: true });

            await writeFile(
                join(plan1Path, 'retrospective.md'),
                '# Plan 1 Retrospective\n\nLessons from plan 1',
                'utf-8'
            );

            await writeFile(
                join(plan2Path, 'retrospective.md'),
                '# Plan 2 Retrospective\n\nLessons from plan 2',
                'utf-8'
            );

            const result = await loadMultipleRetrospectives([
                { path: plan1Path, reason: 'Similar architecture' },
                { path: plan2Path, reason: 'Related API design' },
            ]);

            // Should include both retrospectives
            expect(result).toContain('Plan 1 Retrospective');
            expect(result).toContain('Plan 2 Retrospective');
            
            // Should include both reasons
            expect(result).toContain('Similar architecture');
            expect(result).toContain('Related API design');
            
            // Should include both paths
            expect(result).toContain(plan1Path);
            expect(result).toContain(plan2Path);
            
            // Should have separator between them
            expect(result).toContain('---');
        });

        it('should handle empty array', async () => {
            const result = await loadMultipleRetrospectives([]);
            expect(result).toBe('');
        });

        it('should fail if any retrospective is missing', async () => {
            const plan1Path = join(testDir, 'plan-1');
            const plan2Path = join(testDir, 'plan-2-missing');
            
            await mkdir(plan1Path, { recursive: true });
            await writeFile(
                join(plan1Path, 'retrospective.md'),
                'Test content',
                'utf-8'
            );

            await expect(
                loadMultipleRetrospectives([
                    { path: plan1Path, reason: 'Reason 1' },
                    { path: plan2Path, reason: 'Reason 2' },
                ])
            ).rejects.toThrow('Retrospective not found');
        });
    });

    describe('context framing', () => {
        it('should format context with proper markdown structure', async () => {
            await writeFile(
                join(planPath, 'retrospective.md'),
                '# Test Retrospective',
                'utf-8'
            );

            const result = await loadRetrospectiveAsContext(
                planPath,
                'Test reason'
            );

            // Check markdown structure
            const lines = result.split('\n');
            expect(lines[0]).toBe('## Referenced Retrospective');
            expect(lines[1]).toBe('');
            expect(lines[2]).toContain('**Source**:');
            expect(lines[3]).toContain('**Why this is relevant**:');
        });

        it('should include guiding questions for exploration', async () => {
            await writeFile(
                join(planPath, 'retrospective.md'),
                'Content',
                'utf-8'
            );

            const result = await loadRetrospectiveAsContext(
                planPath,
                'Reason'
            );

            // Check for all guiding questions
            expect(result).toContain('What patterns from that experience apply here?');
            expect(result).toContain('What mistakes should be avoided?');
            expect(result).toContain('What assumptions were wrong that might be wrong again?');
            expect(result).toContain('What worked well that could be reused?');
        });
    });
});
