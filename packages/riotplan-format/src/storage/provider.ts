/**
 * Storage Provider Interface
 * 
 * This module defines the abstract interface that both directory-based
 * and SQLite storage implementations must implement.
 */

import type {
    PlanMetadata,
    PlanStep,
    PlanFile,
    TimelineEvent,
    EvidenceRecord,
    FeedbackRecord,
    Checkpoint,
    StorageResult,
    StorageFormat,
} from '../types.js';

/**
 * Abstract storage provider interface
 * 
 * Both DirectoryStorageProvider and SqliteStorageProvider implement this interface,
 * allowing the plan operations to work with either format transparently.
 */
export interface StorageProvider {
    /**
     * Get the storage format this provider uses
     */
    readonly format: StorageFormat;

    /**
     * Get the path to the plan (directory path or .plan file path)
     */
    readonly path: string;

    /**
     * Check if the plan exists
     */
    exists(): Promise<boolean>;

    /**
     * Initialize a new plan
     */
    initialize(metadata: PlanMetadata): Promise<StorageResult<void>>;

    /**
     * Close the storage (cleanup resources)
     */
    close(): Promise<void>;

    // ==================== Metadata Operations ====================

    /**
     * Get plan metadata
     */
    getMetadata(): Promise<StorageResult<PlanMetadata>>;

    /**
     * Update plan metadata
     */
    updateMetadata(metadata: Partial<PlanMetadata>): Promise<StorageResult<void>>;

    // ==================== Step Operations ====================

    /**
     * Get all steps
     */
    getSteps(): Promise<StorageResult<PlanStep[]>>;

    /**
     * Get a specific step by number
     */
    getStep(number: number): Promise<StorageResult<PlanStep | null>>;

    /**
     * Add a new step
     */
    addStep(step: PlanStep): Promise<StorageResult<void>>;

    /**
     * Update an existing step
     */
    updateStep(number: number, updates: Partial<PlanStep>): Promise<StorageResult<void>>;

    /**
     * Delete a step
     */
    deleteStep(number: number): Promise<StorageResult<void>>;

    // ==================== File Operations ====================

    /**
     * Get all files
     */
    getFiles(): Promise<StorageResult<PlanFile[]>>;

    /**
     * Get a specific file by type and filename
     */
    getFile(type: string, filename: string): Promise<StorageResult<PlanFile | null>>;

    /**
     * Save a file
     */
    saveFile(file: PlanFile): Promise<StorageResult<void>>;

    /**
     * Delete a file
     */
    deleteFile(type: string, filename: string): Promise<StorageResult<void>>;

    // ==================== Timeline Operations ====================

    /**
     * Get timeline events
     */
    getTimelineEvents(options?: {
        since?: string;
        type?: string;
        limit?: number;
    }): Promise<StorageResult<TimelineEvent[]>>;

    /**
     * Add a timeline event
     */
    addTimelineEvent(event: TimelineEvent): Promise<StorageResult<void>>;

    // ==================== Evidence Operations ====================

    /**
     * Get all evidence records
     */
    getEvidence(): Promise<StorageResult<EvidenceRecord[]>>;

    /**
     * Add an evidence record
     */
    addEvidence(evidence: EvidenceRecord): Promise<StorageResult<void>>;

    // ==================== Feedback Operations ====================

    /**
     * Get all feedback records
     */
    getFeedback(): Promise<StorageResult<FeedbackRecord[]>>;

    /**
     * Add a feedback record
     */
    addFeedback(feedback: FeedbackRecord): Promise<StorageResult<void>>;

    // ==================== Checkpoint Operations ====================

    /**
     * Get all checkpoints
     */
    getCheckpoints(): Promise<StorageResult<Checkpoint[]>>;

    /**
     * Get a specific checkpoint by name
     */
    getCheckpoint(name: string): Promise<StorageResult<Checkpoint | null>>;

    /**
     * Create a checkpoint
     */
    createCheckpoint(checkpoint: Checkpoint): Promise<StorageResult<void>>;

    /**
     * Restore from a checkpoint
     */
    restoreCheckpoint(name: string): Promise<StorageResult<void>>;

    // ==================== Search Operations ====================

    /**
     * Search across all plan content
     */
    search(query: string): Promise<StorageResult<SearchResult[]>>;
}

/**
 * Search result from content search
 */
export interface SearchResult {
    /** Type of content found */
    type: 'step' | 'file' | 'evidence' | 'feedback' | 'timeline';
    /** Identifier (step number, filename, etc.) */
    id: string;
    /** Matching content snippet */
    snippet: string;
    /** Relevance score (0-1) */
    score: number;
}

/**
 * Factory function type for creating storage providers
 */
export type StorageProviderFactoryFn = (path: string) => Promise<StorageProvider>;

/**
 * Interface for storage provider factories
 */
export interface StorageProviderFactory {
    /**
     * Create a storage provider for the given path
     */
    createProvider(path: string, options?: unknown): StorageProvider;
    
    /**
     * Check if this factory supports the given path
     */
    supportsPath(path: string): boolean;
}
