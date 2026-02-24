import { describe, expect, it } from 'vitest';
import {
    AcceptanceCriteriaError,
    ArtifactVerificationError,
    VerificationError,
} from '../../src/verification/errors.js';

describe('verification errors', () => {
    it('constructs base verification error with details', () => {
        const details = {
            isValid: false,
            level: 'error' as const,
            messages: ['bad'],
            acceptanceCriteria: [],
        };
        const err = new VerificationError('failed', details);
        expect(err.name).toBe('VerificationError');
        expect(err.message).toBe('failed');
        expect(err.details).toEqual(details);
    });

    it('builds acceptance criteria error details', () => {
        const err = new AcceptanceCriteriaError([
            { text: 'criterion one', checked: false },
            { text: 'criterion two', checked: false },
        ]);
        expect(err.name).toBe('AcceptanceCriteriaError');
        expect(err.message).toContain('2 unchecked acceptance criteria');
        expect(err.details.messages.join('\n')).toContain('criterion one');
        expect(err.details.acceptanceCriteria).toHaveLength(2);
    });

    it('builds artifact verification error details', () => {
        const err = new ArtifactVerificationError(['SUMMARY.md', 'STATUS.md']);
        expect(err.name).toBe('ArtifactVerificationError');
        expect(err.message).toContain('2 missing artifacts');
        expect(err.details.messages.join('\n')).toContain('SUMMARY.md');
        expect(err.details.artifacts).toEqual(['SUMMARY.md', 'STATUS.md']);
    });
});
