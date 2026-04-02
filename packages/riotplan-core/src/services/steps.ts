import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plan, PlanStep } from "../types.js";

export interface CompleteStepInput {
    force?: boolean;
    skipVerification?: boolean;
}

/**
 * Dependencies injected by the consumer (typically riotplan) to avoid
 * a circular dependency between riotplan-core and riotplan.
 */
export interface DirectoryStepDeps {
    loadPlan: (path: string) => Promise<Plan>;
    generateStatus: (plan: Plan) => Promise<string>;
    startStep: (plan: Plan, step: number) => PlanStep;
    completeStep: (plan: Plan, step: number, opts: { notes: undefined; force?: boolean; skipVerification?: boolean }) => Promise<PlanStep>;
    insertStep: (plan: Plan, opts: { title: string; position?: number; after?: number; status: string }) => Promise<{ step: PlanStep; createdFile: string; renamedFiles: Array<{ from: string; to: string }> }>;
    removeStep: (plan: Plan, step: number) => Promise<{ removedStep: PlanStep; deletedFile: string; renamedFiles: Array<{ from: string; to: string }> }>;
    moveStep: (plan: Plan, from: number, to: number) => Promise<{ step: PlanStep; renamedFiles: Array<{ from: string; to: string }> }>;
}

export async function startDirectoryStep(
    deps: DirectoryStepDeps,
    planPath: string,
    stepNumber: number
): Promise<{
    planId: string;
    step: number;
}> {
    const plan = await deps.loadPlan(planPath);
    const updatedStep = deps.startStep(plan, stepNumber);

    const stepIndex = plan.steps.findIndex((s) => s.number === stepNumber);
    if (stepIndex >= 0) {
        plan.steps[stepIndex] = updatedStep;
    }

    plan.state.currentStep = stepNumber;
    plan.state.status = "in_progress";
    plan.state.lastUpdatedAt = new Date();

    const statusContent = await deps.generateStatus(plan);
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");

    return { planId: plan.metadata.code, step: stepNumber };
}

export async function completeDirectoryStep(
    deps: DirectoryStepDeps,
    planPath: string,
    stepNumber: number,
    input: CompleteStepInput
): Promise<{ planId: string; step: number; planCompleted: boolean }> {
    const plan = await deps.loadPlan(planPath);
    const updatedStep = await deps.completeStep(plan, stepNumber, {
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

    const statusContent = await deps.generateStatus(plan);
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");

    const planCompleted = plan.steps.every(
        (s) => s.status === "completed" || s.status === "skipped"
    );
    return { planId: plan.metadata.code, step: stepNumber, planCompleted };
}

export async function addDirectoryStep(
    deps: DirectoryStepDeps,
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
    const plan = await deps.loadPlan(planPath);
    const result = await deps.insertStep(plan, {
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
    deps: DirectoryStepDeps,
    planPath: string,
    stepNumber: number
): Promise<{
    planId: string;
    removedStep: number;
    removedTitle: string;
    deletedFile: string;
    renamedFiles: Array<{ from: string; to: string }>;
}> {
    const plan = await deps.loadPlan(planPath);
    const result = await deps.removeStep(plan, stepNumber);

    const updatedPlan = await deps.loadPlan(planPath);
    const statusContent = await deps.generateStatus(updatedPlan);
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
    deps: DirectoryStepDeps,
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
    const plan = await deps.loadPlan(planPath);
    const result = await deps.moveStep(plan, fromStep, toStep);

    const updatedPlan = await deps.loadPlan(planPath);
    const statusContent = await deps.generateStatus(updatedPlan);
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");

    return {
        planId: plan.metadata.code,
        step: result.step.number,
        from: fromStep,
        to: toStep,
        renamedFiles: result.renamedFiles,
    };
}
