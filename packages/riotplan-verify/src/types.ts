/**
 * Priority level for verification criteria
 */
export type CriteriaPriority = "must" | "should" | "could";

/**
 * Status of a verification criterion
 */
export type CriteriaStatus = "covered" | "partial" | "missing" | "unknown";

/**
 * A single verification criterion extracted from analysis
 */
export interface VerificationCriterion {
    id: string;
    text: string;
    priority: CriteriaPriority;
    source: string;  // File/section it came from
    lineNumber?: number;
}

/**
 * Result of checking a single criterion
 */
export interface CriterionResult {
    criterion: VerificationCriterion;
    status: CriteriaStatus;
    matchedSteps: number[];  // Step numbers that address this
    notes?: string;
}

/**
 * Coverage report for analysis → plan verification
 */
export interface CoverageReport {
    /** Total criteria checked */
    totalCriteria: number;
    
    /** Fully covered criteria */
    covered: CriterionResult[];
    
    /** Partially covered criteria */
    partial: CriterionResult[];
    
    /** Missing criteria */
    missing: CriterionResult[];
    
    /** Coverage by priority */
    byPriority: {
        must: { total: number; covered: number; partial: number; missing: number };
        should: { total: number; covered: number; partial: number; missing: number };
        could: { total: number; covered: number; partial: number; missing: number };
    };
    
    /** Overall coverage percentage (weighted by priority) */
    coverageScore: number;
    
    /** Generated verification questions */
    questions: string[];
}

/**
 * Step completion status
 */
export type StepCompletionStatus = 
    | "complete"      // All acceptance criteria met
    | "partial"       // Some criteria met
    | "incomplete"    // Marked done but criteria not met
    | "pending"       // Not started
    | "skipped";      // Intentionally skipped

/**
 * Acceptance criterion from a step file
 */
export interface AcceptanceCriterion {
    text: string;
    checked: boolean;
    stepNumber: number;
}

/**
 * Result of checking step completion
 */
export interface StepCompletionResult {
    stepNumber: number;
    stepTitle: string;
    status: StepCompletionStatus;
    acceptanceCriteria: AcceptanceCriterion[];
    markedStatus: string;  // What STATUS.md says
    notes?: string;
}

/**
 * Completion report for plan → execution verification
 */
export interface CompletionReport {
    /** Total steps */
    totalSteps: number;
    
    /** Steps by completion status */
    complete: StepCompletionResult[];
    partial: StepCompletionResult[];
    incomplete: StepCompletionResult[];
    pending: StepCompletionResult[];
    
    /** Overall completion percentage */
    completionScore: number;
    
    /** Outstanding items */
    outstandingItems: string[];
}

/**
 * Full verification report
 */
export interface VerificationReport {
    planPath: string;
    timestamp: Date;
    
    /** Analysis → Plan coverage (if analysis exists) */
    coverage?: CoverageReport;
    
    /** Plan → Execution completion */
    completion?: CompletionReport;
    
    /** Overall health score (0-100) */
    healthScore: number;
    
    /** Summary messages */
    summary: string[];
    
    /** Recommendations */
    recommendations: string[];
}
