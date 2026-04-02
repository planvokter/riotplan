import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile, access } from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
    access: vi.fn(),
}));

import {
    parseCriteriaFromContent,
    getCriteriaSummary,
    parseCriteria,
} from '../src/criteria-parser.js';
import {
    VerificationError,
    AcceptanceCriteriaError,
    ArtifactVerificationError,
} from '../src/errors.js';
import {
    PRIORITY_WEIGHTS,
    CRITERIA_PATTERNS,
    HEALTH_THRESHOLDS,
} from '../src/constants.js';
import {
    VerificationEngine,
    type VerificationResult,
    type VerificationOptions,
} from '../src/engine.js';
import type { VerificationCriterion } from '../src/types.js';

describe('parseCriteriaFromContent', () => {
    it('returns empty criteria with parseError when no Verification Criteria section found', () => {
        const content = `# Some Document

## Other Section
- [ ] Some item
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toEqual([]);
        expect(result.source).toBe('test.md');
        expect(result.parseErrors).toContain("No 'Verification Criteria' section found");
    });

    it('returns parseError when section found but no checkbox items', () => {
        const content = `## Verification Criteria

Some text without checkboxes.
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toEqual([]);
        expect(result.source).toBe('test.md');
        expect(result.parseErrors).toContain(
            'No checkbox criteria found in Verification Criteria section'
        );
    });

    it('parses checkbox items with default "should" priority when no subsection', () => {
        const content = `## Verification Criteria

- [ ] First criterion
- [x] Second criterion (checked)
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toHaveLength(2);
        expect(result.criteria[0]).toMatchObject({
            text: 'First criterion',
            priority: 'should',
            source: 'test.md',
        });
        expect(result.criteria[1]).toMatchObject({
            text: 'Second criterion (checked)',
            priority: 'should',
            source: 'test.md',
        });
        expect(result.parseErrors).toEqual([]);
    });

    it('parses Must Have subsection', () => {
        const content = `## Verification Criteria

### Must Have
- [ ] Critical requirement
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toHaveLength(1);
        expect(result.criteria[0]).toMatchObject({
            text: 'Critical requirement',
            priority: 'must',
        });
    });

    it('parses Should Have subsection', () => {
        const content = `## Verification Criteria

### Should Have
- [ ] Important requirement
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toHaveLength(1);
        expect(result.criteria[0]).toMatchObject({
            text: 'Important requirement',
            priority: 'should',
        });
    });

    it('parses Could Have subsection', () => {
        const content = `## Verification Criteria

### Could Have
- [ ] Nice to have
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toHaveLength(1);
        expect(result.criteria[0]).toMatchObject({
            text: 'Nice to have',
            priority: 'could',
        });
    });

    it('parses multiple priority sections', () => {
        const content = `## Verification Criteria

### Must Have
- [ ] Must item 1

### Should Have
- [ ] Should item 1

### Could Have
- [ ] Could item 1
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toHaveLength(3);
        expect(result.criteria[0].priority).toBe('must');
        expect(result.criteria[1].priority).toBe('should');
        expect(result.criteria[2].priority).toBe('could');
    });

    it('generates IDs like 001-slug-of-text', () => {
        const content = `## Verification Criteria

- [ ] User can log in
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria[0].id).toMatch(/^\d{3}-[a-z0-9-]+$/);
        expect(result.criteria[0].id).toContain('user-can-log-in');
    });

    it('stops at next ## header after verification section', () => {
        const content = `## Verification Criteria

- [ ] In section

## Next Section
- [ ] Should not be included
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toHaveLength(1);
        expect(result.criteria[0].text).toBe('In section');
    });

    it('accepts ## Verification Criteria (case insensitive)', () => {
        const content = `## verification criteria

- [ ] Item
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toHaveLength(1);
    });

    it('parses asterisk list items', () => {
        const content = `## Verification Criteria

* [ ] Asterisk item
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria).toHaveLength(1);
        expect(result.criteria[0].text).toBe('Asterisk item');
    });

    it('includes lineNumber for each criterion', () => {
        const content = `# Title

## Verification Criteria

- [ ] First
`;
        const result = parseCriteriaFromContent(content, 'test.md');
        expect(result.criteria[0].lineNumber).toBeGreaterThan(0);
    });
});

describe('parseCriteria', () => {
    beforeEach(() => {
        vi.mocked(readFile).mockReset();
    });

    it('parses criteria from REQUIREMENTS.md when file exists', async () => {
        const content = `## Verification Criteria

### Must Have
- [ ] Criterion
`;
        vi.mocked(readFile).mockResolvedValue(content);

        const result = await parseCriteria('/tmp/plan');
        expect(result.criteria).toHaveLength(1);
        expect(result.criteria[0].priority).toBe('must');
        expect(result.source).toContain('analysis/REQUIREMENTS.md');
    });

    it('returns empty criteria with parseError when file cannot be read', async () => {
        vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

        const result = await parseCriteria('/nonexistent/plan');
        expect(result.criteria).toEqual([]);
        expect(result.parseErrors.length).toBeGreaterThan(0);
        expect(result.parseErrors[0]).toContain('Could not read');
    });
});

describe('getCriteriaSummary', () => {
    it('returns zero counts for empty criteria', () => {
        const summary = getCriteriaSummary([]);
        expect(summary).toEqual({
            total: 0,
            must: 0,
            should: 0,
            could: 0,
        });
    });

    it('counts by priority', () => {
        const criteria: VerificationCriterion[] = [
            { id: '1', text: 'a', priority: 'must', source: 'x' },
            { id: '2', text: 'b', priority: 'must', source: 'x' },
            { id: '3', text: 'c', priority: 'should', source: 'x' },
            { id: '4', text: 'd', priority: 'could', source: 'x' },
        ];
        const summary = getCriteriaSummary(criteria);
        expect(summary).toEqual({
            total: 4,
            must: 2,
            should: 1,
            could: 1,
        });
    });

    it('handles single criterion', () => {
        const criteria: VerificationCriterion[] = [
            { id: '1', text: 'x', priority: 'should', source: 'x' },
        ];
        const summary = getCriteriaSummary(criteria);
        expect(summary).toEqual({
            total: 1,
            must: 0,
            should: 1,
            could: 0,
        });
    });
});

describe('Error classes', () => {
    describe('VerificationError', () => {
        it('sets name, message, and details', () => {
            const details: VerificationResult = {
                isValid: false,
                level: 'error',
                messages: ['Something failed'],
            };
            const err = new VerificationError('Test error', details);
            expect(err.name).toBe('VerificationError');
            expect(err.message).toBe('Test error');
            expect(err.details).toBe(details);
            expect(err).toBeInstanceOf(Error);
        });
    });

    describe('AcceptanceCriteriaError', () => {
        it('generates message and details from unchecked criteria', () => {
            const uncheckedCriteria = [
                { text: 'Do X', checked: false, stepNumber: 1 },
                { text: 'Do Y', checked: false, stepNumber: 1 },
            ];
            const err = new AcceptanceCriteriaError(uncheckedCriteria);
            expect(err.name).toBe('AcceptanceCriteriaError');
            expect(err.message).toBe(
                'Step has 2 unchecked acceptance criteria'
            );
            expect(err.details.acceptanceCriteria).toEqual(uncheckedCriteria);
            expect(err.details.messages).toContain(
                'Step has 2 unchecked acceptance criteria'
            );
            expect(err.details.messages).toContain('  - [ ] Do X');
            expect(err.details.messages).toContain('  - [ ] Do Y');
        });

        it('handles single unchecked criterion', () => {
            const uncheckedCriteria = [
                { text: 'Only one', checked: false, stepNumber: 1 },
            ];
            const err = new AcceptanceCriteriaError(uncheckedCriteria);
            expect(err.message).toBe(
                'Step has 1 unchecked acceptance criteria'
            );
        });
    });

    describe('ArtifactVerificationError', () => {
        it('generates message and details from missing artifacts', () => {
            const missingArtifacts = ['src/foo.ts', 'src/bar.ts'];
            const err = new ArtifactVerificationError(missingArtifacts);
            expect(err.name).toBe('ArtifactVerificationError');
            expect(err.message).toBe('Step has 2 missing artifacts');
            expect(err.details.artifacts).toEqual(missingArtifacts);
            expect(err.details.messages).toContain(
                'Step has 2 missing artifacts'
            );
            expect(err.details.messages).toContain('  - src/foo.ts');
            expect(err.details.messages).toContain('  - src/bar.ts');
        });

        it('handles single missing artifact', () => {
            const err = new ArtifactVerificationError(['only.ts']);
            expect(err.message).toBe('Step has 1 missing artifacts');
        });
    });
});

describe('VerificationEngine', () => {
    const engine = new VerificationEngine();

    beforeEach(() => {
        vi.mocked(readFile).mockReset();
        vi.mocked(access).mockReset();
    });

    describe('verifyStepCompletion', () => {
        it('returns error when step not found in plan', async () => {
            const plan = { steps: [{ number: 1, filePath: '/plan/01-step.md' }] };
            const options: VerificationOptions = {
                enforcement: 'strict',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            };
            const result = await engine.verifyStepCompletion(plan, 99, options);
            expect(result.isValid).toBe(false);
            expect(result.level).toBe('error');
            expect(result.messages).toContain('Step 99 not found in plan');
        });

        it('returns passed when all acceptance criteria are checked', async () => {
            const plan = {
                steps: [
                    {
                        number: 1,
                        filePath: '/tmp/plan/01-step.md',
                    },
                ],
            };
            const stepContent = `# Step 1

## Acceptance Criteria

- [x] First criterion
- [x] Second criterion
`;
            vi.mocked(readFile).mockResolvedValue(stepContent);

            const options: VerificationOptions = {
                enforcement: 'strict',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            };
            const result = await engine.verifyStepCompletion(plan, 1, options);
            expect(result.isValid).toBe(true);
            expect(result.level).toBe('passed');
            expect(result.acceptanceCriteria).toHaveLength(2);
        });

        it('returns error when acceptance criteria are unchecked', async () => {
            const plan = {
                steps: [
                    { number: 1, filePath: '/tmp/plan/01-step.md' },
                ],
            };
            const stepContent = `# Step 1

## Acceptance Criteria

- [ ] Unchecked criterion
- [x] Checked criterion
`;
            vi.mocked(readFile).mockResolvedValue(stepContent);

            const options: VerificationOptions = {
                enforcement: 'strict',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            };
            const result = await engine.verifyStepCompletion(plan, 1, options);
            expect(result.isValid).toBe(false);
            expect(result.level).toBe('error');
            expect(result.messages.some((m) => m.includes('1 acceptance criteria not checked'))).toBe(true);
        });

        it('returns warning when no acceptance criteria found', async () => {
            const plan = {
                steps: [
                    { number: 1, filePath: '/tmp/plan/01-step.md' },
                ],
            };
            const stepContent = `# Step 1

## Other Section
- [ ] Not in Acceptance Criteria
`;
            vi.mocked(readFile).mockResolvedValue(stepContent);

            const options: VerificationOptions = {
                enforcement: 'strict',
                checkAcceptanceCriteria: true,
                checkArtifacts: false,
            };
            const result = await engine.verifyStepCompletion(plan, 1, options);
            expect(result.level).toBe('warning');
            expect(result.messages).toContain('No acceptance criteria found in step file');
        });

        it('returns warning when artifacts are missing', async () => {
            const plan = {
                steps: [
                    { number: 1, filePath: '/tmp/plan/01-step.md' },
                ],
            };
            const stepContent = `# Step 1

## Acceptance Criteria
- [x] Done

## Files Changed
- src/missing.ts
`;
            vi.mocked(readFile).mockResolvedValue(stepContent);
            vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

            const options: VerificationOptions = {
                enforcement: 'strict',
                checkAcceptanceCriteria: true,
                checkArtifacts: true,
            };
            const result = await engine.verifyStepCompletion(plan, 1, options);
            expect(result.artifacts).toContain('src/missing.ts');
        });
    });
});

describe('VerificationEngine.shouldBlock', () => {
    const engine = new VerificationEngine();

    it('returns false when options.force is true', () => {
        const result: VerificationResult = {
            isValid: false,
            level: 'error',
            messages: ['Failed'],
        };
        const options: VerificationOptions = {
            enforcement: 'strict',
            checkAcceptanceCriteria: true,
            checkArtifacts: true,
            force: true,
        };
        expect(engine.shouldBlock(result, options)).toBe(false);
    });

    it('returns false when enforcement is advisory', () => {
        const result: VerificationResult = {
            isValid: false,
            level: 'error',
            messages: ['Failed'],
        };
        const options: VerificationOptions = {
            enforcement: 'advisory',
            checkAcceptanceCriteria: true,
            checkArtifacts: true,
        };
        expect(engine.shouldBlock(result, options)).toBe(false);
    });

    it('returns true when enforcement is strict and result.level is error', () => {
        const result: VerificationResult = {
            isValid: false,
            level: 'error',
            messages: ['Failed'],
        };
        const options: VerificationOptions = {
            enforcement: 'strict',
            checkAcceptanceCriteria: true,
            checkArtifacts: true,
        };
        expect(engine.shouldBlock(result, options)).toBe(true);
    });

    it('returns false when enforcement is strict but result.level is warning', () => {
        const result: VerificationResult = {
            isValid: true,
            level: 'warning',
            messages: ['Warning'],
        };
        const options: VerificationOptions = {
            enforcement: 'strict',
            checkAcceptanceCriteria: true,
            checkArtifacts: true,
        };
        expect(engine.shouldBlock(result, options)).toBe(false);
    });

    it('returns false when enforcement is strict but result.level is passed', () => {
        const result: VerificationResult = {
            isValid: true,
            level: 'passed',
            messages: [],
        };
        const options: VerificationOptions = {
            enforcement: 'strict',
            checkAcceptanceCriteria: true,
            checkArtifacts: true,
        };
        expect(engine.shouldBlock(result, options)).toBe(false);
    });

    it('returns false for interactive mode', () => {
        const result: VerificationResult = {
            isValid: false,
            level: 'error',
            messages: ['Failed'],
        };
        const options: VerificationOptions = {
            enforcement: 'interactive',
            checkAcceptanceCriteria: true,
            checkArtifacts: true,
        };
        expect(engine.shouldBlock(result, options)).toBe(false);
    });
});

describe('Constants', () => {
    it('exports PRIORITY_WEIGHTS with correct values', () => {
        expect(PRIORITY_WEIGHTS).toEqual({
            must: 1.0,
            should: 0.7,
            could: 0.3,
        });
    });

    it('exports CRITERIA_PATTERNS with expected keys', () => {
        expect(CRITERIA_PATTERNS).toHaveProperty('checkbox');
        expect(CRITERIA_PATTERNS).toHaveProperty('mustHaveHeader');
        expect(CRITERIA_PATTERNS).toHaveProperty('shouldHaveHeader');
        expect(CRITERIA_PATTERNS).toHaveProperty('couldHaveHeader');
        expect(CRITERIA_PATTERNS).toHaveProperty('verificationSection');
    });

    it('CRITERIA_PATTERNS.checkbox matches checkbox items', () => {
        const re = new RegExp(CRITERIA_PATTERNS.checkbox.source);
        expect(re.test('- [ ] unchecked')).toBe(true);
        expect(re.test('- [x] checked')).toBe(true);
    });

    it('exports HEALTH_THRESHOLDS with coverage and completion', () => {
        expect(HEALTH_THRESHOLDS).toEqual({
            coverage: {
                good: 80,
                warning: 60,
                critical: 40,
            },
            completion: {
                good: 90,
                warning: 70,
                critical: 50,
            },
        });
    });
});
