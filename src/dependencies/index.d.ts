/**
 * Dependencies Module
 *
 * Provides dependency tracking and analysis for plan steps:
 * - Parse dependencies from step markdown files
 * - Build dependency graphs
 * - Detect circular dependencies
 * - Compute critical path
 * - Determine execution order
 */
import type { Plan, PlanStep } from "../types.js";
/**
 * Dependency information for a step
 */
export interface StepDependency {
    /** The step that has dependencies */
    stepNumber: number;
    /** Steps this step depends on (must be completed before this step) */
    dependsOn: number[];
    /** Steps that depend on this step (blocked until this completes) */
    blockedBy: number[];
}
/**
 * A dependency graph for the entire plan
 */
export interface DependencyGraph {
    /** Map of step number to its dependencies */
    dependencies: Map<number, StepDependency>;
    /** Steps with no dependencies (can start immediately) */
    roots: number[];
    /** Steps with no dependents (end points) */
    leaves: number[];
    /** Whether the graph has circular dependencies */
    hasCircular: boolean;
    /** Circular dependency chains if any */
    circularChains: number[][];
}
/**
 * Result of dependency validation
 */
export interface DependencyValidation {
    /** Whether all dependencies are valid */
    valid: boolean;
    /** Errors found */
    errors: DependencyError[];
    /** Warnings found */
    warnings: DependencyWarning[];
}
/**
 * A dependency error
 */
export interface DependencyError {
    /** Error type */
    type: "circular" | "missing" | "self-reference" | "invalid-step" | "duplicate";
    /** Affected step */
    stepNumber: number;
    /** Related steps */
    relatedSteps?: number[];
    /** Error message */
    message: string;
}
/**
 * A dependency warning
 */
export interface DependencyWarning {
    /** Warning type */
    type: "long-chain" | "bottleneck" | "orphan";
    /** Affected step */
    stepNumber: number;
    /** Warning message */
    message: string;
}
/**
 * Critical path analysis result
 */
export interface CriticalPath {
    /** Steps in the critical path (in order) */
    path: number[];
    /** Total length of the critical path */
    length: number;
    /** Estimated duration (if steps have duration estimates) */
    estimatedDuration?: number;
}
/**
 * Execution order for steps
 */
export interface ExecutionOrder {
    /** Steps in execution order (respects dependencies) */
    order: number[];
    /** Steps grouped by parallel execution level */
    levels: number[][];
}
/**
 * Parse dependencies from step content
 *
 * Looks for dependency declarations in the markdown:
 * - `## Dependencies` section with bullet points
 * - `depends-on: 1, 2, 3` in frontmatter
 * - Inline references like `(depends on Step 01)`
 *
 * @param content - Step file content
 * @returns Array of step numbers this step depends on
 */
export declare function parseDependenciesFromContent(content: string): number[];
/**
 * Parse dependencies from a step file
 *
 * @param filePath - Path to step file
 * @returns Array of step numbers this step depends on
 */
export declare function parseDependenciesFromFile(filePath: string): Promise<number[]>;
/**
 * Parse all dependencies from a plan
 *
 * @param plan - The plan to analyze
 * @returns Map of step number to its dependencies
 */
export declare function parseAllDependencies(plan: Plan): Promise<Map<number, number[]>>;
/**
 * Build a dependency graph from a plan
 *
 * @param plan - The plan to analyze
 * @returns Dependency graph
 */
export declare function buildDependencyGraph(plan: Plan): Promise<DependencyGraph>;
/**
 * Build a dependency graph from a pre-parsed dependency map
 *
 * @param plan - The plan
 * @param rawDeps - Map of step number to dependencies
 * @returns Dependency graph
 */
export declare function buildDependencyGraphFromMap(plan: Plan, rawDeps: Map<number, number[]>): DependencyGraph;
/**
 * Validate dependencies in a plan
 *
 * @param plan - The plan to validate
 * @param graph - Optional pre-built dependency graph
 * @param rawDeps - Optional raw dependencies map (before filtering)
 * @returns Validation result
 */
export declare function validateDependencies(plan: Plan, graph?: DependencyGraph, rawDeps?: Map<number, number[]>): Promise<DependencyValidation>;
/**
 * Find the critical path through the plan
 *
 * The critical path is the longest sequence of dependent steps
 * that determines the minimum time to complete the plan.
 *
 * @param plan - The plan to analyze
 * @param graph - Optional pre-built dependency graph
 * @returns Critical path information
 */
export declare function findCriticalPath(plan: Plan, graph?: DependencyGraph): Promise<CriticalPath>;
/**
 * Compute execution order that respects dependencies
 *
 * Returns both a linear order and parallel execution levels.
 *
 * @param plan - The plan to analyze
 * @param graph - Optional pre-built dependency graph
 * @returns Execution order information
 */
export declare function computeExecutionOrder(plan: Plan, graph?: DependencyGraph): Promise<ExecutionOrder>;
/**
 * Get steps that can be started now (all dependencies completed)
 *
 * @param plan - The plan
 * @param graph - Optional pre-built dependency graph
 * @returns Steps ready to start
 */
export declare function getReadySteps(plan: Plan, graph?: DependencyGraph): Promise<PlanStep[]>;
/**
 * Get steps that are blocked by a specific step
 *
 * @param plan - The plan
 * @param stepNumber - The blocking step
 * @param graph - Optional pre-built dependency graph
 * @returns Steps blocked by this step
 */
export declare function getBlockedSteps(plan: Plan, stepNumber: number, graph?: DependencyGraph): Promise<PlanStep[]>;
/**
 * Get the dependency chain for a step (all transitive dependencies)
 *
 * @param plan - The plan
 * @param stepNumber - The step to analyze
 * @param graph - Optional pre-built dependency graph
 * @returns All steps that must be completed before this step
 */
export declare function getDependencyChain(plan: Plan, stepNumber: number, graph?: DependencyGraph): Promise<number[]>;
/**
 * Update step dependencies in memory
 *
 * @param step - The step to update
 * @param dependencies - New dependency list
 * @returns Updated step
 */
export declare function updateStepDependencies(step: PlanStep, dependencies: number[]): PlanStep;
//# sourceMappingURL=index.d.ts.map