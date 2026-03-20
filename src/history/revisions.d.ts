/**
 * Revision Management
 *
 * Create and manage plan revisions.
 */
import type { PlanHistory, PlanRevision } from "../types.js";
/**
 * Extended revision info with computed fields
 */
export interface RevisionInfo extends PlanRevision {
    /** Revision index in history */
    index: number;
    /** Whether this is the current revision */
    isCurrent: boolean;
}
/**
 * Create a new revision
 */
export declare function createRevision(history: PlanHistory, message: string, options?: {
    author?: string;
    feedbackId?: string;
}): PlanRevision;
/**
 * Get a specific revision by version
 */
export declare function getRevision(history: PlanHistory, version: string): RevisionInfo | undefined;
/**
 * List all revisions
 */
export declare function listRevisions(history: PlanHistory): RevisionInfo[];
/**
 * Comparison result between revisions
 */
export interface RevisionComparison {
    /** Earlier revision */
    from: RevisionInfo;
    /** Later revision */
    to: RevisionInfo;
    /** Time difference in milliseconds */
    timeDiff: number;
    /** Number of revisions between */
    revisionCount: number;
}
/**
 * Compare two revisions
 */
export declare function compareRevisions(history: PlanHistory, fromVersion: string, toVersion: string): RevisionComparison | undefined;
/**
 * Get the latest revision
 */
export declare function getLatestRevision(history: PlanHistory): RevisionInfo | undefined;
/**
 * Generate a new version number
 */
export declare function nextVersion(currentVersion: string): string;
//# sourceMappingURL=revisions.d.ts.map