/**
 * RiotPlan - Framework for long-lived, stateful AI workflows
 *
 * Plans are SQLite .plan files managed through riotplan-format.
 */
// Constants
export { PLAN_CONVENTIONS } from "./types.js";
// Plan Operations
export { loadPlan } from "./plan/loader.js";
// Analysis Operations
export { createAnalysisDirectory, loadAnalysis, hasAnalysis, } from "./analysis/index.js";
// Status Operations
export { parseStatus, } from "./status/parser.js";
export { generateStatus, updateStatus, } from "./status/generator.js";
// Step Operations
export { insertStep, removeStep, moveStep, blockStep, unblockStep, completeStep, startStep, skipStep, failStep, } from "./steps/operations.js";
// Reflection Operations
export { writeStepReflection, } from "./reflections/writer.js";
export { readStepReflection, readAllReflections, readPriorReflections, } from "./reflections/reader.js";
// Plan Artifact Operations
export { readPlanDoc, savePlanDoc, readIdeaDoc, saveIdeaDoc, readShapingDoc, saveShapingDoc, readStatusDoc, saveStatusDoc, readEvidenceRecords, readTimelineEvents, readPlanIdentity, } from "./artifacts/operations.js";
// Retrospective Operations
export { loadRetrospectiveAsContext, retrospectiveExists, loadMultipleRetrospectives, } from "./retrospective/reference.js";
// Dependency Operations
export { parseDependenciesFromContent, parseDependenciesFromFile, parseAllDependencies, buildDependencyGraph, buildDependencyGraphFromMap, validateDependencies, findCriticalPath, computeExecutionOrder, getReadySteps, getBlockedSteps, getDependencyChain, updateStepDependencies, } from "./dependencies/index.js";
// Relationship Operations
export { parseRelationshipsFromContent, parseRelationshipsFromPlan, addRelationship, removeRelationship, createBidirectionalRelationship, validateRelationships, getRelationshipsByType, getInverseRelationType, getBlockingPlans, getBlockedPlans, getParentPlan, getChildPlans, getRelatedPlans, generateRelationshipsMarkdown, updatePlanRelationships, } from "./relationships/index.js";
// Plan Registry Operations
export { createRegistry, loadRegistry, saveRegistry, getDefaultRegistryPath, scanForPlans, registerPlan, unregisterPlan, refreshPlan, refreshAllPlans, searchPlans, getPlanByCode, getPlanByPath, getPlansByStatus, getRegistryStats, } from "./registry/index.js";
// Retrospective Operations
export { generateRetrospective, generateRetrospectiveMarkdown, createRetrospective, } from "./retrospective/index.js";
// History Operations
export { initHistory, loadHistory, saveHistory, } from "./history/manager.js";
export { createRevision, getRevision, listRevisions, compareRevisions, getLatestRevision, nextVersion, } from "./history/revisions.js";
export { createMilestone, getMilestone, listMilestones, rollbackToMilestone, getLatestMilestone, } from "./history/milestones.js";
// Renderer Operations (re-exported from @kjerneverk/riotplan-render)
export { renderPlan, renderToMarkdown, renderToJson, renderToHtml, } from "@kjerneverk/riotplan-render";
// Template Operations (re-exported from @kjerneverk/riotplan-templates)
export { listTemplates, getTemplate, registerTemplate, applyTemplate, listTemplatesByCategory, searchTemplatesByTag, BasicTemplate, FeatureTemplate, RefactoringTemplate, MigrationTemplate, SprintTemplate, } from "@kjerneverk/riotplan-templates";
export { PRIORITY_WEIGHTS, CRITERIA_PATTERNS, HEALTH_THRESHOLDS, parseCriteria, parseCriteriaFromContent, getCriteriaSummary, checkCoverage, checkCompletion, } from "@kjerneverk/riotplan-verify";
// Version
export const VERSION = "0.0.1";
//# sourceMappingURL=index.js.map