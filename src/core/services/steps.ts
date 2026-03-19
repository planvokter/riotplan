import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPlan } from "../../plan/loader.js";
import { generateStatus } from "../../status/generator.js";
import {
    completeStep,
    insertStep,
    moveStep,
    removeStep,
    startStep,
} from "../../steps/operations.js";

export interface CompleteStepInput {
    force?: boolean;
    skipVerification?: boolean;
}

export async function startDirectoryStep(planPath: string, stepNumber: number): Promise<{
    planId: string;
    step: number;
}> {
    const plan = await loadPlan(planPath);
    const updatedStep = startStep(plan, stepNumber);

    const stepIndex = plan.steps.findIndex((s) => s.number === stepNumber);
    if (stepIndex >= 0) {
        plan.steps[stepIndex] = updatedStep;
    }

    plan.state.currentStep = stepNumber;
    plan.state.status = "in_progress";
    plan.state.lastUpdatedAt = new Date();

    const statusContent = await generateStatus(plan);
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");

    return { planId: plan.metadata.code, step: stepNumber };
}

export async function completeDirectoryStep(
    planPath: string,
    stepNumber: number,
    input: CompleteStepInput
): Promise<{ planId: string; step: number; planCompleted: boolean }> {
    const plan = await loadPlan(planPath);
    const updatedStep = await completeStep(plan, stepNumber, {
        notes: undefined,
        force: input.force,
        skipVerification: input.skipVerification,
    });

    const stepIndex = plan.steps.findIndex((s) => s.number === stepNumber);
    if (stepIndex >= 0) {
        plan.steps[stepIndex] = updatedStep;
    }

    plan.state.lastCompletedStep = stepNumber;
    plan.state.lastUpdatedAt = new Date();

    const nextPending = plan.steps.find((s) => s.status === "pending");
    if (nextPending) {
        plan.state.currentStep = nextPending.number;
        plan.state.status = "in_progress";
    } else {
        plan.state.status = "completed";
        plan.state.currentStep = undefined;
    }

    const statusContent = await generateStatus(plan);
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");

    const planCompleted = plan.steps.every(
        (s) => s.status === "completed" || s.status === "skipped"
    );
    return { planId: plan.metadata.code, step: stepNumber, planCompleted };
}

export async function addDirectoryStep(
    planPath: string,
    title: string,
    number?: number,
    after?: number
): Promise<{
    planId: string;
    step: number;
    file: string;
    renamedFiles: Array<{ from: string; to: string }>;
}> {
    const plan = await loadPlan(planPath);
    const result = await insertStep(plan, {
        title,
        position: number,
        after,
        status: "pending",
    });

    return {
        planId: plan.metadata.code,
        step: result.step.number,
        file: result.createdFile,
        renamedFiles: result.renamedFiles,
    };
}

export async function removeDirectoryStep(
    planPath: string,
    stepNumber: number
): Promise<{
    planId: string;
    removedStep: number;
    removedTitle: string;
    deletedFile: string;
    renamedFiles: Array<{ from: string; to: string }>;
}> {
    const plan = await loadPlan(planPath);
    const result = await removeStep(plan, stepNumber);

    const updatedPlan = await loadPlan(planPath);
    const statusContent = await generateStatus(updatedPlan);
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");

    return {
        planId: plan.metadata.code,
        removedStep: result.removedStep.number,
        removedTitle: result.removedStep.title,
        deletedFile: result.deletedFile,
        renamedFiles: result.renamedFiles,
    };
}

export async function moveDirectoryStep(
    planPath: string,
    fromStep: number,
    toStep: number
): Promise<{
    planId: string;
    step: number;
    from: number;
    to: number;
    renamedFiles: Array<{ from: string; to: string }>;
}> {
    const plan = await loadPlan(planPath);
    const result = await moveStep(plan, fromStep, toStep);

    const updatedPlan = await loadPlan(planPath);
    const statusContent = await generateStatus(updatedPlan);
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");

    return {
        planId: plan.metadata.code,
        step: result.step.number,
        from: fromStep,
        to: toStep,
        renamedFiles: result.renamedFiles,
    };
}
