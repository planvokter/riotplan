/**
 * Storage format types for RiotPlan
 * 
 * This module defines the core types for the dual-format storage architecture
 * that supports both directory-based and SQLite .plan formats.
 */

/**
 * Supported storage formats
 */
export type StorageFormat = 'directory' | 'sqlite';

/**
 * Plan metadata stored in the database
 */
export interface PlanMetadata {
    /** Unique plan identifier (code) */
    id: string;
    /** Globally unique identifier */
    uuid: string;
    /** Human-readable plan name */
    name: string;
    /** Plan description */
    description?: string;
    /** Creation timestamp (ISO 8601) */
    createdAt: string;
    /** Last update timestamp (ISO 8601) */
    updatedAt: string;
    /** Current lifecycle stage */
    stage: PlanStage;
    /** Schema version for migrations */
    schemaVersion: number;
}

/**
 * Plan lifecycle stages
 */
export type PlanStage = 'idea' | 'shaping' | 'built' | 'executing' | 'completed' | 'cancelled';

/**
 * Plan step stored in the database
 */
export interface PlanStep {
    /** Step number (1-based) */
    number: number;
    /** Step code/identifier */
    code: string;
    /** Step title */
    title: string;
    /** Step description/objective */
    description?: string;
    /** Step status */
    status: StepStatus;
    /** When the step was started (ISO 8601) */
    startedAt?: string;
    /** When the step was completed (ISO 8601) */
    completedAt?: string;
    /** Full markdown content of the step file */
    content: string;
}

/**
 * Step status values
 */
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

/**
 * Plan file stored in the database
 */
export interface PlanFile {
    /** File type identifier */
    type: PlanFileType;
    /** Original filename */
    filename: string;
    /** File content (markdown/text) */
    content: string;
    /** Creation timestamp (ISO 8601) */
    createdAt: string;
    /** Last update timestamp (ISO 8601) */
    updatedAt: string;
}

/**
 * Known plan file types
 */
export type PlanFileType = 
    | 'idea'
    | 'shaping'
    | 'summary'
    | 'execution_plan'
    | 'status'
    | 'provenance'
    | 'lifecycle'
    | 'evidence'
    | 'feedback'
    | 'prompt'
    | 'reflection'
    | 'other';

/**
 * Timeline event stored in the database
 */
export interface TimelineEvent {
    /** Event ID */
    id: string;
    /** Event timestamp (ISO 8601) */
    timestamp: string;
    /** Event type */
    type: TimelineEventType;
    /** Event data (JSON) */
    data: Record<string, unknown>;
}

/**
 * Timeline event types
 */
export type TimelineEventType =
    | 'plan_created'
    | 'stage_transition'
    | 'step_started'
    | 'step_completed'
    | 'note_added'
    | 'constraint_added'
    | 'question_added'
    | 'evidence_added'
    | 'approach_added'
    | 'approach_selected'
    | 'feedback_added'
    | 'checkpoint_created'
    | 'narrative_added'
    | 'reflection_added';

/**
 * Evidence record stored in the database
 */
export interface EvidenceRecord {
    /** Evidence ID */
    id: string;
    /** Evidence description */
    description: string;
    /** Source of the evidence */
    source?: string;
    /** Source URL if applicable */
    sourceUrl?: string;
    /** How the evidence was gathered */
    gatheringMethod?: 'manual' | 'model-assisted';
    /** Evidence content (for inline evidence) */
    content?: string;
    /** Path to evidence file (for file-based evidence) */
    filePath?: string;
    /** Relevance score (0-1) from model if model-assisted */
    relevanceScore?: number;
    /** Original question or search query that prompted gathering this evidence */
    originalQuery?: string;
    /** Model-generated summary of the evidence */
    summary?: string;
    /** Creation timestamp (ISO 8601) */
    createdAt: string;
}

/**
 * Feedback record stored in the database
 */
export interface FeedbackRecord {
    /** Feedback ID */
    id: string;
    /** Feedback title */
    title?: string;
    /** Platform where feedback was given */
    platform?: string;
    /** Feedback content */
    content: string;
    /** Participants in the feedback session */
    participants?: string[];
    /** Creation timestamp (ISO 8601) */
    createdAt: string;
}

/**
 * Checkpoint for saving plan state
 */
export interface Checkpoint {
    /** Checkpoint name */
    name: string;
    /** Checkpoint message/description */
    message: string;
    /** Creation timestamp (ISO 8601) */
    createdAt: string;
    /** Snapshot of plan state at checkpoint time */
    snapshot: CheckpointSnapshot;
}

/**
 * Snapshot of plan state for checkpoints
 */
export interface CheckpointSnapshot {
    /** Plan metadata at checkpoint time */
    metadata: PlanMetadata;
    /** Step statuses at checkpoint time */
    steps: Pick<PlanStep, 'number' | 'status' | 'startedAt' | 'completedAt'>[];
    /** Files included in checkpoint */
    files: Pick<PlanFile, 'type' | 'filename' | 'content'>[];
}

/**
 * Options for storage operations
 */
export interface StorageOptions {
    /** Storage format to use */
    format?: StorageFormat;
    /** Create if not exists */
    create?: boolean;
    /** Schema version to use (for migrations) */
    schemaVersion?: number;
}

/**
 * Result of a storage operation
 */
export interface StorageResult<T> {
    /** Whether the operation succeeded */
    success: boolean;
    /** Result data if successful */
    data?: T;
    /** Error message if failed */
    error?: string;
}
