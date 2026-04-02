import type { PlanStep, TaskStatus } from "../types.js";

export interface PlanMetadataRecord {
    id: string;
    uuid: string;
    name: string;
    description?: string;
    stage: string;
    createdAt: string;
    updatedAt: string;
}

export interface PlanFileRecord {
    type: string;
    filename: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export interface TimelineEventRecord {
    timestamp: string;
    type: string;
    data: Record<string, unknown>;
}

export interface PlanStore {
    exists(planRef: string): Promise<boolean>;
    readMetadata(planRef: string): Promise<PlanMetadataRecord>;
    writeMetadata(planRef: string, patch: Partial<PlanMetadataRecord>): Promise<void>;
    listFiles(planRef: string): Promise<PlanFileRecord[]>;
    readFile(planRef: string, filename: string): Promise<PlanFileRecord | null>;
    writeFile(planRef: string, file: PlanFileRecord): Promise<void>;
    listSteps(planRef: string): Promise<PlanStep[]>;
    upsertStep(planRef: string, step: PlanStep): Promise<void>;
    deleteStep(planRef: string, number: number): Promise<void>;
    updateStepStatus(planRef: string, number: number, status: TaskStatus): Promise<void>;
    appendTimelineEvent(planRef: string, event: TimelineEventRecord): Promise<void>;
}
