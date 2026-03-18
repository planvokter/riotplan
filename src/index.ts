/**
 * RiotPlan - Framework for long-lived, stateful AI workflows
 *
 * A plan is a structured way to manage multi-step AI-assisted tasks that:
 * - Span multiple sessions/days
 * - Have persistent state (STATUS.md)
 * - Are organized into numbered steps
 * - Can be interrupted and resumed
 * - Track progress with checkboxes and statuses
 *
 * @example Plan directory structure:
 * ```
 * my-plan/
 * ├── my-plan-prompt.md     # Meta-prompt (prompt-of-prompts)
 * ├── SUMMARY.md            # Overview of the approach
 * ├── EXECUTION_PLAN.md     # Step-by-step strategy
 * ├── STATUS.md             # Current state (auto-updated)
 * ├── plan/                 # Step files (optional subdirectory)
 * │   ├── 01-first-step.md
 * │   ├── 02-second-step.md
 * │   └── ...
 * └── analysis/             # Analysis output (optional)
 * ```
 */

// ===== EXPORTS =====

// Types
export type {
    TaskStatus,
    Priority,
    // Feedback types
    FeedbackPlatform,
    FeedbackParticipant,
    FeedbackContext,
    FeedbackRecord,
    // Evidence types
    EvidenceType,
    EvidenceRecord,
    // Revision/History types
    PlanRevision,
    PlanMilestone,
    PlanHistory,
    // Context types
    ContextId,
    PlanContextDefinition,
    // Cross-plan relationship types
    RelationshipType,
    PlanRelationship,
    // Plan structure types
    PlanStep,
    PlanPhase,
    Blocker,
    Issue,
    PlanMetadata,
    PlanFiles,
    PlanState,
    Plan,
    PlanContext,
    StepResult,
    PlanResult,
    StatusDocument,
    ExecutionPlanDocument,
} from "./types.js";

// Constants
export { PLAN_CONVENTIONS } from "./types.js";

// Plan Operations
export { loadPlan, type LoadPlanOptions } from "./plan/loader.js";
export {
    createPlan,
    type CreatePlanConfig,
    type CreatePlanResult,
} from "./plan/creator.js";

export {
    validatePlan,
    type ValidationResult,
    type ValidationError,
    type ValidationWarning,
    type ValidationInfo,
    type FixableIssue,
    type ValidateOptions,
} from "./plan/validator.js";

// Prompt Storage
export {
    saveInitialPrompt,
    saveElaborationPrompt,
    saveAmendmentPrompt,
    loadElaborationPrompts,
    loadAmendmentPrompts,
    type SavedPrompt,
} from "./plan/prompts.js";

// Analysis Operations
export {
    createAnalysisDirectory,
    loadAnalysis,
    hasAnalysis,
    type Analysis,
    type ElaborationRecord,
    type AnalysisMetadata,
    type CreateAnalysisOptions,
} from "./analysis/index.js";

// Feedback Operations
export {
    createFeedback,
    listFeedback,
    getFeedback,
    type CreateFeedbackOptions,
    type CreateFeedbackResult,
} from "./feedback/index.js";

// Status Operations
export {
    parseStatus,
    type ParseStatusOptions,
    type ParseStatusResult,
} from "./status/parser.js";

export {
    generateStatus,
    updateStatus,
    type GenerateStatusOptions,
    type UpdateStatusOptions,
} from "./status/generator.js";

// Step Operations
export {
    insertStep,
    removeStep,
    moveStep,
    blockStep,
    unblockStep,
    completeStep,
    startStep,
    skipStep,
    failStep,
    type InsertStepOptions,
    type InsertStepResult,
    type RemoveStepResult,
    type MoveStepResult,
} from "./steps/operations.js";

// Reflection Operations
export {
    writeStepReflection,
} from "./reflections/writer.js";

export {
    readStepReflection,
    readAllReflections,
    readPriorReflections,
    type StepReflection,
} from "./reflections/reader.js";

// Retrospective Operations
export {
    loadRetrospectiveAsContext,
    retrospectiveExists,
    loadMultipleRetrospectives,
} from "./retrospective/reference.js";

// Dependency Operations
export {
    // Parsing
    parseDependenciesFromContent,
    parseDependenciesFromFile,
    parseAllDependencies,
    // Graph Building
    buildDependencyGraph,
    buildDependencyGraphFromMap,
    // Validation
    validateDependencies,
    // Critical Path
    findCriticalPath,
    // Execution Order
    computeExecutionOrder,
    // Helpers
    getReadySteps,
    getBlockedSteps,
    getDependencyChain,
    updateStepDependencies,
    // Types
    type StepDependency,
    type DependencyGraph,
    type DependencyValidation,
    type DependencyError,
    type DependencyWarning,
    type CriticalPath,
    type ExecutionOrder,
} from "./dependencies/index.js";

// Relationship Operations (library-focused; not part of MCP runtime flows)
export {
    // Parsing
    parseRelationshipsFromContent,
    parseRelationshipsFromPlan,
    // Management
    addRelationship,
    removeRelationship,
    createBidirectionalRelationship,
    // Validation
    validateRelationships,
    // Queries
    getRelationshipsByType,
    getInverseRelationType,
    getBlockingPlans,
    getBlockedPlans,
    getParentPlan,
    getChildPlans,
    getRelatedPlans,
    // Serialization
    generateRelationshipsMarkdown,
    updatePlanRelationships,
    // Types
    type AddRelationshipOptions,
    type AddRelationshipResult,
    type RelationshipValidation,
    type InvalidRelationship,
    type ParsedRelationship,
} from "./relationships/index.js";

// Plan Registry Operations
export {
    // Registry Management
    createRegistry,
    loadRegistry,
    saveRegistry,
    getDefaultRegistryPath,
    // Plan Discovery
    scanForPlans,
    // Plan Registration
    registerPlan,
    unregisterPlan,
    refreshPlan,
    refreshAllPlans,
    // Search and Query
    searchPlans,
    getPlanByCode,
    getPlanByPath,
    getPlansByStatus,
    // Statistics
    getRegistryStats,
    // Types
    type RegisteredPlan,
    type PlanRegistry,
    type RegistryOptions,
    type SearchResult,
    type SearchOptions,
    type RegistryStats,
} from "./registry/index.js";

// Retrospective Operations
export {
    generateRetrospective,
    generateRetrospectiveMarkdown,
    createRetrospective,
    type Retrospective,
    type GenerateRetrospectiveOptions,
} from "./retrospective/index.js";

// History Operations
export {
    initHistory,
    loadHistory,
    saveHistory,
    type HistoryManager,
} from "./history/manager.js";

export {
    createRevision,
    getRevision,
    listRevisions,
    compareRevisions,
    getLatestRevision,
    nextVersion,
    type RevisionInfo,
    type RevisionComparison,
} from "./history/revisions.js";

export {
    createMilestone,
    getMilestone,
    listMilestones,
    rollbackToMilestone,
    getLatestMilestone,
    type MilestoneInfo,
    type RollbackResult,
} from "./history/milestones.js";

// Renderer Operations
export {
    renderPlan,
    renderToMarkdown,
    renderToJson,
    renderToHtml,
    type RenderFormat,
    type RenderOptions,
    type RenderResult,
    type MarkdownRenderOptions,
    type JsonRenderOptions,
    type HtmlRenderOptions,
} from "./renderer/index.js";

// Template Operations
export {
    listTemplates,
    getTemplate,
    registerTemplate,
    listTemplatesByCategory,
    searchTemplatesByTag,
    type PlanTemplate,
    type TemplateStep,
} from "./templates/registry.js";

export {
    applyTemplate,
    type ApplyTemplateOptions,
    type ApplyTemplateResult,
} from "./templates/apply.js";

export {
    BasicTemplate,
    FeatureTemplate,
    RefactoringTemplate,
    MigrationTemplate,
    SprintTemplate,
} from "./templates/templates/index.js";

// Execution Operations
export {
    createExecutor,
    executeStep as executeStepWithExecutor,
    executePendingSteps,
    MockStepExecutor,
    type ExecutionProviderType,
    type ProviderConfig,
    type ExecutionContext,
    type StepExecutor,
    type ExecutorFactory,
} from "./execution/index.js";

// CLI Utilities
export {
    outputSuccess,
    outputError,
    outputWarning,
    outputInfo,
    getStatusIcon,
    formatStatus,
    outputStepList,
    outputPlanSummary,
    outputJson,
    CliError,
    handleError,
    notImplemented,
} from "./cli/utils/index.js";

export { createProgram } from "./cli/cli.js";

// Plan Commands
export {
    registerPlanCommands,
    initCommand,
    validateCommand,
    archiveCommand,
    templateCommand,
    templateListCommand,
    templateShowCommand,
    templateUseCommand,
} from "./commands/plan/index.js";

// Render Commands
export {
    registerRenderCommands,
    renderCommand,
} from "./commands/render/index.js";

// Verification Types and Constants
export type {
    CriteriaPriority,
    CriteriaStatus,
    VerificationCriterion,
    CriterionResult,
    CoverageReport,
    StepCompletionStatus,
    AcceptanceCriterion,
    StepCompletionResult,
    CompletionReport,
    VerificationReport,
} from "./verification/index.js";

export {
    PRIORITY_WEIGHTS,
    CRITERIA_PATTERNS,
    HEALTH_THRESHOLDS,
} from "./verification/index.js";

// Verification Criteria Parser
export type { ParsedCriteria } from "./verification/index.js";

export {
    parseCriteria,
    parseCriteriaFromContent,
    getCriteriaSummary,
} from "./verification/index.js";

// Verification Coverage Checker
export type { CoverageOptions } from "./verification/index.js";

export { checkCoverage } from "./verification/index.js";

// Verification Completion Checker
export { checkCompletion } from "./verification/index.js";

// Version
export const VERSION = "0.0.1";

// ===== STUB IMPLEMENTATIONS =====
// These will be implemented as the project develops

/**
 * Execute a plan step
 *
 * @param plan - The plan
 * @param stepNumber - Step to execute
 * @param context - Execution context
 * @returns Step result
 *
 * @stub Not yet implemented
 */
export async function executeStep(
    _plan: unknown,
    _stepNumber: number,
    _context?: unknown
): Promise<never> {
    throw new Error(
        "riotplan.executeStep is not yet implemented. Coming in v0.1.0!"
    );
}

/**
 * Resume a plan from its current state
 *
 * @param plan - The plan to resume
 * @param context - Execution context
 * @returns Plan result
 *
 * @stub Not yet implemented
 */
export async function resumePlan(
    _plan: unknown,
    _context?: unknown
): Promise<never> {
    throw new Error(
        "riotplan.resumePlan is not yet implemented. Coming in v0.1.0!"
    );
}

/**
 * Update plan state after step completion
 *
 * @param plan - The plan
 * @param stepNumber - Completed step
 * @param result - Step result
 * @returns Updated plan
 *
 * @stub Not yet implemented
 */
export function updatePlanState(
    _plan: unknown,
    _stepNumber: number,
    _result: unknown
): never {
    throw new Error(
        "riotplan.updatePlanState is not yet implemented. Coming in v0.1.0!"
    );
}

