import { createSqliteProvider } from "@planvokter/riotplan-format";
import { randomUUID } from "node:crypto";
import type { PlanStep, TaskStatus } from "../types.js";
import type {
    PlanFileRecord,
    PlanMetadataRecord,
    PlanStore,
    TimelineEventRecord,
} from "../contracts/index.js";

function inferFileType(filename: string): string {
    const normalized = filename.toUpperCase();
    if (normalized === "IDEA.MD") return "idea";
    if (normalized === "SHAPING.MD") return "shaping";
    if (normalized === "SUMMARY.MD") return "summary";
    if (normalized === "EXECUTION_PLAN.MD") return "execution_plan";
    if (normalized === "STATUS.MD") return "status";
    if (normalized === "PROVENANCE.MD") return "provenance";
    return "artifact";
}

function asStepFilename(step: { number: number; code: string }): string {
    return `${step.number.toString().padStart(2, "0")}-${step.code}.md`;
}

async function withProvider<T>(
    planRef: string,
    work: (provider: ReturnType<typeof createSqliteProvider>) => Promise<T>
): Promise<T> {
    const provider = createSqliteProvider(planRef);
    try {
        return await work(provider);
    } finally {
        await provider.close();
    }
}

export class SqlitePlanStore implements PlanStore {
    async exists(planRef: string): Promise<boolean> {
        return withProvider(planRef, async (provider) => provider.exists());
    }

    async readMetadata(planRef: string): Promise<PlanMetadataRecord> {
        return withProvider(planRef, async (provider) => {
            const result = await provider.getMetadata();
            if (!result.success || !result.data) {
                throw new Error(result.error || "Failed to read metadata");
            }
            return {
                id: result.data.id,
                uuid: result.data.uuid,
                name: result.data.name,
                description: result.data.description,
                stage: result.data.stage,
                createdAt: result.data.createdAt,
                updatedAt: result.data.updatedAt,
            };
        });
    }

    async writeMetadata(planRef: string, patch: Partial<PlanMetadataRecord>): Promise<void> {
        await withProvider(planRef, async (provider) => {
            const result = await provider.updateMetadata(patch as any);
            if (!result.success) {
                throw new Error(result.error || "Failed to update metadata");
            }
        });
    }

    async listFiles(planRef: string): Promise<PlanFileRecord[]> {
        return withProvider(planRef, async (provider) => {
            const result = await provider.getFiles();
            if (!result.success || !result.data) {
                throw new Error(result.error || "Failed to list files");
            }
            return result.data.map((file) => ({
                type: file.type,
                filename: file.filename,
                content: file.content,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
            }));
        });
    }

    async readFile(planRef: string, filename: string): Promise<PlanFileRecord | null> {
        const files = await this.listFiles(planRef);
        return files.find((file) => file.filename === filename) ?? null;
    }

    async writeFile(planRef: string, file: PlanFileRecord): Promise<void> {
        await withProvider(planRef, async (provider) => {
            const result = await provider.saveFile({
                type: (file.type || inferFileType(file.filename)) as any,
                filename: file.filename,
                content: file.content,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
            });
            if (!result.success) {
                throw new Error(result.error || `Failed to write file ${file.filename}`);
            }
        });
    }

    async listSteps(planRef: string): Promise<PlanStep[]> {
        return withProvider(planRef, async (provider) => {
            const result = await provider.getSteps();
            if (!result.success || !result.data) {
                throw new Error(result.error || "Failed to list steps");
            }
            return result.data.map((step) => {
                const filename = asStepFilename(step);
                return {
                    number: step.number,
                    code: step.code,
                    filename,
                    title: step.title,
                    description: step.description,
                    status: step.status as TaskStatus,
                    startedAt: step.startedAt ? new Date(step.startedAt) : undefined,
                    completedAt: step.completedAt ? new Date(step.completedAt) : undefined,
                    filePath: `sqlite://${planRef}/${filename}`,
                };
            });
        });
    }

    async upsertStep(planRef: string, step: PlanStep): Promise<void> {
        await withProvider(planRef, async (provider) => {
            const existing = await provider.getStep(step.number);
            if (existing.success && existing.data) {
                const updateResult = await provider.updateStep(step.number, {
                    code: step.code,
                    title: step.title,
                    description: step.description,
                    status: step.status as any,
                    startedAt: step.startedAt?.toISOString(),
                    completedAt: step.completedAt?.toISOString(),
                });
                if (!updateResult.success) {
                    throw new Error(updateResult.error || `Failed to update step ${step.number}`);
                }
                return;
            }

            const addResult = await provider.addStep({
                number: step.number,
                code: step.code,
                title: step.title,
                description: step.description,
                status: step.status as any,
                content: "",
                startedAt: step.startedAt?.toISOString(),
                completedAt: step.completedAt?.toISOString(),
            });
            if (!addResult.success) {
                throw new Error(addResult.error || `Failed to add step ${step.number}`);
            }
        });
    }

    async deleteStep(planRef: string, number: number): Promise<void> {
        await withProvider(planRef, async (provider) => {
            const result = await provider.deleteStep(number);
            if (!result.success) {
                throw new Error(result.error || `Failed to delete step ${number}`);
            }
        });
    }

    async updateStepStatus(planRef: string, number: number, status: TaskStatus): Promise<void> {
        await withProvider(planRef, async (provider) => {
            const result = await provider.updateStep(number, { status: status as any });
            if (!result.success) {
                throw new Error(result.error || `Failed to update step status for ${number}`);
            }
        });
    }

    async appendTimelineEvent(planRef: string, event: TimelineEventRecord): Promise<void> {
        await withProvider(planRef, async (provider) => {
            const result = await provider.addTimelineEvent({
                id: randomUUID(),
                timestamp: event.timestamp,
                type: event.type as any,
                data: event.data,
            });
            if (!result.success) {
                throw new Error(result.error || `Failed to append timeline event ${event.type}`);
            }
        });
    }
}
