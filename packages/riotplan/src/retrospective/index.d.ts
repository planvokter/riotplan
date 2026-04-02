/**
 * Retrospective Generation
 *
 * Generate RETROSPECTIVE.md files for completed plans.
 */
import type { Plan } from "../types.js";
export { loadRetrospectiveAsContext, retrospectiveExists, loadMultipleRetrospectives, } from './reference.js';
/**
 * Retrospective data structure
 */
export interface Retrospective {
    /** Plan name */
    planName: string;
    /** Plan code */
    planCode: string;
    /** When the plan started */
    startedAt?: Date;
    /** When the plan completed */
    completedAt?: Date;
    /** Total duration in milliseconds */
    duration?: number;
    /** Total steps */
    totalSteps: number;
    /** Completed steps */
    completedSteps: number;
    /** Skipped steps */
    skippedSteps: number;
    /** What went well */
    whatWentWell: string[];
    /** What could improve */
    whatCouldImprove: string[];
    /** Key learnings */
    keyLearnings: string[];
    /** Action items for future */
    actionItems: string[];
    /** Steps summary */
    stepsSummary: Array<{
        number: number;
        title: string;
        status: string;
        duration?: number;
        notes?: string;
    }>;
}
/**
 * Options for generating a retrospective
 */
export interface GenerateRetrospectiveOptions {
    /** Custom "what went well" entries */
    whatWentWell?: string[];
    /** Custom "what could improve" entries */
    whatCouldImprove?: string[];
    /** Custom key learnings */
    keyLearnings?: string[];
    /** Custom action items */
    actionItems?: string[];
    /** Author */
    author?: string;
}
/**
 * Generate retrospective data from a plan
 */
export declare function generateRetrospective(plan: Plan, options?: GenerateRetrospectiveOptions): Retrospective;
/**
 * Generate RETROSPECTIVE.md content
 */
export declare function generateRetrospectiveMarkdown(retro: Retrospective): string;
/**
 * Create and save a RETROSPECTIVE.md file
 */
export declare function createRetrospective(plan: Plan, options?: GenerateRetrospectiveOptions): Promise<string>;
//# sourceMappingURL=index.d.ts.map