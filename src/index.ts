/**
 * RiotPlan - Framework for long-lived, stateful AI workflows
 *
 * A plan is a structured way to manage multi-step AI-assisted tasks that:
 * - Span multiple sessions/days
 * - Have persistent state (STATUS.md)
 * - Are organized into numbered steps
 * - Can be interrupted and resumed
 * - Track progress with checkboxes and statuses
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

// Plan Artifact Operations
export {
    readPlanDoc,
    savePlanDoc,
    readIdeaDoc,
    saveIdeaDoc,
    readShapingDoc,
    saveShapingDoc,
    readStatusDoc,
    saveStatusDoc,
    readEvidenceRecords,
    readTimelineEvents,
    readPlanIdentity,
    type PlanDoc,
    type EvidenceEntry,
    type TimelineEventEntry,
} from "./artifacts/operations.js";

// Retrospective Operations
export {
    loadRetrospectiveAsContext,
    retrospectiveExists,
    loadMultipleRetrospectives,
} from "./retrospective/reference.js";

// Dependency Operations
export {
    parseDependenciesFromContent,
    parseDependenciesFromFile,
    parseAllDependencies,
    buildDependencyGraph,
    buildDependencyGraphFromMap,
    validateDependencies,
    findCriticalPath,
    computeExecutionOrder,
    getReadySteps,
    getBlockedSteps,
    getDependencyChain,
    updateStepDependencies,
    type StepDependency,
    type DependencyGraph,
    type DependencyValidation,
    type DependencyError,
    type DependencyWarning,
    type CriticalPath,
    type ExecutionOrder,
} from "./dependencies/index.js";

// Relationship Operations
export {
    parseRelationshipsFromContent,
    parseRelationshipsFromPlan,
    addRelationship,
    removeRelationship,
    createBidirectionalRelationship,
    validateRelationships,
    getRelationshipsByType,
    getInverseRelationType,
    getBlockingPlans,
    getBlockedPlans,
    getParentPlan,
    getChildPlans,
    getRelatedPlans,
    generateRelationshipsMarkdown,
    updatePlanRelationships,
    type AddRelationshipOptions,
    type AddRelationshipResult,
    type RelationshipValidation,
    type InvalidRelationship,
    type ParsedRelationship,
} from "./relationships/index.js";

// Plan Registry Operations
export {
    createRegistry,
    loadRegistry,
    saveRegistry,
    getDefaultRegistryPath,
    scanForPlans,
    registerPlan,
    unregisterPlan,
    refreshPlan,
    refreshAllPlans,
    searchPlans,
    getPlanByCode,
    getPlanByPath,
    getPlansByStatus,
    getRegistryStats,
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

// Renderer Operations (re-exported from @kjerneverk/riotplan-render)
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
} from "@kjerneverk/riotplan-render";

// Template Operations (re-exported from @kjerneverk/riotplan-templates)
export {
    listTemplates,
    getTemplate,
    registerTemplate,
    listTemplatesByCategory,
    searchTemplatesByTag,
    BasicTemplate,
    FeatureTemplate,
    RefactoringTemplate,
    MigrationTemplate,
    SprintTemplate,
    type PlanTemplate,
    type TemplateStep,
    type ApplyTemplateResult,
} from "@kjerneverk/riotplan-templates";
export type { ApplyTemplateOptions } from "@kjerneverk/riotplan-templates";

import { applyTemplate as _applyTemplate, type ApplyTemplateOptions as _ApplyOpts } from "@kjerneverk/riotplan-templates";
import { createPlan } from "./plan/creator.js";

/**
 * Backward-compatible applyTemplate that auto-injects createPlan.
 * The upstream @kjerneverk/riotplan-templates version requires createPlan
 * to be passed explicitly to avoid a circular dependency.
 */
export async function applyTemplate(options: Omit<_ApplyOpts, 'createPlan'> & { createPlan?: _ApplyOpts['createPlan'] }) {
    return _applyTemplate({ ...options, createPlan: options.createPlan ?? createPlan });
}

// Verification (re-exported from @kjerneverk/riotplan-verify)
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
    ParsedCriteria,
    CoverageOptions,
} from "@kjerneverk/riotplan-verify";

export {
    PRIORITY_WEIGHTS,
    CRITERIA_PATTERNS,
    HEALTH_THRESHOLDS,
    parseCriteria,
    parseCriteriaFromContent,
    getCriteriaSummary,
    checkCoverage,
    checkCompletion,
} from "@kjerneverk/riotplan-verify";

// Version
export const VERSION = "0.0.1";
