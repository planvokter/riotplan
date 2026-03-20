/**
 * STATUS.md Generator
 *
 * Generates and updates STATUS.md files from plan state.
 */
import type { Plan, TaskStatus } from "../types.js";
export interface GenerateStatusOptions {
    /** Preserve existing notes section */
    preserveNotes?: boolean;
    /** Existing STATUS.md content (for preservation) */
    existingContent?: string;
    /** Include phase progress if phases defined */
    includePhases?: boolean;
    /** Date format for timestamps */
    dateFormat?: "iso" | "short" | "long";
}
export interface UpdateStatusOptions {
    /** Step that was completed/updated */
    step?: number;
    /** New status for step */
    stepStatus?: TaskStatus;
    /** Add blocker */
    addBlocker?: string;
    /** Remove blocker by description match */
    removeBlocker?: string;
    /** Add issue */
    addIssue?: {
        title: string;
        description: string;
    };
    /** Add note */
    addNote?: string;
}
/**
 * Generate a complete STATUS.md document from a plan
 */
export declare function generateStatus(plan: Plan, options?: GenerateStatusOptions): Promise<string>;
/**
 * Update a plan's state based on status changes
 */
export declare function updateStatus(plan: Plan, updates: UpdateStatusOptions): Plan;
//# sourceMappingURL=generator.d.ts.map