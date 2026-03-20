/**
 * Step Operations
 *
 * Provides functions for manipulating plan steps:
 * - Insert, remove, move steps with automatic renumbering
 * - Status changes (start, complete, block, unblock)
 *
 * All operations use SQLite .plan files via riotplan-format.
 */
import type { Plan, PlanStep, TaskStatus } from "../types.js";
export interface InsertStepOptions {
    title: string;
    description?: string;
    position?: number;
    after?: number;
    status?: TaskStatus;
}
export interface InsertStepResult {
    step: PlanStep;
    renamedFiles: Array<{
        from: string;
        to: string;
    }>;
    createdFile: string;
}
export interface RemoveStepResult {
    removedStep: PlanStep;
    renamedFiles: Array<{
        from: string;
        to: string;
    }>;
    deletedFile: string;
}
export interface MoveStepResult {
    step: PlanStep;
    newPosition: number;
    renamedFiles: Array<{
        from: string;
        to: string;
    }>;
}
export declare function insertStep(plan: Plan, options: InsertStepOptions): Promise<InsertStepResult>;
export declare function removeStep(plan: Plan, stepNumber: number): Promise<RemoveStepResult>;
export declare function moveStep(plan: Plan, fromNumber: number, toNumber: number): Promise<MoveStepResult>;
export declare function blockStep(plan: Plan, stepNumber: number, reason: string): PlanStep;
export declare function unblockStep(plan: Plan, stepNumber: number): PlanStep;
export interface CompleteStepOptions {
    notes?: string;
    force?: boolean;
    skipVerification?: boolean;
}
export declare function completeStep(plan: Plan, stepNumber: number, options?: CompleteStepOptions): Promise<PlanStep>;
export declare function startStep(plan: Plan, stepNumber: number): PlanStep;
export declare function skipStep(plan: Plan, stepNumber: number, reason?: string): PlanStep;
export declare function failStep(plan: Plan, stepNumber: number, reason?: string): PlanStep;
//# sourceMappingURL=operations.d.ts.map