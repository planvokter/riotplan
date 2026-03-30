/**
 * RiotPlan - Framework for long-lived, stateful AI workflows
 *
 * Plans are SQLite .plan files managed through riotplan-format.
 */

// ===== EXPORTS =====

// Types
export type {
    TaskStatus,
    Priority,
    FeedbackPlatform,
    FeedbackParticipant,
    FeedbackContext,
    FeedbackRecord,
    EvidenceType,
    EvidenceRecord,
    PlanRevision,
    PlanMilestone,
    PlanHistory,
    ContextId,
    PlanContextDefinition,
    RelationshipType,
    PlanRelationship,
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
export { createPlan, type CreatePlanConfig } from "./plan/creator.js";

// Configuration (package root; avoids broken npm subpath typings for ./config)
export type { RiotPlanConfig } from "./config/index.js";
export { RiotPlanConfigSchema } from "./config/index.js";
export {
    loadConfig,
    clearConfigCache,
    checkConfigWithCardiganTime,
    findPlansDirectory,
    clearWalkUpCache,
    resolvePlanDirectory,
    resolvePlanDirectorySync,
    clearResolverCache,
    loadConfiguredCatalysts,
    clearCatalystCache,
    getCatalystEnvOverrides,
} from "./config/index.js";

export { getPlanCategory, type PlanCategory } from "./plan/category.js";

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
