/**
 * Tests for VerificationEngine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VerificationEngine } from '../../src/verification/engine.js';
import type { Plan, PlanStep } from '../../src/types.js';

describe('VerificationEngine', () => {
    let tempDir: string;
    let engine: VerificationEngine;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'riotplan-test-'));
        engine = new VerificationEngine();
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    function createMockPlan(steps: Partial<PlanStep>[]): Plan {
        return {
            metadata: {
                code: 'test-plan',
                name: 'Test Plan',
                path: tempDir,
            },
            files: {},
            steps: steps.map((s, i) => ({
                number: i + 1,
                code: s.code || `step-${i + 1}`,
                filename: s.filename || `0${i + 1}-step.md`,
                title: s.title || `Step ${i + 1}`,
                status: s.status || 'pending',
                filePath: s.filePath || join(tempDir, `0${i + 1}-step.md`),
                ...s,
            })) as PlanStep[],
            state: {
                status: 'pending',
                lastUpdatedAt: new Date(),
                blockers: [],
                issues: [],
                progress: 0,
            },
        } as Plan;
    }

    describe('verifyStepCompletion', () => {
        it('should pass when all acceptance criteria are checked', async () => {
            const stepFile = join(tempDir, '01-step.md');
            writeFileSync(
                stepFile,
                `# Step 01

## Acceptance Criteria

- [x] Criterion 1
- [x] Criterion 2
- [x] Criterion 3
`
            );

            const plan = createMockPlan([{ filePath: stepFile }]);

            const result = await engine.verifyStepCompletion(plan, 1, {
                enforcement: 'interactive',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(result.isValid).toBe(true);
            expect(result.level).toBe('passed');
            expect(result.acceptanceCriteria).toHaveLength(3);
            expect(result.acceptanceCriteria?.every((c) => c.checked)).toBe(true);
            expect(result.messages).toContain('✓ All 3 acceptance criteria checked');
        });

        it('should fail when acceptance criteria are unchecked', async () => {
            const stepFile = join(tempDir, '01-step.md');
            writeFileSync(
                stepFile,
                `# Step 01

## Acceptance Criteria

- [x] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
`
            );

            const plan = createMockPlan([{ filePath: stepFile }]);

            const result = await engine.verifyStepCompletion(plan, 1, {
                enforcement: 'interactive',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(result.isValid).toBe(false);
            expect(result.level).toBe('error');
            expect(result.acceptanceCriteria).toHaveLength(3);
            expect(result.messages[0]).toContain('2 acceptance criteria not checked');
            expect(result.messages).toContain('  - [ ] Criterion 2');
            expect(result.messages).toContain('  - [ ] Criterion 3');
        });

        it('should warn when no acceptance criteria found', async () => {
            const stepFile = join(tempDir, '01-step.md');
            writeFileSync(
                stepFile,
                `# Step 01

## Tasks

Do some work
`
            );

            const plan = createMockPlan([{ filePath: stepFile }]);

            const result = await engine.verifyStepCompletion(plan, 1, {
                enforcement: 'interactive',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(result.isValid).toBe(true);
            expect(result.level).toBe('warning');
            expect(result.acceptanceCriteria).toHaveLength(0);
            expect(result.messages).toContain('No acceptance criteria found in step file');
        });

        it('should handle uppercase X in checkboxes', async () => {
            const stepFile = join(tempDir, '01-step.md');
            writeFileSync(
                stepFile,
                `# Step 01

## Acceptance Criteria

- [X] Criterion 1
- [x] Criterion 2
`
            );

            const plan = createMockPlan([{ filePath: stepFile }]);

            const result = await engine.verifyStepCompletion(plan, 1, {
                enforcement: 'interactive',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(result.isValid).toBe(true);
            expect(result.level).toBe('passed');
            expect(result.acceptanceCriteria).toHaveLength(2);
            expect(result.acceptanceCriteria?.every((c) => c.checked)).toBe(true);
        });

        it('should skip criteria checking when disabled', async () => {
            const stepFile = join(tempDir, '01-step.md');
            writeFileSync(
                stepFile,
                `# Step 01

## Acceptance Criteria

- [ ] Unchecked criterion
`
            );

            const plan = createMockPlan([{ filePath: stepFile }]);

            const result = await engine.verifyStepCompletion(plan, 1, {
                enforcement: 'interactive',
                checkAcceptanceCriteria: false,
                checkArtifacts: false,
            });

            expect(result.isValid).toBe(true);
            expect(result.level).toBe('passed');
            expect(result.acceptanceCriteria).toBeUndefined();
            expect(result.messages).toHaveLength(0);
        });

        it('should return error when step not found', async () => {
            const plan = createMockPlan([]);

            const result = await engine.verifyStepCompletion(plan, 1, {
                enforcement: 'interactive',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(result.isValid).toBe(false);
            expect(result.level).toBe('error');
            expect(result.messages).toContain('Step 1 not found in plan');
        });
    });

    describe('shouldBlock', () => {
        it('should not block when force flag is set', () => {
            const result: VerificationResult = {
                isValid: false,
                level: 'error',
                messages: ['Error message'],
            };

            const shouldBlock = engine.shouldBlock(result, {
                enforcement: 'strict',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
                force: true,
            });

            expect(shouldBlock).toBe(false);
        });

        it('should not block in advisory mode', () => {
            const result: VerificationResult = {
                isValid: false,
                level: 'error',
                messages: ['Error message'],
            };

            const shouldBlock = engine.shouldBlock(result, {
                enforcement: 'advisory',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(shouldBlock).toBe(false);
        });

        it('should block in strict mode with errors', () => {
            const result: VerificationResult = {
                isValid: false,
                level: 'error',
                messages: ['Error message'],
            };

            const shouldBlock = engine.shouldBlock(result, {
                enforcement: 'strict',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(shouldBlock).toBe(true);
        });

        it('should not block in strict mode with warnings', () => {
            const result: VerificationResult = {
                isValid: true,
                level: 'warning',
                messages: ['Warning message'],
            };

            const shouldBlock = engine.shouldBlock(result, {
                enforcement: 'strict',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(shouldBlock).toBe(false);
        });

        it('should not block in interactive mode', () => {
            const result: VerificationResult = {
                isValid: false,
                level: 'error',
                messages: ['Error message'],
            };

            const shouldBlock = engine.shouldBlock(result, {
                enforcement: 'interactive',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            });

            expect(shouldBlock).toBe(false);
        });
    });
});
