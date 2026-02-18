/**
 * Custom error types for verification failures
 */

import type { VerificationResult } from './engine.js';
import type { AcceptanceCriterion } from './types.js';

/**
 * Base error for verification failures
 */
export class VerificationError extends Error {
    constructor(
        message: string,
        public details: VerificationResult
    ) {
        super(message);
        this.name = 'VerificationError';
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error thrown when acceptance criteria are not met
 */
export class AcceptanceCriteriaError extends VerificationError {
    constructor(uncheckedCriteria: AcceptanceCriterion[]) {
        const message = `Step has ${uncheckedCriteria.length} unchecked acceptance criteria`;
        const details: VerificationResult = {
            isValid: false,
            level: 'error',
            messages: [
                message,
                ...uncheckedCriteria.map((c) => `  - [ ] ${c.text}`),
            ],
            acceptanceCriteria: uncheckedCriteria,
        };
        super(message, details);
        this.name = 'AcceptanceCriteriaError';
    }
}

/**
 * Error thrown when required artifacts are missing
 */
export class ArtifactVerificationError extends VerificationError {
    constructor(missingArtifacts: string[]) {
        const message = `Step has ${missingArtifacts.length} missing artifacts`;
        const details: VerificationResult = {
            isValid: false,
            level: 'error',
            messages: [
                message,
                ...missingArtifacts.map((a) => `  - ${a}`),
            ],
            artifacts: missingArtifacts,
        };
        super(message, details);
        this.name = 'ArtifactVerificationError';
    }
}
