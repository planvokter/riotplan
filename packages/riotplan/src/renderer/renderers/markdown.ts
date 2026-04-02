/**
 * Markdown Renderer
 *
 * Render a plan to Markdown format.
 */

import type { Plan, PlanStep } from "../../types.js";

/**
 * Options for Markdown rendering
 */
export interface MarkdownRenderOptions {
    /** Include metadata section */
    includeMetadata?: boolean;

    /** Include step details */
    includeStepDetails?: boolean;

    /** Include feedback records */
    includeFeedback?: boolean;

    /** Include evidence records */
    includeEvidence?: boolean;

    /** Use task list format for steps */
    useTaskList?: boolean;

    /** Table of contents */
    includeToc?: boolean;
}

/**
 * Default options for Markdown rendering
 */
const DEFAULT_OPTIONS: MarkdownRenderOptions = {
    includeMetadata: true,
    includeStepDetails: true,
    includeFeedback: false,
    includeEvidence: false,
    useTaskList: false,
    includeToc: false,
};

/**
 * Render a plan to Markdown
 */
export function renderToMarkdown(
    plan: Plan,
    options?: Partial<MarkdownRenderOptions>,
): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const sections: string[] = [];

    // Title
    sections.push(`# ${plan.metadata.name}\n`);

    // Table of contents
    if (opts.includeToc) {
        sections.push(renderToc(plan, opts));
    }

    // Metadata
    if (opts.includeMetadata) {
        sections.push(renderMetadata(plan));
    }

    // Status overview
    sections.push(renderStatusOverview(plan));

    // Steps
    sections.push(renderSteps(plan, opts));

    // Feedback
    if (opts.includeFeedback && plan.feedback && plan.feedback.length > 0) {
        sections.push(renderFeedback(plan));
    }

    // Evidence
    if (opts.includeEvidence && plan.evidence && plan.evidence.length > 0) {
        sections.push(renderEvidence(plan));
    }

    return sections.join("\n");
}

/**
 * Render table of contents
 */
function renderToc(plan: Plan, opts: MarkdownRenderOptions): string {
    const lines: string[] = ["## Table of Contents\n"];

    lines.push("- [Status Overview](#status-overview)");
    lines.push("- [Steps](#steps)");

    if (opts.includeFeedback && plan.feedback?.length) {
        lines.push("- [Feedback](#feedback)");
    }

    if (opts.includeEvidence && plan.evidence?.length) {
        lines.push("- [Evidence](#evidence)");
    }

    return lines.join("\n") + "\n";
}

/**
 * Render metadata section
 */
function renderMetadata(plan: Plan): string {
    const lines: string[] = ["## Metadata\n"];

    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| **Code** | ${plan.metadata.code} |`);
    lines.push(`| **Name** | ${plan.metadata.name} |`);
    if (plan.metadata.description) {
        lines.push(`| **Description** | ${plan.metadata.description} |`);
    }
    if (plan.metadata.author) {
        lines.push(`| **Author** | ${plan.metadata.author} |`);
    }
    if (plan.metadata.createdAt) {
        lines.push(`| **Created** | ${formatDate(plan.metadata.createdAt)} |`);
    }
    if (plan.context) {
        lines.push(`| **Context** | ${plan.context} |`);
    }

    return lines.join("\n") + "\n";
}

/**
 * Render status overview
 */
function renderStatusOverview(plan: Plan): string {
    const lines: string[] = ["## Status Overview\n"];
    const state = plan.state;

    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| **Status** | ${formatStatus(state.status)} |`);
    lines.push(`| **Progress** | ${state.progress}% |`);

    if (state.currentStep !== undefined) {
        lines.push(`| **Current Step** | ${state.currentStep} |`);
    }

    const totalSteps = plan.steps?.length ?? 0;
    const completed =
        plan.steps?.filter((s) => s.status === "completed").length ?? 0;
    lines.push(`| **Completed** | ${completed}/${totalSteps} steps |`);

    return lines.join("\n") + "\n";
}

/**
 * Format status with emoji
 */
function formatStatus(status: string): string {
    const statusEmoji: Record<string, string> = {
        not_started: "⬜",
        in_progress: "🔄",
        completed: "✅",
        blocked: "⏸️",
        cancelled: "❌",
    };

    return `${statusEmoji[status] || ""} ${status}`;
}

/**
 * Render steps section
 */
function renderSteps(plan: Plan, opts: MarkdownRenderOptions): string {
    const lines: string[] = ["## Steps\n"];
    const steps = plan.steps || [];

    if (steps.length === 0) {
        lines.push("*No steps defined.*\n");
        return lines.join("\n");
    }

    if (opts.useTaskList) {
        for (const step of steps) {
            const checked = step.status === "completed" ? "x" : " ";
            lines.push(`- [${checked}] **${step.number}. ${step.title}**`);
            if (opts.includeStepDetails && step.description) {
                lines.push(`  ${step.description}`);
            }
        }
    } else {
        lines.push(`| # | Title | Status | Started | Completed |`);
        lines.push(`|---|-------|--------|---------|-----------|`);

        for (const step of steps) {
            const status = formatStepStatus(step);
            const started = step.startedAt ? formatDate(step.startedAt) : "-";
            const completed = step.completedAt ? formatDate(step.completedAt) : "-";
            lines.push(
                `| ${step.number} | ${step.title} | ${status} | ${started} | ${completed} |`,
            );
        }
    }

    return lines.join("\n") + "\n";
}

/**
 * Format step status with emoji
 */
function formatStepStatus(step: PlanStep): string {
    const statusEmoji: Record<string, string> = {
        pending: "⬜",
        not_started: "⬜",
        in_progress: "🔄",
        completed: "✅",
        blocked: "⏸️",
        skipped: "⏭️",
    };

    return statusEmoji[step.status] ?? String(step.status);
}

/**
 * Render feedback section
 */
function renderFeedback(plan: Plan): string {
    const lines: string[] = ["## Feedback\n"];
    const feedback = plan.feedback || [];

    for (const record of feedback) {
        lines.push(`### ${record.id}: ${record.title}`);
        lines.push(`- **Platform**: ${record.platform}`);
        lines.push(`- **Date**: ${formatDate(record.createdAt)}`);
        if (record.resolution) {
            lines.push(`\n${record.resolution}\n`);
        }
    }

    return lines.join("\n") + "\n";
}

/**
 * Render evidence section
 */
function renderEvidence(plan: Plan): string {
    const lines: string[] = ["## Evidence\n"];
    const evidence = plan.evidence || [];

    for (const record of evidence) {
        lines.push(`### ${record.id}: ${record.title}`);
        lines.push(`- **Type**: ${record.type}`);
        if (record.source) {
            lines.push(`- **Source**: ${record.source}`);
        }
    }

    return lines.join("\n") + "\n";
}

/**
 * Format a date
 */
function formatDate(date: Date): string {
    if (typeof date === "string") {
        return date;
    }
    return date.toISOString().split("T")[0];
}
