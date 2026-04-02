/**
 * RiotPlan History
 *
 * History management for plan revisions.
 */

export {
    createRevision,
    getRevision,
    listRevisions,
    compareRevisions,
    type RevisionInfo,
} from "./revisions.js";
export {
    createMilestone,
    getMilestone,
    listMilestones,
    rollbackToMilestone,
    type MilestoneInfo,
} from "./milestones.js";
export {
    initHistory,
    loadHistory,
    saveHistory,
    type HistoryManager,
} from "./manager.js";

/** Version */
export const VERSION = "0.0.1";
