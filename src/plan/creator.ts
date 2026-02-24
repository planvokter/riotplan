/**
 * Plan Creator Module
 *
 * Creates new plan directories with standard structure and files.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Plan, PlanStep } from "../types.js";
import { PLAN_CONVENTIONS } from "../types.js";

// ===== TYPES =====

/**
 * Configuration for creating a new plan
 */
export interface CreatePlanConfig {
    /** Plan code/slug (directory name) - lowercase letters, numbers, hyphens only */
    code: string;

    /** Human-readable name */
    name: string;

    /** Base path for plan (plan created as subdirectory) */
    basePath: string;

    /** Plan description */
    description?: string;

    /** Initial steps */
    steps?: Array<{ title: string; description?: string }>;

    /** Context assignment */
    context?: string;

    /** Author name */
    author?: string;

    /** Create feedback directory (default: true) */
    createFeedbackDir?: boolean;

    /** Create evidence directory (default: true) */
    createEvidenceDir?: boolean;

    /** Template to use (basic support) */
    template?: "blank" | "default";
}

/**
 * Result of plan creation
 */
export interface CreatePlanResult {
    /** Created plan */
    plan: Plan;

    /** Path where plan was created */
    path: string;

    /** Files that were created */
    filesCreated: string[];
}

// ===== MAIN EXPORT =====

/**
 * Create a new plan
 *
 * @param config - Plan configuration
 * @returns The created plan and files
 *
 * @example
 * ```typescript
 * const result = await createPlan({
 *   code: 'my-feature',
 *   name: 'My Feature Implementation',
 *   basePath: './prompts',
 *   description: 'Implementing the new feature',
 *   steps: [
 *     { title: 'Setup', description: 'Initial setup' },
 *     { title: 'Implementation', description: 'Core work' },
 *     { title: 'Testing', description: 'Verify it works' },
 *   ]
 * });
 * console.log(result.path); // './prompts/my-feature'
 * ```
 */
export async function createPlan(
    config: CreatePlanConfig
): Promise<CreatePlanResult> {
    // Validate code
    if (!/^[a-z0-9-]+$/.test(config.code)) {
        throw new Error(
            `Invalid plan code: "${config.code}". Use lowercase letters, numbers, and hyphens only.`
        );
    }

    const planPath = resolve(join(config.basePath, config.code));
    const filesCreated: string[] = [];

    // Create directories
    const createFeedback = config.createFeedbackDir ?? true;
    const createEvidence = config.createEvidenceDir ?? true;

    await createPlanDirectories(planPath, {
        feedback: createFeedback,
        evidence: createEvidence,
    });

    // Generate and write SUMMARY.md
    const summaryPath = join(planPath, PLAN_CONVENTIONS.standardFiles.summary);
    await writeFile(summaryPath, generateSummaryMd(config));
    filesCreated.push(summaryPath);

    // Generate and write EXECUTION_PLAN.md
    const execPath = join(
        planPath,
        PLAN_CONVENTIONS.standardFiles.executionPlan
    );
    await writeFile(execPath, generateExecutionPlanMd(config));
    filesCreated.push(execPath);

    // Generate and write STATUS.md
    const statusPath = join(planPath, PLAN_CONVENTIONS.standardFiles.status);
    await writeFile(statusPath, generateStatusMd(config));
    filesCreated.push(statusPath);

    // Create step files
    const steps = config.steps || getDefaultSteps();

    const createdSteps: PlanStep[] = [];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepNum = i + 1;
        const code = slugify(step.title);
        const filename = `${String(stepNum).padStart(2, "0")}-${code}.md`;
        const stepPath = join(
            planPath,
            PLAN_CONVENTIONS.standardDirs.plan,
            filename
        );

        await writeFile(
            stepPath,
            generateStepMd(stepNum, step.title, step.description)
        );
        filesCreated.push(stepPath);

        createdSteps.push({
            number: stepNum,
            code,
            filename,
            title: step.title,
            description: step.description,
            status: "pending",
            filePath: stepPath,
        });
    }

    // Build subdirectories list
    const subdirectories: string[] = [PLAN_CONVENTIONS.standardDirs.plan];
    if (createFeedback) {
        subdirectories.push(PLAN_CONVENTIONS.standardDirs.feedback);
    }
    if (createEvidence) {
        subdirectories.push(PLAN_CONVENTIONS.standardDirs.evidence);
    }

    // Construct Plan object
    const plan: Plan = {
        metadata: {
            code: config.code,
            name: config.name,
            description: config.description,
            author: config.author,
            path: planPath,
            createdAt: new Date(),
        },
        files: {
            summary: PLAN_CONVENTIONS.standardFiles.summary,
            status: PLAN_CONVENTIONS.standardFiles.status,
            executionPlan: PLAN_CONVENTIONS.standardFiles.executionPlan,
            steps: createdSteps.map((s) => s.filename),
            subdirectories,
            feedbackDir: createFeedback
                ? PLAN_CONVENTIONS.standardDirs.feedback
                : undefined,
            evidenceDir: createEvidence
                ? PLAN_CONVENTIONS.standardDirs.evidence
                : undefined,
        },
        steps: createdSteps,
        state: {
            status: "pending",
            lastUpdatedAt: new Date(),
            blockers: [],
            issues: [],
            progress: 0,
        },
        context: config.context,
    };

    return { plan, path: planPath, filesCreated };
}

// ===== DIRECTORY CREATION =====

/**
 * Create plan directory structure
 */
async function createPlanDirectories(
    planPath: string,
    options: { feedback?: boolean; evidence?: boolean }
): Promise<void> {
    // Create main directory
    await mkdir(planPath, { recursive: true });

    // Create plan/ subdirectory for steps
    const planDir = join(planPath, PLAN_CONVENTIONS.standardDirs.plan);
    await mkdir(planDir, { recursive: true });

    // Create feedback/ if requested
    if (options.feedback) {
        const feedbackDir = join(
            planPath,
            PLAN_CONVENTIONS.standardDirs.feedback
        );
        await mkdir(feedbackDir, { recursive: true });
    }

    // Create evidence/ if requested
    if (options.evidence) {
        const evidenceDir = join(
            planPath,
            PLAN_CONVENTIONS.standardDirs.evidence
        );
        await mkdir(evidenceDir, { recursive: true });
    }
}

// ===== FILE GENERATORS =====

/**
 * Generate SUMMARY.md content
 */
function generateSummaryMd(config: CreatePlanConfig): string {
    const date = new Date().toISOString().split("T")[0];
    const authorLine = config.author ? `\n*Author: ${config.author}*` : "";

    return `# ${config.name}

## Overview

${config.description || "Description of this plan."}

## Goals

1. Goal 1
2. Goal 2
3. Goal 3

## Scope

### In Scope

- Item 1
- Item 2

### Out of Scope

- Item 1

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2

---

*Plan created: ${date}*${authorLine}
`;
}

/**
 * Generate EXECUTION_PLAN.md content
 */
function generateExecutionPlanMd(config: CreatePlanConfig): string {
    const date = new Date().toISOString().split("T")[0];
    const steps = config.steps || getDefaultSteps();

    let stepsSection = "";
    steps.forEach((step, i) => {
        const num = String(i + 1).padStart(2, "0");
        stepsSection += `| ${num} | ${step.title} | ${step.description || ""} |\n`;
    });

    return `# Execution Plan: ${config.name}

## Strategy

Describe the overall approach and strategy for this plan.

## Prerequisites

- [ ] Prerequisite 1
- [ ] Prerequisite 2

## Steps

| Step | Name | Description |
|------|------|-------------|
${stepsSection}
## Quality Gates

After each step:
- [ ] Tests pass
- [ ] Lint passes
- [ ] Code review complete

## Notes

Additional notes about the execution approach.

---

*Last updated: ${date}*
`;
}

/**
 * Generate STATUS.md content
 */
function generateStatusMd(config: CreatePlanConfig): string {
    const date = new Date().toISOString().split("T")[0];
    const steps = config.steps || getDefaultSteps();

    let stepsTable = "";
    steps.forEach((step, i) => {
        const num = String(i + 1).padStart(2, "0");
        stepsTable += `| ${num} | ${step.title} | ⬜ | - | - | |\n`;
    });

    return `# ${config.name} Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ⬜ PLANNING |
| **Current Step** | - |
| **Last Completed** | - |
| **Started** | - |
| **Last Updated** | ${date} |
| **Progress** | 0% (0/${steps.length} steps) |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
${stepsTable}
## Blockers

None currently.

## Issues

None currently.

## Notes

---

## Execution Tracking

**To execute this plan with RiotPlan tracking:**

1. Use \`riotplan_step({ action: "start", planId: path, step: N })\` **before** starting each step
2. Complete the work for the step
3. Use \`riotplan_step({ action: "complete", planId: path, step: N })\` **after** completing each step

**For AI Assistants:** When executing this plan, always use RiotPlan's tracking tools. Don't just do the work - use \`riotplan_step\` with \`action: "start"\` and \`action: "complete"\` to track progress. This ensures STATUS.md stays up-to-date and the plan can be resumed later.

---

*Last updated: ${date}*
`;
}

/**
 * Generate step file content
 */
function generateStepMd(
    stepNum: number,
    title: string,
    description?: string
): string {
    const num = String(stepNum).padStart(2, "0");

    return `# Step ${num}: ${title}

## Objective

${description || "Describe the objective of this step."}

## Background

Provide context and rationale for this step.

## Tasks

### 1. Task 1

Description of task 1.

### 2. Task 2

Description of task 2.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Testing

Describe how to verify this step is complete.

## Files Changed

- File 1
- File 2

## Notes

Additional notes for this step.
`;
}

// ===== UTILITIES =====

/**
 * Get default steps when none provided
 */
function getDefaultSteps(): Array<{ title: string; description?: string }> {
    return [
        { title: "Setup", description: "Initial setup and prerequisites" },
        { title: "Implementation", description: "Core implementation work" },
        { title: "Testing", description: "Verify everything works" },
    ];
}

/**
 * Convert a title to a slug
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

