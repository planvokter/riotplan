import type { PlanStep, StatusDocument, TaskStatus } from "../types.js";
import type { PlanMetadataRecord, PlanStore, TimelineEventRecord } from "./persistence.js";

export interface StageTransitionRequest {
    planRef: string;
    toStage: string;
    reason: string;
}

export interface StageTransitionResult {
    fromStage: string;
    toStage: string;
    changedAt: string;
}

export interface PlanLifecycleService {
    getMetadata(planRef: string): Promise<PlanMetadataRecord>;
    transitionStage(request: StageTransitionRequest): Promise<StageTransitionResult>;
    appendEvent(planRef: string, event: TimelineEventRecord): Promise<void>;
}

export interface StartStepRequest {
    planRef: string;
    step: number;
}

export interface CompleteStepRequest {
    planRef: string;
    step: number;
    force?: boolean;
    skipVerification?: boolean;
}

export interface AddStepRequest {
    planRef: string;
    title: string;
    description?: string;
    number?: number;
    after?: number;
}

export interface MoveStepRequest {
    planRef: string;
    from: number;
    to: number;
}

export interface PlanStepService {
    list(planRef: string): Promise<PlanStep[]>;
    start(request: StartStepRequest): Promise<PlanStep>;
    complete(request: CompleteStepRequest): Promise<PlanStep>;
    add(request: AddStepRequest): Promise<PlanStep>;
    move(request: MoveStepRequest): Promise<PlanStep[]>;
    remove(planRef: string, number: number): Promise<void>;
    setStatus(planRef: string, number: number, status: TaskStatus): Promise<void>;
}

export interface ShapingApproachInput {
    name: string;
    description: string;
    tradeoffs?: string[];
    assumptions?: string[];
}

export interface SelectApproachInput {
    approach: string;
    reason: string;
}

export interface PlanShapingService {
    start(planRef: string): Promise<void>;
    addApproach(planRef: string, input: ShapingApproachInput): Promise<void>;
    addFeedback(planRef: string, feedback: string): Promise<void>;
    select(planRef: string, input: SelectApproachInput): Promise<void>;
}

export interface PlanStatusService {
    read(planRef: string): Promise<StatusDocument>;
    regenerate(planRef: string): Promise<StatusDocument>;
}

export interface CoreServiceRegistry {
    store: PlanStore;
    lifecycle: PlanLifecycleService;
    steps: PlanStepService;
    shaping: PlanShapingService;
    status: PlanStatusService;
}
