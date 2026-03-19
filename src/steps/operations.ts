/**
 * Step Operations
 *
 * Provides functions for manipulating plan steps:
 * - Insert, remove, move steps with automatic renumbering
 * - Status changes (start, complete, block, unblock)
 *
 * Supports both directory-based plans and SQLite .plan files.
 */

import { readdir, rename, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Plan, PlanStep, TaskStatus } from "../types.js";
import { PLAN_CONVENTIONS } from "../types.js";
import { VerificationEngine, VerificationError } from "@kjerneverk/riotplan-verify";
import { loadConfig } from "../config/loader.js";
import { generateRetrospective } from "../retrospective/generator.js";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";
import type { PlanStep as FormatStep } from "@kjerneverk/riotplan-format";

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
    // Determine position
    let position: number;
    if (options.position !== undefined) {
        position = options.position;
    } else if (options.after !== undefined) {
        position = options.after + 1;
    } else {
        position = plan.steps.length + 1;
    }

    if (position < 1 || position > plan.steps.length + 1) {
        throw new Error(
            `Invalid position ${position}. Must be between 1 and ${plan.steps.length + 1}`
        );
    }

    const code = generateCode(options.title);
    const filename = generateStepFilename(position, code);
    const content = generateStepContent(position, options.title, options.description);

    if (plan.metadata.path.endsWith(".plan")) {
        return insertStepSqlite(plan, position, code, filename, content, options);
    }

    return insertStepDirectory(plan, position, code, filename, content, options);
}

async function insertStepSqlite(
    plan: Plan,
    position: number,
    code: string,
    filename: string,
    content: string,
    options: InsertStepOptions
): Promise<InsertStepResult> {
    const provider = createSqliteProvider(plan.metadata.path);
    try {
        const stepsResult = await provider.getSteps();
        if (!stepsResult.success) {
            throw new Error(stepsResult.error || "Failed to read steps");
        }
        const existingSteps = stepsResult.data || [];

        const renamedFiles: Array<{ from: string; to: string }> = [];
        for (const s of [...existingSteps].sort((a, b) => b.number - a.number)) {
            if (s.number >= position) {
                const oldFilename = generateStepFilename(s.number, s.code);
                const newFilename = generateStepFilename(s.number + 1, s.code);
                const updatedContent = s.content.replace(
                    /^#\s+Step\s+\d+:/m,
                    `# Step ${String(s.number + 1).padStart(2, "0")}:`
                );
                await provider.deleteStep(s.number);
                await provider.addStep({
                    ...s,
                    number: s.number + 1,
                    content: updatedContent !== s.content ? updatedContent : s.content,
                });
                renamedFiles.push({ from: oldFilename, to: newFilename });
            }
        }

        const fmtStep: FormatStep = {
            number: position,
            code,
            title: options.title,
            description: options.description,
            status: (options.status as FormatStep["status"]) || "pending",
            content,
        };
        const addResult = await provider.addStep(fmtStep);
        if (!addResult.success) {
            throw new Error(addResult.error || "Failed to add step");
        }

        const step: PlanStep = {
            number: position,
            code,
            filename,
            title: options.title,
            description: options.description,
            status: options.status || "pending",
            filePath: join(plan.metadata.path, "plan", filename),
        };

        return { step, renamedFiles, createdFile: filename };
    } finally {
        await provider.close();
    }
}

async function insertStepDirectory(
    plan: Plan,
    position: number,
    code: string,
    filename: string,
    content: string,
    options: InsertStepOptions
): Promise<InsertStepResult> {
    const planDir = await getPlanDir(plan.metadata.path);

    let renamedFiles: Array<{ from: string; to: string }> = [];
    if (position <= plan.steps.length) {
        renamedFiles = await renumberSteps(plan.metadata.path, position, 1);
    }

    const filePath = join(planDir, filename);
    await writeFile(filePath, content);

    const step: PlanStep = {
        number: position,
        code,
        filename,
        title: options.title,
        description: options.description,
        status: options.status || "pending",
        filePath,
    };

    return { step, renamedFiles, createdFile: filePath };
}

// ===== REMOVE STEP =====

/**
 * Remove a step from a plan
 */
export async function removeStep(
    plan: Plan,
    stepNumber: number
): Promise<RemoveStepResult> {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    if (plan.metadata.path.endsWith(".plan")) {
        return removeStepSqlite(plan, step);
    }

    await rm(step.filePath);
    const renamedFiles = await renumberSteps(plan.metadata.path, stepNumber, -1);

    return { removedStep: step, renamedFiles, deletedFile: step.filePath };
}

async function removeStepSqlite(
    plan: Plan,
    step: PlanStep
): Promise<RemoveStepResult> {
    const provider = createSqliteProvider(plan.metadata.path);
    try {
        const delResult = await provider.deleteStep(step.number);
        if (!delResult.success) {
            throw new Error(delResult.error || "Failed to delete step");
        }

        const stepsResult = await provider.getSteps();
        const remaining = (stepsResult.data || []).sort((a, b) => a.number - b.number);
        const renamedFiles: Array<{ from: string; to: string }> = [];

        for (const s of remaining) {
            if (s.number > step.number) {
                const oldFilename = generateStepFilename(s.number, s.code);
                const newNumber = s.number - 1;
                const newFilename = generateStepFilename(newNumber, s.code);
                const updatedContent = s.content.replace(
                    /^#\s+Step\s+\d+:/m,
                    `# Step ${String(newNumber).padStart(2, "0")}:`
                );
                await provider.deleteStep(s.number);
                await provider.addStep({
                    ...s,
                    number: newNumber,
                    content: updatedContent !== s.content ? updatedContent : s.content,
                });
                renamedFiles.push({ from: oldFilename, to: newFilename });
            }
        }

        return { removedStep: step, renamedFiles, deletedFile: step.filename };
    } finally {
        await provider.close();
    }
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

    if (plan.metadata.path.endsWith(".plan")) {
        return moveStepSqlite(plan, step, fromNumber, toNumber);
    }

    return moveStepDirectory(plan, step, fromNumber, toNumber);
}

async function moveStepSqlite(
    plan: Plan,
    step: PlanStep,
    fromNumber: number,
    toNumber: number
): Promise<MoveStepResult> {
    const provider = createSqliteProvider(plan.metadata.path);
    try {
        const stepsResult = await provider.getSteps();
        if (!stepsResult.success) {
            throw new Error(stepsResult.error || "Failed to read steps");
        }
        const allSteps = stepsResult.data || [];
        const renamedFiles: Array<{ from: string; to: string }> = [];

        const movingStep = allSteps.find((s) => s.number === fromNumber);
        if (!movingStep) {
            throw new Error(`Step ${fromNumber} not found in database`);
        }

        // Use a temporary number to avoid unique constraint conflicts
        const tempNumber = allSteps.length + 100;
        await provider.deleteStep(fromNumber);
        await provider.addStep({ ...movingStep, number: tempNumber });

        if (fromNumber < toNumber) {
            for (let i = fromNumber + 1; i <= toNumber; i++) {
                const s = allSteps.find((st) => st.number === i);
                if (s) {
                    const newNum = i - 1;
                    const updatedContent = s.content.replace(
                        /^#\s+Step\s+\d+:/m,
                        `# Step ${String(newNum).padStart(2, "0")}:`
                    );
                    await provider.deleteStep(i);
                    await provider.addStep({
                        ...s,
                        number: newNum,
                        content: updatedContent !== s.content ? updatedContent : s.content,
                    });
                    renamedFiles.push({
                        from: generateStepFilename(i, s.code),
                        to: generateStepFilename(newNum, s.code),
                    });
                }
            }
        } else {
            for (let i = fromNumber - 1; i >= toNumber; i--) {
                const s = allSteps.find((st) => st.number === i);
                if (s) {
                    const newNum = i + 1;
                    const updatedContent = s.content.replace(
                        /^#\s+Step\s+\d+:/m,
                        `# Step ${String(newNum).padStart(2, "0")}:`
                    );
                    await provider.deleteStep(i);
                    await provider.addStep({
                        ...s,
                        number: newNum,
                        content: updatedContent !== s.content ? updatedContent : s.content,
                    });
                    renamedFiles.push({
                        from: generateStepFilename(i, s.code),
                        to: generateStepFilename(newNum, s.code),
                    });
                }
            }
        }

        const movedContent = movingStep.content.replace(
            /^#\s+Step\s+\d+:/m,
            `# Step ${String(toNumber).padStart(2, "0")}:`
        );
        await provider.deleteStep(tempNumber);
        await provider.addStep({
            ...movingStep,
            number: toNumber,
            content: movedContent !== movingStep.content ? movedContent : movingStep.content,
        });

        const newFilename = generateStepFilename(toNumber, step.code);
        renamedFiles.push({ from: step.filename, to: newFilename });

        return {
            step: {
                ...step,
                number: toNumber,
                filename: newFilename,
                filePath: join(plan.metadata.path, "plan", newFilename),
            },
            newPosition: toNumber,
            renamedFiles,
        };
    } finally {
        await provider.close();
    }
}

async function moveStepDirectory(
    plan: Plan,
    step: PlanStep,
    fromNumber: number,
    toNumber: number
): Promise<MoveStepResult> {
    const planDir = await getPlanDir(plan.metadata.path);
    const renamedFiles: Array<{ from: string; to: string }> = [];

    const tempPath = join(planDir, `__temp_${step.filename}`);
    await rename(step.filePath, tempPath);

    if (fromNumber < toNumber) {
        for (let i = fromNumber + 1; i <= toNumber; i++) {
            const s = plan.steps.find((st) => st.number === i);
            if (s) {
                const newFilename = generateStepFilename(i - 1, s.code);
                const newPath = join(planDir, newFilename);
                await rename(s.filePath, newPath);
                renamedFiles.push({ from: s.filename, to: newFilename });

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
        for (let i = fromNumber - 1; i >= toNumber; i--) {
            const s = plan.steps.find((st) => st.number === i);
            if (s) {
                const newFilename = generateStepFilename(i + 1, s.code);
                const newPath = join(planDir, newFilename);
                await rename(s.filePath, newPath);
                renamedFiles.push({ from: s.filename, to: newFilename });

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

    const newFilename = generateStepFilename(toNumber, step.code);
    const newPath = join(planDir, newFilename);
    await rename(tempPath, newPath);
    renamedFiles.push({ from: step.filename, to: newFilename });

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
 * Options for step completion
 */
export interface CompleteStepOptions {
    /** Notes about the completion */
    notes?: string;
    /** Force completion even if verification fails */
    force?: boolean;
    /** Skip verification entirely */
    skipVerification?: boolean;
}

/**
 * Complete a step with optional verification
 */
export async function completeStep(
    plan: Plan,
    stepNumber: number,
    options?: CompleteStepOptions
): Promise<PlanStep> {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }

    // Load configuration
    const config = await loadConfig();
    const verificationConfig = config?.verification;

    // Run verification if enabled and not skipped
    if (!options?.skipVerification && verificationConfig) {
        const engine = new VerificationEngine();
        const result = await engine.verifyStepCompletion(plan, stepNumber, {
            enforcement: verificationConfig.enforcement,
            checkAcceptanceCriteria: verificationConfig.checkAcceptanceCriteria,
            checkArtifacts: verificationConfig.checkArtifacts,
            force: options?.force,
        });

        // Check if we should block completion
        if (engine.shouldBlock(result, {
            enforcement: verificationConfig.enforcement,
            checkAcceptanceCriteria: verificationConfig.checkAcceptanceCriteria,
            checkArtifacts: verificationConfig.checkArtifacts,
            force: options?.force,
        })) {
            throw new VerificationError(
                result.messages.join('\n'),
                result
            );
        }

        // Store verification result in step notes if there are messages
        if (result.messages.length > 0 && result.level !== 'passed') {
            const verificationNotes = `\n\nVerification (${result.level}):\n${result.messages.join('\n')}`;
            options = {
                ...options,
                notes: (options?.notes || '') + verificationNotes,
            };
        }
    }

    const completedStep = {
        ...step,
        status: "completed" as TaskStatus,
        completedAt: new Date(),
        notes: options?.notes,
    };

    // Check if all steps are now complete and auto-generate retrospective
    if (verificationConfig?.autoRetrospective) {
        const updatedPlan = {
            ...plan,
            steps: plan.steps.map(s => s.number === stepNumber ? completedStep : s),
        };
        
        const allStepsComplete = updatedPlan.steps.every(s => 
            s.status === 'completed' || s.status === 'skipped'
        );
        
        if (allStepsComplete) {
            try {
                await generateRetrospective(plan.metadata.path, {
                    force: false,
                });
            } catch {
                // Don't block completion if retrospective generation fails
                // Silently continue - retrospective can be generated manually later
            }
        }
    }

    return completedStep;
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

