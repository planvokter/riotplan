import { randomUUID } from "node:crypto";
import { createSqliteProvider } from "@planvokter/riotplan-format";

export interface TransitionLifecycleInput {
    planPath: string;
    targetStage: string;
    reason: string;
}

export interface TransitionLifecycleResult {
    fromStage: string;
    toStage: string;
    changedAt: string;
}

export async function transitionSqliteLifecycleStage(
    input: TransitionLifecycleInput
): Promise<TransitionLifecycleResult> {
    const provider = createSqliteProvider(input.planPath);
    try {
        const metadataResult = await provider.getMetadata();
        if (!metadataResult.success || !metadataResult.data) {
            throw new Error(metadataResult.error || "Failed to load plan metadata");
        }

        if (!input.targetStage || input.targetStage.trim() === "") {
            throw new Error("Target stage cannot be empty");
        }

        const fromStage = metadataResult.data.stage;
        const changedAt = new Date().toISOString();

        if (fromStage === input.targetStage) {
            return {
                fromStage,
                toStage: input.targetStage,
                changedAt,
            };
        }

        const updateResult = await provider.updateMetadata({
            stage: input.targetStage as any,
            updatedAt: changedAt,
        });
        if (!updateResult.success) {
            throw new Error(updateResult.error || "Failed to update lifecycle stage");
        }

        const eventResult = await provider.addTimelineEvent({
            id: randomUUID(),
            timestamp: changedAt,
            type: "stage_transition",
            data: {
                from: fromStage,
                to: input.targetStage,
                reason: input.reason,
            },
        });
        if (!eventResult.success) {
            throw new Error(eventResult.error || "Failed to write stage transition event");
        }

        return {
            fromStage,
            toStage: input.targetStage,
            changedAt,
        };
    } finally {
        await provider.close();
    }
}
