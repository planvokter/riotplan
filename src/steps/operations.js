/**
 * Step Operations
 *
 * Provides functions for manipulating plan steps:
 * - Insert, remove, move steps with automatic renumbering
 * - Status changes (start, complete, block, unblock)
 *
 * All operations use SQLite .plan files via riotplan-format.
 */
import { join } from "node:path";
import { VerificationEngine, VerificationError } from "@planvokter/riotplan-verify";
import { loadConfig } from "../config/loader.js";
import { generateRetrospective } from "../retrospective/generator.js";
import { createSqliteProvider } from "@planvokter/riotplan-format";
// ===== HELPER FUNCTIONS =====
function generateStepFilename(number, code) {
    return `${String(number).padStart(2, "0")}-${code}.md`;
}
function generateCode(title) {
    return title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}
function generateStepContent(number, title, description) {
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
export async function insertStep(plan, options) {
    let position;
    if (options.position !== undefined) {
        position = options.position;
    }
    else if (options.after !== undefined) {
        position = options.after + 1;
    }
    else {
        position = plan.steps.length + 1;
    }
    if (position < 1 || position > plan.steps.length + 1) {
        throw new Error(`Invalid position ${position}. Must be between 1 and ${plan.steps.length + 1}`);
    }
    const code = generateCode(options.title);
    const filename = generateStepFilename(position, code);
    const content = generateStepContent(position, options.title, options.description);
    const provider = createSqliteProvider(plan.metadata.path);
    try {
        const stepsResult = await provider.getSteps();
        if (!stepsResult.success) {
            throw new Error(stepsResult.error || "Failed to read steps");
        }
        const existingSteps = stepsResult.data || [];
        const renamedFiles = [];
        for (const s of [...existingSteps].sort((a, b) => b.number - a.number)) {
            if (s.number >= position) {
                const oldFilename = generateStepFilename(s.number, s.code);
                const newFilename = generateStepFilename(s.number + 1, s.code);
                const updatedContent = s.content.replace(/^#\s+Step\s+\d+:/m, `# Step ${String(s.number + 1).padStart(2, "0")}:`);
                await provider.deleteStep(s.number);
                await provider.addStep({
                    ...s,
                    number: s.number + 1,
                    content: updatedContent !== s.content ? updatedContent : s.content,
                });
                renamedFiles.push({ from: oldFilename, to: newFilename });
            }
        }
        const fmtStep = {
            number: position,
            code,
            title: options.title,
            description: options.description,
            status: options.status || "pending",
            content,
        };
        const addResult = await provider.addStep(fmtStep);
        if (!addResult.success) {
            throw new Error(addResult.error || "Failed to add step");
        }
        const step = {
            number: position,
            code,
            filename,
            title: options.title,
            description: options.description,
            status: options.status || "pending",
            filePath: join(plan.metadata.path, "plan", filename),
        };
        return { step, renamedFiles, createdFile: filename };
    }
    finally {
        await provider.close();
    }
}
// ===== REMOVE STEP =====
export async function removeStep(plan, stepNumber) {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }
    const provider = createSqliteProvider(plan.metadata.path);
    try {
        const delResult = await provider.deleteStep(step.number);
        if (!delResult.success) {
            throw new Error(delResult.error || "Failed to delete step");
        }
        const stepsResult = await provider.getSteps();
        const remaining = (stepsResult.data || []).sort((a, b) => a.number - b.number);
        const renamedFiles = [];
        for (const s of remaining) {
            if (s.number > step.number) {
                const oldFilename = generateStepFilename(s.number, s.code);
                const newNumber = s.number - 1;
                const newFilename = generateStepFilename(newNumber, s.code);
                const updatedContent = s.content.replace(/^#\s+Step\s+\d+:/m, `# Step ${String(newNumber).padStart(2, "0")}:`);
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
    }
    finally {
        await provider.close();
    }
}
// ===== MOVE STEP =====
export async function moveStep(plan, fromNumber, toNumber) {
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
    const provider = createSqliteProvider(plan.metadata.path);
    try {
        const stepsResult = await provider.getSteps();
        if (!stepsResult.success) {
            throw new Error(stepsResult.error || "Failed to read steps");
        }
        const allSteps = stepsResult.data || [];
        const renamedFiles = [];
        const movingStep = allSteps.find((s) => s.number === fromNumber);
        if (!movingStep) {
            throw new Error(`Step ${fromNumber} not found in database`);
        }
        const tempNumber = allSteps.length + 100;
        await provider.deleteStep(fromNumber);
        await provider.addStep({ ...movingStep, number: tempNumber });
        if (fromNumber < toNumber) {
            for (let i = fromNumber + 1; i <= toNumber; i++) {
                const s = allSteps.find((st) => st.number === i);
                if (s) {
                    const newNum = i - 1;
                    const updatedContent = s.content.replace(/^#\s+Step\s+\d+:/m, `# Step ${String(newNum).padStart(2, "0")}:`);
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
        else {
            for (let i = fromNumber - 1; i >= toNumber; i--) {
                const s = allSteps.find((st) => st.number === i);
                if (s) {
                    const newNum = i + 1;
                    const updatedContent = s.content.replace(/^#\s+Step\s+\d+:/m, `# Step ${String(newNum).padStart(2, "0")}:`);
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
        const movedContent = movingStep.content.replace(/^#\s+Step\s+\d+:/m, `# Step ${String(toNumber).padStart(2, "0")}:`);
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
    }
    finally {
        await provider.close();
    }
}
// ===== STATUS CHANGE FUNCTIONS =====
export function blockStep(plan, stepNumber, reason) {
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
export function unblockStep(plan, stepNumber) {
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
export async function completeStep(plan, stepNumber, options) {
    const step = plan.steps.find((s) => s.number === stepNumber);
    if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
    }
    const config = await loadConfig();
    const verificationConfig = config?.verification;
    if (!options?.skipVerification && verificationConfig) {
        const engine = new VerificationEngine();
        const result = await engine.verifyStepCompletion(plan, stepNumber, {
            enforcement: verificationConfig.enforcement,
            checkAcceptanceCriteria: verificationConfig.checkAcceptanceCriteria,
            checkArtifacts: verificationConfig.checkArtifacts,
            force: options?.force,
        });
        if (engine.shouldBlock(result, {
            enforcement: verificationConfig.enforcement,
            checkAcceptanceCriteria: verificationConfig.checkAcceptanceCriteria,
            checkArtifacts: verificationConfig.checkArtifacts,
            force: options?.force,
        })) {
            throw new VerificationError(result.messages.join('\n'), result);
        }
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
        status: "completed",
        completedAt: new Date(),
        notes: options?.notes,
    };
    if (verificationConfig?.autoRetrospective) {
        const updatedPlan = {
            ...plan,
            steps: plan.steps.map(s => s.number === stepNumber ? completedStep : s),
        };
        const allStepsComplete = updatedPlan.steps.every(s => s.status === 'completed' || s.status === 'skipped');
        if (allStepsComplete) {
            try {
                await generateRetrospective(plan.metadata.path, {
                    force: false,
                });
            }
            catch {
                // Don't block completion if retrospective generation fails
            }
        }
    }
    return completedStep;
}
export function startStep(plan, stepNumber) {
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
export function skipStep(plan, stepNumber, reason) {
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
export function failStep(plan, stepNumber, reason) {
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
//# sourceMappingURL=operations.js.map