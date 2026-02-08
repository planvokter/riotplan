/**
 * Step Operations
 *
 * Provides functions for manipulating plan steps:
 * - Insert, remove, move steps with automatic renumbering
 * - Status changes (start, complete, block, unblock)
 */

import { readdir, rename, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Plan, PlanStep, TaskStatus } from "../types.js";
import { PLAN_CONVENTIONS } from "../types.js";

// ===== TYPES =====

export interface InsertStepOptions {
    /** Step title */
    title: string;

    /** Step description */
    description?: string;

    /** Position to insert (1-based). If omitted, appends. */
    position?: number;

    /** Insert after this step number */
    after?: number;

    /** Initial status */
    status?: TaskStatus;
}

export interface InsertStepResult {
    /** Inserted step */
    step: PlanStep;

    /** Files that were renamed */
    renamedFiles: Array<{ from: string; to: string }>;

    /** Created file path */
    createdFile: string;
}

export interface RemoveStepResult {
    /** Removed step */
    removedStep: PlanStep;

    /** Files that were renamed */
    renamedFiles: Array<{ from: string; to: string }>;

    /** Deleted file path */
    deletedFile: string;
}

export interface MoveStepResult {
    /** Moved step */
    step: PlanStep;

    /** New position */
    newPosition: number;

    /** Files that were renamed */
    renamedFiles: Array<{ from: string; to: string }>;
}

// ===== INTERNAL TYPES =====

interface StepFile {
    number: number;
    code: string;
    filename: string;
    path: string;
}

// ===== HELPER FUNCTIONS =====

/**
 * Get step files from a plan directory
 */
async function getStepFiles(planPath: string): Promise<StepFile[]> {
    // Try standard plan subdirectory first
    let planDir = join(planPath, PLAN_CONVENTIONS.standardDirs.plan);
    let entries: string[];

    try {
        entries = await readdir(planDir);
    } catch {
        // Fall back to root directory
        planDir = planPath;
        entries = await readdir(planDir);
    }

    const stepFiles: StepFile[] = [];

    for (const entry of entries) {
        const match = entry.match(PLAN_CONVENTIONS.stepPattern);
        if (match) {
            stepFiles.push({
                number: parseInt(match[1]),
                code: match[2],
                filename: entry,
                path: join(planDir, entry),
            });
        }
    }

    return stepFiles.sort((a, b) => a.number - b.number);
}

/**
 * Get the plan directory (creates plan/ subdirectory if it doesn't exist)
 */
async function getPlanDir(planPath: string): Promise<string> {
    const standardDir = join(planPath, PLAN_CONVENTIONS.standardDirs.plan);
    try {
        await readdir(standardDir);
        return standardDir;
    } catch {
        // Create plan/ subdirectory if it doesn't exist
        await mkdir(standardDir, { recursive: true });
        return standardDir;
    }
}

/**
 * Generate a step filename from number and code
 */
function generateStepFilename(number: number, code: string): string {
    return `${String(number).padStart(2, "0")}-${code}.md`;
}

/**
 * Generate a code from a title
 */
function generateCode(title: string): string {
    return title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

/**
 * Renumber steps starting from a position
 */
async function renumberSteps(
    planPath: string,
    fromNumber: number,
    delta: number // +1 for insert, -1 for remove
): Promise<Array<{ from: string; to: string }>> {
    const planDir = await getPlanDir(planPath);
    const stepFiles = await getStepFiles(planPath);
    const renames: Array<{ from: string; to: string }> = [];

    // Sort in reverse for positive delta (avoid collisions)
    const sortedFiles =
        delta > 0
            ? stepFiles.filter((f) => f.number >= fromNumber).reverse()
            : stepFiles.filter((f) => f.number > fromNumber);

    for (const file of sortedFiles) {
        const newNumber = file.number + delta;
        const newFilename = generateStepFilename(newNumber, file.code);
        const newPath = join(planDir, newFilename);

        if (file.filename !== newFilename) {
            await rename(file.path, newPath);
            renames.push({ from: file.filename, to: newFilename });

            // Update step number reference inside the file
            const content = await readFile(newPath, "utf-8");
            const updatedContent = content.replace(
                /^#\s+Step\s+\d+:/m,
                `# Step ${String(newNumber).padStart(2, "0")}:`
            );
            if (updatedContent !== content) {
                await writeFile(newPath, updatedContent);
            }
        }
    }

    return renames;
}

/**
 * Generate step file content
 */
function generateStepContent(
    number: number,
    title: string,
    description?: string
): string {
    const num = String(number).padStart(2, "0");
    return `# Step ${num}: ${title}

## Objective

${description || "Describe the objective of this step."}

## Background

Provide context and rationale for this step.

## Tasks

### 1. Task 1

Description of task 1.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Testing

Describe how to verify this step is complete.

## Files Changed

- File 1

## Notes

`;
}

// ===== INSERT STEP =====

/**
 * Insert a new step into a plan
 */
export async function insertStep(
    plan: Plan,
    options: InsertStepOptions
): Promise<InsertStepResult> {
    const planDir = await getPlanDir(plan.metadata.path);

    // Determine position
    let position: number;
    if (options.position !== undefined) {
        position = options.position;
    } else if (options.after !== undefined) {
        position = options.after + 1;
    } else {
        position = plan.steps.length + 1;
    }

    // Validate position
    if (position < 1 || position > plan.steps.length + 1) {
        throw new Error(
            `Invalid position ${position}. Must be between 1 and ${plan.steps.length + 1}`
        );
    }

    // Renumber existing steps (only if inserting in the middle)
    let renamedFiles: Array<{ from: string; to: string }> = [];
    if (position <= plan.steps.length) {
        renamedFiles = await renumberSteps(plan.metadata.path, position, 1);
    }

    // Generate new step
    const code = generateCode(options.title);
    const filename = generateStepFilename(position, code);
    const filePath = join(planDir, filename);

    // Generate content
    const content = generateStepContent(
        position,
        options.title,
        options.description
    );
    await writeFile(filePath, content);

    // Create step object
    const step: PlanStep = {
        number: position,
        code,
        filename,
        title: options.title,
        description: options.description,
        status: options.status || "pending",
        filePath,
    };

    return {
        step,
        renamedFiles,
        createdFile: filePath,
    };
}

// ===== REMOVE STEP =====

/**
 * Remove a step from a plan
 */
export async function removeStep(
    plan: Plan,
    stepNumber: number
): Promise<RemoveStepResult> {
    // Find step
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    // Delete file
    await rm(step.filePath);

    // Renumber remaining steps
    const renamedFiles = await renumberSteps(plan.metadata.path, stepNumber, -1);

    return {
        removedStep: step,
        renamedFiles,
        deletedFile: step.filePath,
    };
}

// ===== MOVE STEP =====

/**
 * Move a step to a new position
 */
export async function moveStep(
    plan: Plan,
    fromNumber: number,
    toNumber: number
): Promise<MoveStepResult> {
    if (fromNumber === toNumber) {
        throw new Error("Source and destination are the same");
    }

    const step = plan.steps.find((s) => s.number === fromNumber);
    if (!step) {
        throw new Error(`Step ${fromNumber} not found`);
    }

    if (toNumber < 1 || toNumber > plan.steps.length) {
        throw new Error(`Invalid destination ${toNumber}`);
    }

    const planDir = await getPlanDir(plan.metadata.path);
    const renamedFiles: Array<{ from: string; to: string }> = [];

    // Temporary rename to avoid collision
    const tempPath = join(planDir, `__temp_${step.filename}`);
    await rename(step.filePath, tempPath);

    // Renumber affected steps
    if (fromNumber < toNumber) {
        // Moving down: shift steps up
        for (let i = fromNumber + 1; i <= toNumber; i++) {
            const s = plan.steps.find((st) => st.number === i);
            if (s) {
                const newFilename = generateStepFilename(i - 1, s.code);
                const newPath = join(planDir, newFilename);
                await rename(s.filePath, newPath);
                renamedFiles.push({ from: s.filename, to: newFilename });

                // Update content
                const content = await readFile(newPath, "utf-8");
                const updatedContent = content.replace(
                    /^#\s+Step\s+\d+:/m,
                    `# Step ${String(i - 1).padStart(2, "0")}:`
                );
                if (updatedContent !== content) {
                    await writeFile(newPath, updatedContent);
                }
            }
        }
    } else {
        // Moving up: shift steps down (in reverse to avoid collisions)
        for (let i = fromNumber - 1; i >= toNumber; i--) {
            const s = plan.steps.find((st) => st.number === i);
            if (s) {
                const newFilename = generateStepFilename(i + 1, s.code);
                const newPath = join(planDir, newFilename);
                await rename(s.filePath, newPath);
                renamedFiles.push({ from: s.filename, to: newFilename });

                // Update content
                const content = await readFile(newPath, "utf-8");
                const updatedContent = content.replace(
                    /^#\s+Step\s+\d+:/m,
                    `# Step ${String(i + 1).padStart(2, "0")}:`
                );
                if (updatedContent !== content) {
                    await writeFile(newPath, updatedContent);
                }
            }
        }
    }

    // Move step to final position
    const newFilename = generateStepFilename(toNumber, step.code);
    const newPath = join(planDir, newFilename);
    await rename(tempPath, newPath);
    renamedFiles.push({ from: step.filename, to: newFilename });

    // Update step number in file content
    const content = await readFile(newPath, "utf-8");
    const updatedContent = content.replace(
        /^#\s+Step\s+\d+:/m,
        `# Step ${String(toNumber).padStart(2, "0")}:`
    );
    if (updatedContent !== content) {
        await writeFile(newPath, updatedContent);
    }

    return {
        step: {
            ...step,
            number: toNumber,
            filename: newFilename,
            filePath: newPath,
        },
        newPosition: toNumber,
        renamedFiles,
    };
}

// ===== STATUS CHANGE FUNCTIONS =====

/**
 * Block a step with a reason
 */
export function blockStep(
    plan: Plan,
    stepNumber: number,
    reason: string
): PlanStep {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    return {
        ...step,
        status: "blocked",
        notes: reason,
    };
}

/**
 * Unblock a step
 */
export function unblockStep(plan: Plan, stepNumber: number): PlanStep {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    return {
        ...step,
        status: "pending",
        notes: undefined,
    };
}

/**
 * Complete a step
 */
export function completeStep(
    plan: Plan,
    stepNumber: number,
    notes?: string
): PlanStep {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    return {
        ...step,
        status: "completed",
        completedAt: new Date(),
        notes,
    };
}

/**
 * Start a step
 */
export function startStep(plan: Plan, stepNumber: number): PlanStep {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    return {
        ...step,
        status: "in_progress",
        startedAt: new Date(),
    };
}

/**
 * Skip a step
 */
export function skipStep(
    plan: Plan,
    stepNumber: number,
    reason?: string
): PlanStep {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    return {
        ...step,
        status: "skipped",
        notes: reason,
    };
}

/**
 * Fail a step
 */
export function failStep(
    plan: Plan,
    stepNumber: number,
    reason?: string
): PlanStep {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    return {
        ...step,
        status: "failed",
        notes: reason,
    };
}

