/**
 * Relationships Module
 *
 * Manages cross-plan relationships:
 * - Link plans across directories and repositories
 * - Track spawned, blocking, and related plans
 * - Parse relationship declarations from plan files
 * - Validate relationship targets
 */
import type { Plan, PlanRelationship, RelationshipType } from "../types.js";
/**
 * Options for adding a relationship
 */
export interface AddRelationshipOptions {
    /** Type of relationship */
    type: RelationshipType;
    /** Path to the related plan (absolute or relative to current plan) */
    targetPath: string;
    /** Specific steps involved in the relationship */
    steps?: number[];
    /** Reason/description for the relationship */
    reason?: string;
}
/**
 * Result of adding a relationship
 */
export interface AddRelationshipResult {
    /** The created relationship */
    relationship: PlanRelationship;
    /** Whether the target plan was found and valid */
    targetValid: boolean;
    /** Target plan metadata if found */
    targetPlan?: {
        code: string;
        name: string;
        path: string;
    };
}
/**
 * Relationship validation result
 */
export interface RelationshipValidation {
    /** All relationships valid */
    valid: boolean;
    /** Invalid relationships */
    invalid: InvalidRelationship[];
    /** Valid relationships */
    validRelationships: PlanRelationship[];
}
/**
 * An invalid relationship
 */
export interface InvalidRelationship {
    relationship: PlanRelationship;
    reason: string;
}
/**
 * Parsed relationship from file content
 */
export interface ParsedRelationship {
    type: RelationshipType;
    targetPath: string;
    steps?: number[];
    reason?: string;
}
/**
 * Parse relationships from plan content
 *
 * Looks for relationship declarations in markdown:
 * - `## Related Plans` section with formatted links
 * - `spawned-from: path/to/plan` in frontmatter
 * - `blocks: path/to/plan` in frontmatter
 *
 * Supported formats in ## Related Plans:
 * - `- **spawned-from**: path/to/plan - reason`
 * - `- [plan-name](path/to/plan) - blocks Step 3`
 * - `- path/to/plan (related)`
 *
 * @param content - Plan file content (typically SUMMARY.md or meta-prompt)
 * @returns Array of parsed relationships
 */
export declare function parseRelationshipsFromContent(content: string): ParsedRelationship[];
/**
 * Parse relationships from a plan's SUMMARY.md or meta-prompt
 *
 * @param planPath - Path to the plan directory
 * @returns Array of parsed relationships
 */
export declare function parseRelationshipsFromPlan(planPath: string): Promise<ParsedRelationship[]>;
/**
 * Add a relationship to a plan
 *
 * @param plan - The source plan
 * @param options - Relationship options
 * @returns Result with the created relationship
 */
export declare function addRelationship(plan: Plan, options: AddRelationshipOptions): Promise<AddRelationshipResult>;
/**
 * Remove a relationship from a plan
 *
 * @param plan - The source plan
 * @param targetPath - Path to the related plan to remove
 * @param type - Optional type to match (removes all types if not specified)
 * @returns Removed relationships
 */
export declare function removeRelationship(plan: Plan, targetPath: string, type?: RelationshipType): PlanRelationship[];
/**
 * Get all relationships of a specific type
 *
 * @param plan - The plan to query
 * @param type - Relationship type to filter by
 * @returns Matching relationships
 */
export declare function getRelationshipsByType(plan: Plan, type: RelationshipType): PlanRelationship[];
/**
 * Get the inverse relationship type
 */
export declare function getInverseRelationType(type: RelationshipType): RelationshipType;
/**
 * Create a bidirectional relationship between two plans
 *
 * @param sourcePlan - The source plan
 * @param targetPlan - The target plan
 * @param type - Relationship type from source's perspective
 * @param reason - Optional reason
 */
export declare function createBidirectionalRelationship(sourcePlan: Plan, targetPlan: Plan, type: RelationshipType, reason?: string): void;
/**
 * Validate all relationships in a plan
 *
 * @param plan - The plan to validate
 * @returns Validation result
 */
export declare function validateRelationships(plan: Plan): Promise<RelationshipValidation>;
/**
 * Find all plans that block this plan
 *
 * @param plan - The plan to check
 * @returns Paths to blocking plans
 */
export declare function getBlockingPlans(plan: Plan): string[];
/**
 * Find all plans that this plan blocks
 *
 * @param plan - The plan to check
 * @returns Paths to blocked plans
 */
export declare function getBlockedPlans(plan: Plan): string[];
/**
 * Find the parent plan (if this plan was spawned from another)
 *
 * @param plan - The plan to check
 * @returns Path to parent plan or null
 */
export declare function getParentPlan(plan: Plan): string | null;
/**
 * Find all child plans (plans spawned from this one)
 *
 * @param plan - The plan to check
 * @returns Paths to child plans
 */
export declare function getChildPlans(plan: Plan): string[];
/**
 * Find all related plans (general relationships)
 *
 * @param plan - The plan to check
 * @returns Paths to related plans
 */
export declare function getRelatedPlans(plan: Plan): string[];
/**
 * Generate markdown for a plan's relationships section
 *
 * @param plan - The plan with relationships
 * @returns Markdown string for ## Related Plans section
 */
export declare function generateRelationshipsMarkdown(plan: Plan): string;
/**
 * Update a plan's SUMMARY.md with relationships
 *
 * @param plan - The plan to update
 */
export declare function updatePlanRelationships(plan: Plan): Promise<void>;
//# sourceMappingURL=index.d.ts.map