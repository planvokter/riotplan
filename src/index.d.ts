/**
 * RiotPlan - Framework for long-lived, stateful AI workflows
 *
 * Plans are SQLite .plan files managed through riotplan-format.
 */
export type { TaskStatus, Priority, FeedbackPlatform, FeedbackParticipant, FeedbackContext, FeedbackRecord, EvidenceType, EvidenceRecord, PlanRevision, PlanMilestone, PlanHistory, ContextId, PlanContextDefinition, RelationshipType, PlanRelationship, PlanStep, PlanPhase, Blocker, Issue, PlanMetadata, PlanFiles, PlanState, Plan, PlanContext, StepResult, PlanResult, StatusDocument, ExecutionPlanDocument, } from "./types.js";
export { PLAN_CONVENTIONS } from "./types.js";
export { loadPlan, type LoadPlanOptions } from "./plan/loader.js";
export { createAnalysisDirectory, loadAnalysis, hasAnalysis, type Analysis, type ElaborationRecord, type AnalysisMetadata, type CreateAnalysisOptions, } from "./analysis/index.js";
export { parseStatus, type ParseStatusOptions, type ParseStatusResult, } from "./status/parser.js";
export { generateStatus, updateStatus, type GenerateStatusOptions, type UpdateStatusOptions, } from "./status/generator.js";
export { insertStep, removeStep, moveStep, blockStep, unblockStep, completeStep, startStep, skipStep, failStep, type InsertStepOptions, type InsertStepResult, type RemoveStepResult, type MoveStepResult, } from "./steps/operations.js";
export { writeStepReflection, } from "./reflections/writer.js";
export { readStepReflection, readAllReflections, readPriorReflections, type StepReflection, } from "./reflections/reader.js";
export { readPlanDoc, savePlanDoc, readIdeaDoc, saveIdeaDoc, readShapingDoc, saveShapingDoc, readStatusDoc, saveStatusDoc, readEvidenceRecords, readTimelineEvents, readPlanIdentity, type PlanDoc, type EvidenceEntry, type TimelineEventEntry, } from "./artifacts/operations.js";
export { loadRetrospectiveAsContext, retrospectiveExists, loadMultipleRetrospectives, } from "./retrospective/reference.js";
export { parseDependenciesFromContent, parseDependenciesFromFile, parseAllDependencies, buildDependencyGraph, buildDependencyGraphFromMap, validateDependencies, findCriticalPath, computeExecutionOrder, getReadySteps, getBlockedSteps, getDependencyChain, updateStepDependencies, type StepDependency, type DependencyGraph, type DependencyValidation, type DependencyError, type DependencyWarning, type CriticalPath, type ExecutionOrder, } from "./dependencies/index.js";
export { parseRelationshipsFromContent, parseRelationshipsFromPlan, addRelationship, removeRelationship, createBidirectionalRelationship, validateRelationships, getRelationshipsByType, getInverseRelationType, getBlockingPlans, getBlockedPlans, getParentPlan, getChildPlans, getRelatedPlans, generateRelationshipsMarkdown, updatePlanRelationships, type AddRelationshipOptions, type AddRelationshipResult, type RelationshipValidation, type InvalidRelationship, type ParsedRelationship, } from "./relationships/index.js";
export { createRegistry, loadRegistry, saveRegistry, getDefaultRegistryPath, scanForPlans, registerPlan, unregisterPlan, refreshPlan, refreshAllPlans, searchPlans, getPlanByCode, getPlanByPath, getPlansByStatus, getRegistryStats, type RegisteredPlan, type PlanRegistry, type RegistryOptions, type SearchResult, type SearchOptions, type RegistryStats, } from "./registry/index.js";
export { generateRetrospective, generateRetrospectiveMarkdown, createRetrospective, type Retrospective, type GenerateRetrospectiveOptions, } from "./retrospective/index.js";
export { initHistory, loadHistory, saveHistory, type HistoryManager, } from "./history/manager.js";
export { createRevision, getRevision, listRevisions, compareRevisions, getLatestRevision, nextVersion, type RevisionInfo, type RevisionComparison, } from "./history/revisions.js";
export { createMilestone, getMilestone, listMilestones, rollbackToMilestone, getLatestMilestone, type MilestoneInfo, type RollbackResult, } from "./history/milestones.js";
export { renderPlan, renderToMarkdown, renderToJson, renderToHtml, type RenderFormat, type RenderOptions, type RenderResult, type MarkdownRenderOptions, type JsonRenderOptions, type HtmlRenderOptions, } from "@kjerneverk/riotplan-render";
export { listTemplates, getTemplate, registerTemplate, applyTemplate, listTemplatesByCategory, searchTemplatesByTag, BasicTemplate, FeatureTemplate, RefactoringTemplate, MigrationTemplate, SprintTemplate, type PlanTemplate, type TemplateStep, type ApplyTemplateResult, type ApplyTemplateOptions, } from "@kjerneverk/riotplan-templates";
export type { CriteriaPriority, CriteriaStatus, VerificationCriterion, CriterionResult, CoverageReport, StepCompletionStatus, AcceptanceCriterion, StepCompletionResult, CompletionReport, VerificationReport, ParsedCriteria, CoverageOptions, } from "@kjerneverk/riotplan-verify";
export { PRIORITY_WEIGHTS, CRITERIA_PATTERNS, HEALTH_THRESHOLDS, parseCriteria, parseCriteriaFromContent, getCriteriaSummary, checkCoverage, checkCompletion, } from "@kjerneverk/riotplan-verify";
export declare const VERSION = "0.0.1";
//# sourceMappingURL=index.d.ts.map