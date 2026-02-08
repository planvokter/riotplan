/**
 * RiotPlan Type Definitions
 *
 * Types for long-lived, stateful AI workflows (plans).
 *
 * A plan consists of:
 * - A directory (the plan code/name)
 * - A meta-prompt (prompt-of-prompts)
 * - Numbered step files (01-STEP.md, 02-STEP.md, etc.)
 * - Status tracking (STATUS.md)
 * - Execution strategy (EXECUTION_PLAN.md)
 * - Summary (SUMMARY.md)
 * - Optional analysis directory
 */

// ===== LLM PROVIDER TYPES =====

/**
 * Message in a conversation
 */
export interface Message {
    role: 'user' | 'assistant' | 'system' | 'developer' | 'tool';
    content: string | string[] | null;
    name?: string;
}

/**
 * LLM request interface
 */
export interface Request {
    messages: Message[];
    model: string;
    responseFormat?: any;
    validator?: any;
    addMessage(message: Message): void;
}

/**
 * Response from an LLM provider
 */
export interface ProviderResponse {
    content: string;
    model: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    toolCalls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
}

/**
 * Options for execution
 */
export interface ExecutionOptions {
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    retries?: number;
}

/**
 * Provider interface for LLM execution
 */
export interface Provider {
    readonly name: string;
    execute(request: Request, options?: ExecutionOptions): Promise<ProviderResponse>;
    supportsModel?(model: string): boolean;
}

// ===== TASK STATUS =====

/**
 * Status of a task, phase, or step
 */
export type TaskStatus =
  | "pending" // Not started (⬜)
  | "in_progress" // Currently active (🔄)
  | "completed" // Done (✅)
  | "failed" // Failed with error (❌)
  | "blocked" // Waiting on dependency (⏸️)
  | "skipped"; // Intentionally skipped (⏭️)

/**
 * Priority level
 */
export type Priority = "high" | "medium" | "low";

// ===== FEEDBACK TYPES =====

/**
 * Platform where feedback occurred
 */
export type FeedbackPlatform =
    | "cursor"
    | "chatgpt"
    | "slack"
    | "email"
    | "meeting"
    | "voice"
    | "document"
    | "other";

/**
 * Participant in a feedback discussion
 */
export interface FeedbackParticipant {
    /** Participant name */
    name: string;

    /** Type of participant */
    type: "human" | "ai";

    /** Model identifier for AI participants */
    model?: string;
}

/**
 * Context reference for feedback (file:lines)
 */
export interface FeedbackContext {
    /** File path */
    file: string;

    /** Start line number */
    startLine?: number;

    /** End line number */
    endLine?: number;

    /** Content excerpt */
    content?: string;
}

/**
 * Feedback record for deliberation capture
 *
 * Captures discussions, decisions, and changes made during plan development.
 * Each feedback record represents a deliberation session that influenced the plan.
 */
export interface FeedbackRecord {
    /** Unique identifier (e.g., "001", "002") */
    id: string;

    /** Title/subject of the feedback */
    title: string;

    /** When created */
    createdAt: Date;

    /** Participants in the discussion */
    participants: FeedbackParticipant[];

    /** Platform where feedback occurred */
    platform: FeedbackPlatform;

    /** Plan version this feedback relates to */
    planVersion?: string;

    /** Related file references (file:lines) */
    context?: FeedbackContext[];

    /** What was proposed before feedback */
    proposed?: string;

    /** The feedback given */
    feedback: string;

    /** Discussion/debate content */
    discussion?: string;

    /** Resolution/outcome */
    resolution?: string;

    /** Changes made as a result */
    changes?: string[];

    /** Open questions remaining */
    openQuestions?: string[];

    /** Filename (e.g., "001-initial-review.md") */
    filename: string;
}

// ===== EVIDENCE TYPES =====

/**
 * Type of evidence gathered during inception phase
 */
export type EvidenceType =
    | "case-study" // what-happened-in-*.md
    | "research" // research-*.md
    | "analysis" // analysis-*.md
    | "example" // example-*.md
    | "external-review" // External AI review
    | "reference"; // Reference material

/**
 * Method used to gather evidence
 */
export type EvidenceGatheringMethod = "manual" | "model-assisted";

/**
 * Evidence record for inception phase materials
 *
 * Tracks documentation gathered during plan inception to support
 * decisions and provide context for future reference.
 */
export interface EvidenceRecord {
    /** Unique identifier */
    id: string;

    /** Evidence type */
    type: EvidenceType;

    /** Title/description */
    title: string;

    /** When gathered */
    createdAt: Date;

    /** Source of evidence */
    source?: string;

    /** Filename */
    filename: string;

    /** Summary of key findings */
    summary?: string;

    /** Tags for categorization */
    tags?: string[];

    /** How evidence was gathered */
    gatheringMethod?: EvidenceGatheringMethod;

    /** Relevance score (0-1) from model if model-assisted */
    relevanceScore?: number;
}

// ===== TIMELINE/HISTORY TYPES =====

/**
 * Source of narrative input
 */
export type NarrativeSource = "typing" | "voice" | "paste" | "import";

/**
 * Speaker in narrative chunk
 */
export type NarrativeSpeaker = "user" | "assistant" | string;

/**
 * Timeline event types
 */
export type TimelineEventType =
    | "idea_created"
    | "note_added"
    | "constraint_added"
    | "question_added"
    | "evidence_added"
    | "idea_killed"
    | "shaping_started"
    | "approach_added"
    | "feedback_added"
    | "approach_compared"
    | "approach_selected"
    | "narrative_chunk"
    | "checkpoint_created"
    | "checkpoint_restored"
    | "stage_transition";

/**
 * Base timeline event structure
 */
export interface TimelineEvent {
    /** ISO 8601 timestamp */
    timestamp: string;

    /** Event type identifier */
    type: TimelineEventType;

    /** Event-specific data */
    data: Record<string, any>;
}

/**
 * Narrative chunk event - captures raw conversational input
 */
export interface NarrativeChunkEvent extends TimelineEvent {
    type: "narrative_chunk";
    data: {
        /** Raw user input */
        content: string;

        /** Source of input */
        source?: NarrativeSource;

        /** Context about what prompted this */
        context?: string;

        /** Who is speaking */
        speaker?: NarrativeSpeaker;
    };
}

/**
 * Checkpoint created event
 */
export interface CheckpointCreatedEvent extends TimelineEvent {
    type: "checkpoint_created";
    data: {
        /** Checkpoint name (kebab-case) */
        name: string;

        /** Description of checkpoint */
        message: string;

        /** Path to checkpoint snapshot (relative) */
        snapshotPath?: string;

        /** Path to prompt context (relative) */
        promptPath?: string;
    };
}

/**
 * Checkpoint restored event
 */
export interface CheckpointRestoredEvent extends TimelineEvent {
    type: "checkpoint_restored";
    data: {
        /** Name of restored checkpoint */
        checkpoint: string;

        /** Timestamp of original checkpoint */
        restoredFrom: string;
    };
}

/**
 * Evidence added event
 */
export interface EvidenceAddedEvent extends TimelineEvent {
    type: "evidence_added";
    data: {
        /** Filesystem path or URL */
        evidencePath: string;

        /** What this evidence shows */
        description: string;

        /** How evidence was gathered */
        gatheringMethod?: EvidenceGatheringMethod;

        /** Relevance score (0-1) from model */
        relevanceScore?: number;

        /** Model-generated summary */
        summary?: string;
    };
}

/**
 * File snapshot in checkpoint
 */
export interface FileSnapshot {
    /** Whether file exists */
    exists: boolean;

    /** File content (if exists) */
    content?: string;
}

/**
 * Checkpoint metadata structure
 */
export interface CheckpointMetadata {
    /** Checkpoint name */
    name: string;

    /** When created (ISO 8601) */
    timestamp: string;

    /** User-provided description */
    message: string;

    /** Current stage */
    stage: string;

    /** Snapshot of plan files */
    snapshot: {
        timestamp: string;
        idea?: FileSnapshot;
        shaping?: FileSnapshot;
        lifecycle?: FileSnapshot;
    };

    /** Context information */
    context: {
        /** List of .md files at checkpoint */
        filesChanged: string[];

        /** Timeline events since last checkpoint */
        eventsSinceLastCheckpoint: number;
    };
}

// ===== REVISION/HISTORY TYPES =====

/**
 * A single revision in plan history
 */
export interface PlanRevision {
    /** Version string (e.g., "0.1", "0.2") */
    version: string;

    /** When this revision was created */
    createdAt: Date;

    /** Commit message/description */
    message?: string;

    /** Author */
    author?: string;

    /** Feedback record that triggered this revision */
    feedbackId?: string;
}

/**
 * A milestone in plan history (explicit cleanup point)
 */
export interface PlanMilestone {
    /** Milestone name */
    name: string;

    /** Version at this milestone */
    version: string;

    /** When created */
    createdAt: Date;

    /** Description */
    description?: string;
}

/**
 * Plan version history
 *
 * Embedded version tracking without Git dependency.
 * Supports milestones for explicit cleanup points.
 */
export interface PlanHistory {
    /** All revisions in order */
    revisions: PlanRevision[];

    /** Current version */
    currentVersion: string;

    /** Milestones (explicit cleanup points) */
    milestones?: PlanMilestone[];
}

// ===== CONTEXT TYPES =====

/**
 * Context identifier (e.g., "work", "personal", "work/kjerneverk")
 */
export type ContextId = string;

/**
 * Plan context definition
 *
 * Contexts allow organizing plans by domain (work, personal, etc.)
 * with optional hierarchy support.
 */
export interface PlanContextDefinition {
    /** Context identifier */
    id: ContextId;

    /** Display name */
    name: string;

    /** Parent context (for hierarchy) */
    parent?: ContextId;

    /** Default for this directory? */
    isDefault?: boolean;
}

// ===== CROSS-PLAN RELATIONSHIP TYPES =====

/**
 * Type of relationship between plans
 */
export type RelationshipType =
    | "spawned-from" // This plan was spawned from another
    | "spawned" // This plan spawned another
    | "blocks" // This plan blocks another
    | "blocked-by" // This plan is blocked by another
    | "related"; // General relationship

/**
 * Relationship between plans
 *
 * Tracks dependencies, spawning, and other relationships
 * between plans for cross-plan coordination.
 */
export interface PlanRelationship {
    /** Type of relationship */
    type: RelationshipType;

    /** Related plan path */
    planPath: string;

    /** Specific step(s) involved */
    steps?: number[];

    /** Reason for relationship */
    reason?: string;

    /** When established */
    createdAt: Date;
}

// ===== PLAN STRUCTURE =====

/**
 * A single step in a plan (corresponds to a numbered file like 01-STEP.md)
 */
export interface PlanStep {
  /** Step number (1, 2, 3...) */
  number: number;

  /** Step code/slug (extracted from filename, e.g., "execution-interfaces") */
  code: string;

  /** Full filename (e.g., "01-execution-interfaces.md") */
  filename: string;

  /** Human-readable title */
  title: string;

  /** Step description */
  description?: string;

  /** Current status */
  status: TaskStatus;

  /** Dependencies on other steps (by number) */
  dependencies?: number[];

  /** When this step was started */
  startedAt?: Date;

  /** When this step was completed */
  completedAt?: Date;

  /** Duration in milliseconds */
  duration?: number;

  /** Notes or issues encountered */
  notes?: string;

  /** Path to the step file */
  filePath: string;
}

/**
 * A phase grouping multiple steps
 */
export interface PlanPhase {
  /** Phase number */
  number: number;

  /** Phase name */
  name: string;

  /** Description */
  description?: string;

  /** Steps in this phase */
  steps: number[]; // Step numbers

  /** Phase status (derived from step statuses) */
  status: TaskStatus;

  /** Estimated duration */
  estimatedDuration?: string;

  /** Actual duration */
  actualDuration?: string;
}

/**
 * Blocker preventing progress
 */
export interface Blocker {
  /** Unique identifier */
  id: string;

  /** Description of the blocker */
  description: string;

  /** Severity */
  severity: Priority;

  /** Affected steps */
  affectedSteps: number[];

  /** When created */
  createdAt: Date;

  /** When resolved */
  resolvedAt?: Date;

  /** Resolution notes */
  resolution?: string;
}

/**
 * Issue encountered during execution
 */
export interface Issue {
  /** Unique identifier */
  id: string;

  /** Issue title */
  title: string;

  /** Description */
  description: string;

  /** Severity */
  severity: Priority;

  /** Related step */
  step?: number;

  /** When encountered */
  createdAt: Date;

  /** When resolved */
  resolvedAt?: Date;

  /** How it was resolved */
  resolution?: string;
}

// ===== PLAN METADATA =====

/**
 * Plan metadata from the directory and files
 */
export interface PlanMetadata {
  /** Plan code (directory name, e.g., "big-splitup") */
  code: string;

  /** Human-readable name */
  name: string;

  /** Description from SUMMARY.md or meta-prompt */
  description?: string;

  /** Version (for tracking changes to the plan itself) */
  version?: string;

  /** Author */
  author?: string;

  /** Tags for categorization */
  tags?: string[];

  /** When the plan was created */
  createdAt?: Date;

  /** Path to the plan directory */
  path: string;
}

// ===== PLAN FILES =====

/**
 * Standard plan files
 */
export interface PlanFiles {
    /** Meta-prompt file (e.g., "big-splitup-prompt.md" or "prompt-of-prompts.md") */
    metaPrompt?: string;

    /** Summary file */
    summary?: string;

    /** Status file */
    status?: string;

    /** Execution plan file */
    executionPlan?: string;

    /** README file */
    readme?: string;

    /** Step files in order */
    steps: string[];

    /** Analysis directory */
    analysisDir?: string;

    /** Other directories (architecture/, implementation/, testing/) */
    subdirectories: string[];

    /** Feedback directory */
    feedbackDir?: string;

    /** Feedback files */
    feedbackFiles?: string[];

    /** Evidence directory */
    evidenceDir?: string;

    /** Evidence files */
    evidenceFiles?: string[];

    /** History directory */
    historyDir?: string;

    /** CHANGELOG.md */
    changelog?: string;
}

// ===== PLAN STATE =====

/**
 * Current state of plan execution
 */
export interface PlanState {
  /** Overall plan status */
  status: TaskStatus;

  /** Current step being executed */
  currentStep?: number;

  /** Last completed step */
  lastCompletedStep?: number;

  /** When execution started */
  startedAt?: Date;

  /** When last updated */
  lastUpdatedAt: Date;

  /** When completed */
  completedAt?: Date;

  /** Active blockers */
  blockers: Blocker[];

  /** Issues encountered */
  issues: Issue[];

  /** Progress percentage (0-100) */
  progress: number;
}

// ===== COMPLETE PLAN =====

/**
 * Complete plan definition
 */
export interface Plan {
    /** Plan metadata */
    metadata: PlanMetadata;

    /** Plan files */
    files: PlanFiles;

    /** Plan steps */
    steps: PlanStep[];

    /** Plan phases (optional grouping) */
    phases?: PlanPhase[];

    /** Current state */
    state: PlanState;

    /** Feedback records */
    feedback?: FeedbackRecord[];

    /** Evidence files */
    evidence?: EvidenceRecord[];

    /** Revision history */
    history?: PlanHistory;

    /** Context assignment */
    context?: ContextId;

    /** Relationships to other plans */
    relationships?: PlanRelationship[];
}

// ===== EXECUTION =====

/**
 * Context for plan execution
 */
export interface PlanContext {
  /** Working directory */
  workingDirectory: string;

  /** The plan being executed */
  plan: Plan;

  /** Logger instance */
  logger?: any;

  /** Storage for artifacts */
  storage?: any;

  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Result of executing a step
 */
export interface StepResult {
  /** Whether the step succeeded */
  success: boolean;

  /** Step number */
  step: number;

  /** Output from execution */
  output?: string;

  /** Error if failed */
  error?: Error;

  /** Duration in milliseconds */
  duration: number;

  /** Artifacts produced */
  artifacts?: string[];
}

/**
 * Result of executing a plan
 */
export interface PlanResult {
  /** Whether the plan completed successfully */
  success: boolean;

  /** Steps that were executed */
  executedSteps: number[];

  /** Steps that succeeded */
  completedSteps: number[];

  /** Steps that failed */
  failedSteps: number[];

  /** Steps that were skipped */
  skippedSteps: number[];

  /** Total duration */
  duration: number;

  /** Final plan state */
  finalState: PlanState;
}

// ===== SERIALIZATION =====

/**
 * STATUS.md schema for parsing/generating
 */
export interface StatusDocument {
  /** Document title */
  title: string;

  /** Current state summary */
  currentState: {
    status: TaskStatus;
    currentStep?: string;
    lastCompleted?: string;
    startedAt?: string;
    lastUpdated?: string;
  };

  /** Step progress table */
  stepProgress: Array<{
    step: string;
    name: string;
    status: TaskStatus;
    started?: string;
    completed?: string;
    notes?: string;
  }>;

  /** Blockers section */
  blockers: string[];

  /** Issues section */
  issues: string[];

  /** Notes section */
  notes?: string;
}

/**
 * EXECUTION_PLAN.md schema
 */
export interface ExecutionPlanDocument {
  /** Strategy description */
  strategy: string;

  /** Prerequisites */
  prerequisites: string[];

  /** Phases with their steps */
  phases: Array<{
    name: string;
    description: string;
    steps: string[];
  }>;

  /** Quality gates */
  qualityGates?: string[];

  /** Rollback instructions */
  rollback?: string;
}

// ===== PLAN CONVENTIONS =====

/**
 * File naming conventions
 */
export const PLAN_CONVENTIONS = {
    /** Meta-prompt file patterns */
    metaPromptPatterns: [
        "{code}-prompt.md",
        "prompt-of-prompts.md",
        "{code}.md",
    ],

    /** Step file pattern (e.g., "01-step-name.md") */
    stepPattern: /^(\d{2})-(.+)\.md$/,

    /** Feedback file pattern (e.g., "001-initial-review.md") */
    feedbackPattern: /^(\d{3})-(.+)\.md$/,

    /** Evidence file patterns */
    evidencePatterns: [
        /^what-happened-in-(.+)\.md$/,
        /^research-(.+)\.md$/,
        /^analysis-(.+)\.md$/,
        /^example-(.+)\.md$/,
    ],

    /** Standard files */
    standardFiles: {
        summary: "SUMMARY.md",
        status: "STATUS.md",
        executionPlan: "EXECUTION_PLAN.md",
        readme: "README.md",
        changelog: "CHANGELOG.md",
    },

    /** Standard directories */
    standardDirs: {
        plan: "plan",
        analysis: "analysis",
        architecture: "architecture",
        implementation: "implementation",
        testing: "testing",
        feedback: "feedback",
        evidence: "evidence",
        history: ".history",
    },

    /** Status emoji mapping */
    statusEmoji: {
        pending: "⬜",
        in_progress: "🔄",
        completed: "✅",
        failed: "❌",
        blocked: "⏸️",
        skipped: "⏭️",
    } as Record<TaskStatus, string>,

    /** Emoji to status mapping (reverse lookup) */
    emojiToStatus: {
        "⬜": "pending",
        "🔄": "in_progress",
        "✅": "completed",
        "❌": "failed",
        "⏸️": "blocked",
        "⏭️": "skipped",
    } as Record<string, TaskStatus>,
} as const;

