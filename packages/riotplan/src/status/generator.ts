/**
 * STATUS.md Generator
 *
 * Generates and updates STATUS.md files from plan state.
 */

import type {
    Plan,
    PlanStep,
    TaskStatus,
    Blocker,
    Issue,
} from "../types.js";
import { PLAN_CONVENTIONS } from "../types.js";
import { readStepReflection } from "../reflections/reader.js";

// ===== TYPES =====

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
    addIssue?: { title: string; description: string };

    /** Add note */
    addNote?: string;
}

// ===== DATE FORMATTING =====

/**
 * Format a date for display
 */
function formatDate(
    date: Date | undefined,
    format: "iso" | "short" | "long"
): string {
    if (!date) return "-";

    switch (format) {
        case "iso":
            return date.toISOString().split("T")[0];
        case "long":
            return date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        case "short":
        default:
            return date.toISOString().split("T")[0];
    }
}

/**
 * Get emoji for status
 */
function getStatusEmoji(status: TaskStatus): string {
    return PLAN_CONVENTIONS.statusEmoji[status] || "⬜";
}

/**
 * Get display string for status (emoji + text)
 */
function getStatusDisplay(status: TaskStatus): string {
    const emoji = getStatusEmoji(status);
    const text = status.toUpperCase().replace("_", " ");
    return `${emoji} ${text}`;
}

// ===== SECTION GENERATORS =====

/**
 * Generate the Current State section
 */
function generateCurrentStateSection(
    plan: Plan,
    dateFormat: "iso" | "short" | "long"
): string {
    const { state, steps } = plan;
    const completedCount = steps.filter((s) => s.status === "completed").length;
    const progress =
        steps.length > 0
            ? Math.round((completedCount / steps.length) * 100)
            : 0;

    const currentStep = state.currentStep
        ? steps.find((s) => s.number === state.currentStep)
        : undefined;
    const lastCompleted = state.lastCompletedStep
        ? steps.find((s) => s.number === state.lastCompletedStep)
        : undefined;

    const currentStepDisplay = currentStep
        ? `${String(currentStep.number).padStart(2, "0")} - ${currentStep.title}`
        : "-";
    const lastCompletedDisplay = lastCompleted
        ? `${String(lastCompleted.number).padStart(2, "0")} - ${lastCompleted.title}`
        : "-";

    return `## Current State

| Field | Value |
|-------|-------|
| **Status** | ${getStatusDisplay(state.status)} |
| **Current Step** | ${currentStepDisplay} |
| **Last Completed** | ${lastCompletedDisplay} |
| **Started** | ${formatDate(state.startedAt, dateFormat)} |
| **Last Updated** | ${formatDate(state.lastUpdatedAt, dateFormat)} |
| **Progress** | ${progress}% (${completedCount}/${steps.length} steps) |
`;
}

/**
 * Generate the Phase Progress section
 */
function generatePhaseProgressSection(plan: Plan): string {
    if (!plan.phases || plan.phases.length === 0) return "";

    let content = `## Phase Progress

| Phase | Steps | Status | Progress |
|-------|-------|--------|----------|
`;

    for (const phase of plan.phases) {
        const phaseSteps = plan.steps.filter((s) =>
            phase.steps.includes(s.number)
        );
        const completed = phaseSteps.filter(
            (s) => s.status === "completed"
        ).length;
        const progress = `${completed}/${phaseSteps.length}`;
        const stepRange = `${String(phase.steps[0]).padStart(2, "0")}-${String(phase.steps[phase.steps.length - 1]).padStart(2, "0")}`;
        const statusText =
            phase.status.charAt(0).toUpperCase() +
            phase.status.slice(1).replace("_", " ");

        content += `| **${phase.name}** | ${stepRange} | ${getStatusEmoji(phase.status)} ${statusText} | ${progress} |\n`;
    }

    return content + "\n";
}

/**
 * Generate the Step Progress section
 */
async function generateStepProgressSection(
    planPath: string,
    steps: PlanStep[],
    dateFormat: "iso" | "short" | "long"
): Promise<string> {
    let content = `## Step Progress

| Step | Name | Status | Started | Completed | Reflected | Notes |
|------|------|--------|---------|-----------|-----------|-------|
`;

    for (const step of steps) {
        const num = String(step.number).padStart(2, "0");
        const started = formatDate(step.startedAt, dateFormat);
        const completed = formatDate(step.completedAt, dateFormat);
        const notes = step.notes || "";
        
        // Check if reflection exists for this step
        const hasReflection = await readStepReflection(planPath, step.number);
        const reflected = hasReflection ? "📝" : "";

        content += `| ${num} | ${step.title} | ${getStatusEmoji(step.status)} | ${started} | ${completed} | ${reflected} | ${notes} |\n`;
    }

    return content + "\n";
}

/**
 * Generate the Blockers section
 */
function generateBlockersSection(blockers: Blocker[]): string {
    if (blockers.length === 0) {
        return `## Blockers

None currently.

`;
    }

    let content = `## Blockers

`;
    for (const blocker of blockers) {
        content += `- ${blocker.description}`;
        if (blocker.affectedSteps && blocker.affectedSteps.length > 0) {
            content += ` (affects steps: ${blocker.affectedSteps.join(", ")})`;
        }
        content += "\n";
    }

    return content + "\n";
}

/**
 * Generate the Issues section
 */
function generateIssuesSection(issues: Issue[]): string {
    if (issues.length === 0) {
        return `## Issues

None currently.

`;
    }

    let content = `## Issues

`;
    for (const issue of issues) {
        content += `- **${issue.title}**: ${issue.description}\n`;
    }

    return content + "\n";
}

/**
 * Generate the Notes section
 */
function generateNotesSection(existingNotes?: string): string {
    const notes = existingNotes || "";

    return `## Notes

${notes}

`;
}

/**
 * Generate the footer with status legend
 */
function generateFooter(dateFormat: "iso" | "short" | "long"): string {
    return `---

**Status Legend**:
- ${PLAN_CONVENTIONS.statusEmoji.pending} Pending
- ${PLAN_CONVENTIONS.statusEmoji.in_progress} In Progress
- ${PLAN_CONVENTIONS.statusEmoji.completed} Completed
- ${PLAN_CONVENTIONS.statusEmoji.failed} Failed
- ${PLAN_CONVENTIONS.statusEmoji.blocked} Blocked
- ${PLAN_CONVENTIONS.statusEmoji.skipped} Skipped

*Last updated: ${formatDate(new Date(), dateFormat)}*
`;
}

// ===== MAIN FUNCTIONS =====

/**
 * Generate a complete STATUS.md document from a plan
 */
export async function generateStatus(
    plan: Plan,
    options: GenerateStatusOptions = {}
): Promise<string> {
    const {
        preserveNotes = true,
        existingContent,
        includePhases = true,
        dateFormat = "short",
    } = options;

    // Extract existing notes if preserving
    let existingNotes: string | undefined;
    if (preserveNotes && existingContent) {
        // Use line-by-line parsing to avoid polynomial regex
        const lines = existingContent.split('\n');
        const noteLines: string[] = [];
        let inNotes = false;
        
        for (const line of lines) {
            if (/^## Notes$/i.test(line)) {
                inNotes = true;
                continue;
            }
            if (inNotes && (/^##/.test(line) || /^---/.test(line))) {
                break;
            }
            if (inNotes) {
                noteLines.push(line);
            }
        }
        
        if (noteLines.length > 0) {
            existingNotes = noteLines.join('\n').trim();
        }
    }

    // Build document
    let content = `# ${plan.metadata.name} Status

`;

    // Current state
    content += generateCurrentStateSection(plan, dateFormat);
    content += "\n";

    // Phase progress (if applicable)
    if (includePhases && plan.phases && plan.phases.length > 0) {
        content += generatePhaseProgressSection(plan);
    }

    // Step progress (now async to check for reflections)
    content += await generateStepProgressSection(plan.metadata.path, plan.steps, dateFormat);

    // Blockers
    content += generateBlockersSection(plan.state.blockers);

    // Issues
    content += generateIssuesSection(plan.state.issues);

    // Notes
    content += generateNotesSection(existingNotes);

    // Footer
    content += generateFooter(dateFormat);

    return content;
}

/**
 * Update a plan's state based on status changes
 */
export function updateStatus(plan: Plan, updates: UpdateStatusOptions): Plan {
    const updatedState = { ...plan.state };
    const updatedSteps = plan.steps.map((s) => ({ ...s }));

    // Update step status
    if (updates.step !== undefined && updates.stepStatus) {
        const stepIndex = updatedSteps.findIndex(
            (s) => s.number === updates.step
        );
        if (stepIndex >= 0) {
            updatedSteps[stepIndex] = {
                ...updatedSteps[stepIndex],
                status: updates.stepStatus,
                startedAt:
                    updates.stepStatus === "in_progress"
                        ? new Date()
                        : updatedSteps[stepIndex].startedAt,
                completedAt:
                    updates.stepStatus === "completed"
                        ? new Date()
                        : updatedSteps[stepIndex].completedAt,
            };

            // Update plan state
            if (updates.stepStatus === "in_progress") {
                updatedState.currentStep = updates.step;
                if (updatedState.status === "pending") {
                    updatedState.status = "in_progress";
                    updatedState.startedAt = new Date();
                }
            } else if (updates.stepStatus === "completed") {
                updatedState.lastCompletedStep = updates.step;

                // Check if all complete
                const allComplete = updatedSteps.every(
                    (s) => s.status === "completed" || s.status === "skipped"
                );
                if (allComplete) {
                    updatedState.status = "completed";
                    updatedState.completedAt = new Date();
                }
            }
        }
    }

    // Add blocker
    if (updates.addBlocker) {
        updatedState.blockers = [
            ...updatedState.blockers,
            {
                id: `blocker-${Date.now()}`,
                description: updates.addBlocker,
                severity: "medium",
                affectedSteps: [],
                createdAt: new Date(),
            },
        ];
    }

    // Remove blocker
    if (updates.removeBlocker) {
        updatedState.blockers = updatedState.blockers.filter(
            (b) => !b.description.includes(updates.removeBlocker!)
        );
    }

    // Add issue
    if (updates.addIssue) {
        updatedState.issues = [
            ...updatedState.issues,
            {
                id: `issue-${Date.now()}`,
                title: updates.addIssue.title,
                description: updates.addIssue.description,
                severity: "medium",
                createdAt: new Date(),
            },
        ];
    }

    // Update timestamp
    updatedState.lastUpdatedAt = new Date();

    // Calculate progress
    const completedCount = updatedSteps.filter(
        (s) => s.status === "completed"
    ).length;
    updatedState.progress =
        updatedSteps.length > 0
            ? Math.round((completedCount / updatedSteps.length) * 100)
            : 0;

    return {
        ...plan,
        steps: updatedSteps,
        state: updatedState,
    };
}

