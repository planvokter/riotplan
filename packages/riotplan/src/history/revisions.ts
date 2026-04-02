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
export function createRevision(
    history: PlanHistory,
    message: string,
    options?: {
    author?: string;
    feedbackId?: string;
  },
): PlanRevision {
    const currentVersion = history.currentVersion;
    const [major, minor] = currentVersion.split(".").map(Number);
    const newVersion = `${major}.${minor + 1}`;

    const revision: PlanRevision = {
        version: newVersion,
        createdAt: new Date(),
        message,
        author: options?.author,
        feedbackId: options?.feedbackId,
    };

    history.revisions.push(revision);
    history.currentVersion = newVersion;

    return revision;
}

/**
 * Get a specific revision by version
 */
export function getRevision(
    history: PlanHistory,
    version: string,
): RevisionInfo | undefined {
    const index = history.revisions.findIndex((r) => r.version === version);
    if (index === -1) return undefined;

    const revision = history.revisions[index];
    return {
        ...revision,
        index,
        isCurrent: revision.version === history.currentVersion,
    };
}

/**
 * List all revisions
 */
export function listRevisions(history: PlanHistory): RevisionInfo[] {
    return history.revisions.map((r, index) => ({
        ...r,
        index,
        isCurrent: r.version === history.currentVersion,
    }));
}

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
export function compareRevisions(
    history: PlanHistory,
    fromVersion: string,
    toVersion: string,
): RevisionComparison | undefined {
    const from = getRevision(history, fromVersion);
    const to = getRevision(history, toVersion);

    if (!from || !to) return undefined;

    const fromTime =
    from.createdAt instanceof Date
        ? from.createdAt.getTime()
        : new Date(from.createdAt).getTime();
    const toTime =
    to.createdAt instanceof Date
        ? to.createdAt.getTime()
        : new Date(to.createdAt).getTime();

    return {
        from,
        to,
        timeDiff: toTime - fromTime,
        revisionCount: Math.abs(to.index - from.index),
    };
}

/**
 * Get the latest revision
 */
export function getLatestRevision(
    history: PlanHistory,
): RevisionInfo | undefined {
    if (history.revisions.length === 0) return undefined;

    const index = history.revisions.length - 1;
    const revision = history.revisions[index];

    return {
        ...revision,
        index,
        isCurrent: true,
    };
}

/**
 * Generate a new version number
 */
export function nextVersion(currentVersion: string): string {
    const [major, minor] = currentVersion.split(".").map(Number);
    return `${major}.${minor + 1}`;
}
