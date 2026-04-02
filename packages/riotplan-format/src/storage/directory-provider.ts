/**
 * Directory Storage Provider
 * 
 * Provides storage operations for directory-based plan format.
 * This is a skeleton implementation - the full implementation will be
 * in the main riotplan package since it needs access to the existing
 * plan loading logic.
 */

import type { StorageProvider, SearchResult } from './provider.js';
import type { StorageResult } from '../types.js';
import type {
    PlanMetadata,
    PlanStep,
    PlanFile,
    TimelineEvent,
    EvidenceRecord,
    FeedbackRecord,
    Checkpoint,
    CheckpointSnapshot,
    StorageFormat,
} from '../types.js';

/**
 * Directory-based storage provider
 * 
 * This provider stores plans as a directory structure with markdown files.
 * The directory structure follows the RiotPlan convention:
 * 
 * ```
 * my-plan/
 * ├── SUMMARY.md
 * ├── STATUS.md
 * ├── IDEA.md (optional)
 * ├── SHAPING.md (optional)
 * ├── EXECUTION_PLAN.md (optional)
 * ├── plan.yaml (contains metadata including UUID)
 * ├── plan/
 * │   ├── 01-step-one.md
 * │   ├── 02-step-two.md
 * │   └── ...
 * ├── evidence/
 * │   └── *.md
 * ├── feedback/
 * │   └── *.md
 * ├── reflections/
 * │   └── *.md
 * └── .history/
 *     ├── timeline.json
 *     └── checkpoints/
 *         └── *.json
 * ```
 * 
 * @remarks
 * This is a base implementation that throws "not implemented" errors.
 * The main riotplan package should extend this class and implement
 * the methods using its existing file loading logic.
 * 
 * **UUID Handling**: When implementing this provider, ensure that:
 * - UUIDs are generated using `generatePlanUuid()` from utils.ts if not provided
 * - UUIDs are persisted in plan.yaml metadata file
 * - UUIDs are included in PlanMetadata returned by getMetadata()
 */
export class DirectoryStorageProvider implements StorageProvider {
    readonly format: StorageFormat = 'directory';
    readonly path: string;

    constructor(planPath: string) {
        this.path = planPath;
    }

    async exists(): Promise<boolean> {
        throw new Error('DirectoryStorageProvider.exists() not implemented - use main riotplan package');
    }

    async initialize(_metadata: PlanMetadata): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.initialize() not implemented - use main riotplan package');
    }

    async close(): Promise<void> {
        // No-op for directory provider
    }

    // Metadata operations
    async getMetadata(): Promise<StorageResult<PlanMetadata>> {
        throw new Error('DirectoryStorageProvider.getMetadata() not implemented - use main riotplan package');
    }

    async updateMetadata(_updates: Partial<PlanMetadata>): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.updateMetadata() not implemented - use main riotplan package');
    }

    // Step operations
    async getSteps(): Promise<StorageResult<PlanStep[]>> {
        throw new Error('DirectoryStorageProvider.getSteps() not implemented - use main riotplan package');
    }

    async getStep(_number: number): Promise<StorageResult<PlanStep | null>> {
        throw new Error('DirectoryStorageProvider.getStep() not implemented - use main riotplan package');
    }

    async addStep(_step: PlanStep): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.addStep() not implemented - use main riotplan package');
    }

    async updateStep(_number: number, _updates: Partial<PlanStep>): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.updateStep() not implemented - use main riotplan package');
    }

    async deleteStep(_number: number): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.deleteStep() not implemented - use main riotplan package');
    }

    // File operations
    async getFiles(): Promise<StorageResult<PlanFile[]>> {
        throw new Error('DirectoryStorageProvider.getFiles() not implemented - use main riotplan package');
    }

    async getFile(_type: string, _filename: string): Promise<StorageResult<PlanFile | null>> {
        throw new Error('DirectoryStorageProvider.getFile() not implemented - use main riotplan package');
    }

    async saveFile(_file: PlanFile): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.saveFile() not implemented - use main riotplan package');
    }

    async deleteFile(_type: string, _filename: string): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.deleteFile() not implemented - use main riotplan package');
    }

    // Timeline operations
    async getTimelineEvents(): Promise<StorageResult<TimelineEvent[]>> {
        throw new Error('DirectoryStorageProvider.getTimelineEvents() not implemented - use main riotplan package');
    }

    async addTimelineEvent(_event: TimelineEvent): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.addTimelineEvent() not implemented - use main riotplan package');
    }

    // Evidence operations
    async getEvidence(): Promise<StorageResult<EvidenceRecord[]>> {
        throw new Error('DirectoryStorageProvider.getEvidence() not implemented - use main riotplan package');
    }

    async addEvidence(_evidence: EvidenceRecord): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.addEvidence() not implemented - use main riotplan package');
    }

    // Feedback operations
    async getFeedback(): Promise<StorageResult<FeedbackRecord[]>> {
        throw new Error('DirectoryStorageProvider.getFeedback() not implemented - use main riotplan package');
    }

    async addFeedback(_feedback: FeedbackRecord): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.addFeedback() not implemented - use main riotplan package');
    }

    // Checkpoint operations
    async getCheckpoints(): Promise<StorageResult<Checkpoint[]>> {
        throw new Error('DirectoryStorageProvider.getCheckpoints() not implemented - use main riotplan package');
    }

    async getCheckpoint(_name: string): Promise<StorageResult<Checkpoint | null>> {
        throw new Error('DirectoryStorageProvider.getCheckpoint() not implemented - use main riotplan package');
    }

    async createCheckpoint(_checkpoint: Checkpoint): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.createCheckpoint() not implemented - use main riotplan package');
    }

    async restoreCheckpoint(_name: string): Promise<StorageResult<void>> {
        throw new Error('DirectoryStorageProvider.restoreCheckpoint() not implemented - use main riotplan package');
    }

    // Search operations
    async search(_query: string): Promise<StorageResult<SearchResult[]>> {
        throw new Error('DirectoryStorageProvider.search() not implemented - use main riotplan package');
    }

    // Snapshot operations
    async createSnapshot(): Promise<CheckpointSnapshot> {
        throw new Error('DirectoryStorageProvider.createSnapshot() not implemented - use main riotplan package');
    }
}

/**
 * Create a directory storage provider
 * 
 * @param planPath - Path to the plan directory
 * @returns A directory storage provider instance
 * 
 * @remarks
 * This creates a base provider that throws "not implemented" errors.
 * Use the implementation from the main riotplan package for actual functionality.
 */
export function createDirectoryProvider(planPath: string): DirectoryStorageProvider {
    return new DirectoryStorageProvider(planPath);
}
