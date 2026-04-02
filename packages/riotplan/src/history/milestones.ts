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
export function createMilestone(
    history: PlanHistory,
    name: string,
    description?: string,
): PlanMilestone {
    const milestone: PlanMilestone = {
        name,
        version: history.currentVersion,
        createdAt: new Date(),
        description,
    };

    if (!history.milestones) {
        history.milestones = [];
    }

    history.milestones.push(milestone);

    return milestone;
}

/**
 * Get a milestone by name
 */
export function getMilestone(
    history: PlanHistory,
    name: string,
): MilestoneInfo | undefined {
    if (!history.milestones) return undefined;

    const index = history.milestones.findIndex((m) => m.name === name);
    if (index === -1) return undefined;

    return {
        ...history.milestones[index],
        index,
    };
}

/**
 * List all milestones
 */
export function listMilestones(history: PlanHistory): MilestoneInfo[] {
    if (!history.milestones) return [];

    return history.milestones.map((m, index) => ({
        ...m,
        index,
    }));
}

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
export function rollbackToMilestone(
    history: PlanHistory,
    milestoneName: string,
): RollbackResult {
    const milestone = getMilestone(history, milestoneName);

    if (!milestone) {
        return {
            success: false,
            error: `Milestone not found: ${milestoneName}`,
        };
    }

    // Count how many revisions we're rolling back
    const currentIndex = history.revisions.findIndex(
        (r) => r.version === history.currentVersion,
    );
    const targetIndex = history.revisions.findIndex(
        (r) => r.version === milestone.version,
    );

    if (targetIndex === -1) {
        return {
            success: false,
            error: `Revision not found for milestone: ${milestone.version}`,
        };
    }

    const revisionsRolledBack = currentIndex - targetIndex;

    // Update current version
    history.currentVersion = milestone.version;

    return {
        success: true,
        milestone,
        newVersion: milestone.version,
        revisionsRolledBack,
    };
}

/**
 * Get the latest milestone
 */
export function getLatestMilestone(
    history: PlanHistory,
): MilestoneInfo | undefined {
    if (!history.milestones || history.milestones.length === 0) {
        return undefined;
    }

    const index = history.milestones.length - 1;
    return {
        ...history.milestones[index],
        index,
    };
}
