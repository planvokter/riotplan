/**
 * Milestone Management
 *
 * Create and manage plan milestones.
 */
import type { PlanHistory, PlanMilestone } from "../types.js";
/**
 * Extended milestone info
 */
export interface MilestoneInfo extends PlanMilestone {
    /** Milestone index */
    index: number;
}
/**
 * Create a new milestone
 */
export declare function createMilestone(history: PlanHistory, name: string, description?: string): PlanMilestone;
/**
 * Get a milestone by name
 */
export declare function getMilestone(history: PlanHistory, name: string): MilestoneInfo | undefined;
/**
 * List all milestones
 */
export declare function listMilestones(history: PlanHistory): MilestoneInfo[];
/**
 * Rollback result
 */
export interface RollbackResult {
    /** Whether rollback succeeded */
    success: boolean;
    /** Target milestone */
    milestone?: MilestoneInfo;
    /** New current version */
    newVersion?: string;
    /** Revisions rolled back */
    revisionsRolledBack?: number;
    /** Error message if failed */
    error?: string;
}
/**
 * Rollback to a milestone
 *
 * This resets the current version to the milestone's version.
 * Revisions after the milestone are kept but no longer current.
 */
export declare function rollbackToMilestone(history: PlanHistory, milestoneName: string): RollbackResult;
/**
 * Get the latest milestone
 */
export declare function getLatestMilestone(history: PlanHistory): MilestoneInfo | undefined;
//# sourceMappingURL=milestones.d.ts.map