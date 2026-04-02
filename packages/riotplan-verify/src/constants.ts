/**
 * Weight multipliers for coverage scoring by priority
 */
export const PRIORITY_WEIGHTS = {
    must: 1.0,
    should: 0.7,
    could: 0.3,
} as const;

/**
 * Patterns for detecting criteria in markdown
 */
export const CRITERIA_PATTERNS = {
    /** Checkbox item: - [ ] or - [x] */
    checkbox: /^[-*]\s*\[([x ])\]\s*(.+)$/gm,
    
    /** Section headers for criteria */
    mustHaveHeader: /^###?\s*Must\s+Have/i,
    shouldHaveHeader: /^###?\s*Should\s+Have/i,
    couldHaveHeader: /^###?\s*Could\s+Have/i,
    
    /** Verification criteria section */
    verificationSection: /^##\s*Verification\s+Criteria/im,
} as const;

/**
 * Minimum scores for "healthy" status
 */
export const HEALTH_THRESHOLDS = {
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
} as const;
