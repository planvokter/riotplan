/**
 * Retrospective Generation
 *
 * Generate RETROSPECTIVE.md files for completed plans.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plan } from "../types.js";
import { savePlanDoc } from "../artifacts/operations.js";

// Re-export reference functions
export {
    loadRetrospectiveAsContext,
    retrospectiveExists,
    loadMultipleRetrospectives,
} from './reference.js';

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
export function generateRetrospective(
    plan: Plan,
    options?: GenerateRetrospectiveOptions
): Retrospective {
    const steps = plan.steps || [];
    const completedSteps = steps.filter((s) => s.status === "completed");
    const skippedSteps = steps.filter((s) => s.status === "skipped");

    // Calculate duration if dates available
    let duration: number | undefined;
    if (plan.state.startedAt && plan.state.completedAt) {
        const start =
            plan.state.startedAt instanceof Date
                ? plan.state.startedAt.getTime()
                : new Date(plan.state.startedAt).getTime();
        const end =
            plan.state.completedAt instanceof Date
                ? plan.state.completedAt.getTime()
                : new Date(plan.state.completedAt).getTime();
        duration = end - start;
    }

    // Auto-generate insights from plan data
    const whatWentWell = options?.whatWentWell || generateWhatWentWell(plan);
    const whatCouldImprove =
        options?.whatCouldImprove || generateWhatCouldImprove(plan);
    const keyLearnings = options?.keyLearnings || [];
    const actionItems = options?.actionItems || [];

    return {
        planName: plan.metadata.name,
        planCode: plan.metadata.code,
        startedAt: plan.state.startedAt,
        completedAt: plan.state.completedAt,
        duration,
        totalSteps: steps.length,
        completedSteps: completedSteps.length,
        skippedSteps: skippedSteps.length,
        whatWentWell,
        whatCouldImprove,
        keyLearnings,
        actionItems,
        stepsSummary: steps.map((s) => ({
            number: s.number,
            title: s.title,
            status: s.status,
            duration: s.duration,
            notes: s.notes,
        })),
    };
}

/**
 * Auto-generate "what went well" based on plan data
 */
function generateWhatWentWell(plan: Plan): string[] {
    const items: string[] = [];
    const steps = plan.steps || [];

    // Check completion rate
    const completed = steps.filter((s) => s.status === "completed").length;
    const rate = steps.length > 0 ? (completed / steps.length) * 100 : 0;

    if (rate === 100) {
        items.push("All steps completed successfully");
    } else if (rate >= 90) {
        items.push(`High completion rate (${rate.toFixed(0)}%)`);
    }

    // Check for no blockers
    if (plan.state.blockers.length === 0) {
        items.push("No blockers encountered");
    }

    // Check for feedback integration
    if (plan.feedback && plan.feedback.length > 0) {
        items.push(`Successfully incorporated ${plan.feedback.length} feedback item(s)`);
    }

    return items;
}

/**
 * Auto-generate "what could improve" based on plan data
 */
function generateWhatCouldImprove(plan: Plan): string[] {
    const items: string[] = [];
    const steps = plan.steps || [];

    // Check for skipped steps
    const skipped = steps.filter((s) => s.status === "skipped");
    if (skipped.length > 0) {
        items.push(`${skipped.length} step(s) were skipped - review if necessary`);
    }

    // Check for blockers
    if (plan.state.blockers.length > 0) {
        items.push(
            `Address recurring blockers: ${plan.state.blockers.map((b) => b.description).join(", ")}`
        );
    }

    // Check for issues
    if (plan.state.issues.length > 0) {
        items.push(`Resolve outstanding issues before next iteration`);
    }

    return items;
}

/**
 * Generate RETROSPECTIVE.md content
 */
export function generateRetrospectiveMarkdown(retro: Retrospective): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Retrospective: ${retro.planName}\n`);
    lines.push(`**Plan Code:** ${retro.planCode}\n`);

    // Dates
    if (retro.startedAt) {
        lines.push(`**Started:** ${formatDate(retro.startedAt)}`);
    }
    if (retro.completedAt) {
        lines.push(`**Completed:** ${formatDate(retro.completedAt)}`);
    }
    if (retro.duration) {
        lines.push(`**Duration:** ${formatDuration(retro.duration)}`);
    }
    lines.push("");

    // Summary
    lines.push("## Summary\n");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Steps | ${retro.totalSteps} |`);
    lines.push(`| Completed | ${retro.completedSteps} |`);
    lines.push(`| Skipped | ${retro.skippedSteps} |`);
    lines.push(
        `| Completion Rate | ${((retro.completedSteps / retro.totalSteps) * 100).toFixed(0)}% |`
    );
    lines.push("");

    // What Went Well
    lines.push("## What Went Well\n");
    if (retro.whatWentWell.length > 0) {
        for (const item of retro.whatWentWell) {
            lines.push(`- ✅ ${item}`);
        }
    } else {
        lines.push("*No entries yet. Add your insights here.*");
    }
    lines.push("");

    // What Could Improve
    lines.push("## What Could Improve\n");
    if (retro.whatCouldImprove.length > 0) {
        for (const item of retro.whatCouldImprove) {
            lines.push(`- 🔄 ${item}`);
        }
    } else {
        lines.push("*No entries yet. Add your insights here.*");
    }
    lines.push("");

    // Key Learnings
    lines.push("## Key Learnings\n");
    if (retro.keyLearnings.length > 0) {
        for (const item of retro.keyLearnings) {
            lines.push(`- 💡 ${item}`);
        }
    } else {
        lines.push("*What did you learn? Document it here.*");
    }
    lines.push("");

    // Action Items
    lines.push("## Action Items\n");
    if (retro.actionItems.length > 0) {
        for (const item of retro.actionItems) {
            lines.push(`- [ ] ${item}`);
        }
    } else {
        lines.push("*Any follow-up tasks? Add them here.*");
    }
    lines.push("");

    // Steps Summary
    lines.push("## Steps Summary\n");
    lines.push(`| # | Title | Status | Notes |`);
    lines.push(`|---|-------|--------|-------|`);
    for (const step of retro.stepsSummary) {
        const status = formatStepStatus(step.status);
        const notes = step.notes || "-";
        lines.push(`| ${step.number} | ${step.title} | ${status} | ${notes} |`);
    }
    lines.push("");

    // Footer
    lines.push("---");
    lines.push(`*Generated on ${new Date().toISOString().split("T")[0]}*`);

    return lines.join("\n");
}

/**
 * Create and save a RETROSPECTIVE.md file
 */
export async function createRetrospective(
    plan: Plan,
    options?: GenerateRetrospectiveOptions
): Promise<string> {
    const retro = generateRetrospective(plan, options);
    const content = generateRetrospectiveMarkdown(retro);

    if (plan.metadata.path.endsWith(".plan")) {
        await savePlanDoc(plan.metadata.path, "other", "RETROSPECTIVE.md", content);
        return "RETROSPECTIVE.md";
    }

    const retroPath = join(plan.metadata.path, "RETROSPECTIVE.md");
    await writeFile(retroPath, content, "utf-8");
    return retroPath;
}

/**
 * Format a date for display
 */
function formatDate(date: Date | string): string {
    if (typeof date === "string") return date;
    return date.toISOString().split("T")[0];
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} day(s), ${hours % 24} hour(s)`;
    }
    if (hours > 0) {
        return `${hours} hour(s), ${minutes} minute(s)`;
    }
    return `${minutes} minute(s)`;
}

/**
 * Format step status with emoji
 */
function formatStepStatus(status: string): string {
    const emojis: Record<string, string> = {
        completed: "✅",
        skipped: "⏭️",
        pending: "⬜",
        in_progress: "🔄",
        blocked: "⏸️",
    };
    return `${emojis[status] || ""} ${status}`;
}

