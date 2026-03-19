/**
 * Relationships Module
 *
 * Manages cross-plan relationships:
 * - Link plans across directories and repositories
 * - Track spawned, blocking, and related plans
 * - Parse relationship declarations from plan files
 * - Validate relationship targets
 */

import { resolve, relative, isAbsolute } from "node:path";
import type { Plan, PlanRelationship, RelationshipType } from "../types.js";
import { loadPlan } from "../plan/loader.js";
import { readPlanDoc, savePlanDoc } from "../artifacts/operations.js";

// ===== TYPES =====

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

// ===== PARSING =====

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
export function parseRelationshipsFromContent(content: string): ParsedRelationship[] {
    const relationships: ParsedRelationship[] = [];

    // Parse frontmatter relationships
    // Use indexOf to avoid polynomial regex
    let frontmatter: string | null = null;
    if (content.startsWith('---\n')) {
        const endMarker = content.indexOf('\n---', 4);
        if (endMarker !== -1) {
            frontmatter = content.substring(4, endMarker);
        }
    }
    
    if (frontmatter) {

        // spawned-from: path
        const spawnedFrom = frontmatter.match(/spawned-from:\s*(.+)/);
        if (spawnedFrom) {
            relationships.push({
                type: "spawned-from",
                targetPath: spawnedFrom[1].trim(),
            });
        }

        // blocks: path1, path2
        const blocksMatch = frontmatter.match(/blocks:\s*(.+)/);
        if (blocksMatch) {
            const paths = blocksMatch[1].split(",").map((p) => p.trim());
            for (const path of paths) {
                relationships.push({
                    type: "blocks",
                    targetPath: path,
                });
            }
        }

        // blocked-by: path
        const blockedBy = frontmatter.match(/blocked-by:\s*(.+)/);
        if (blockedBy) {
            const paths = blockedBy[1].split(",").map((p) => p.trim());
            for (const path of paths) {
                relationships.push({
                    type: "blocked-by",
                    targetPath: path,
                });
            }
        }

        // related: path1, path2
        const relatedMatch = frontmatter.match(/related:\s*(.+)/);
        if (relatedMatch) {
            const paths = relatedMatch[1].split(",").map((p) => p.trim());
            for (const path of paths) {
                relationships.push({
                    type: "related",
                    targetPath: path,
                });
            }
        }
    }

    // Parse ## Related Plans section
    // Use line-by-line parsing to avoid polynomial regex
    const lines = content.split('\n');
    const sectionLines: string[] = [];
    let inSection = false;
    
    for (const line of lines) {
        if (/^##\s+Related\s+Plans?$/i.test(line)) {
            inSection = true;
            continue;
        }
        if (inSection && /^#/.test(line)) {
            break;
        }
        if (inSection) {
            sectionLines.push(line);
        }
    }
    
    if (sectionLines.length > 0) {
        const section = sectionLines.join('\n');
        const lines = section.split("\n");

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("-")) continue;

            const itemContent = trimmed.slice(1).trim();

            // Parse: **type**: path - reason
            // The path can contain hyphens and slashes, so we need a better regex
            const typePathMatch = itemContent.match(
                /\*\*(\w+(?:-\w+)?)\*\*:\s*([^\s]+)(?:\s+-\s+(.+))?/
            );
            if (typePathMatch) {
                const [, typeStr, path, reason] = typePathMatch;
                const type = normalizeRelationType(typeStr);
                if (type) {
                    relationships.push({
                        type,
                        targetPath: path,
                        reason: reason?.trim(),
                    });
                    continue;
                }
            }

            // Parse: [name](path) - description (type)
            const linkMatch = itemContent.match(
                /\[([^\]]+)\]\(([^)]+)\)(?:\s*-\s*(.+))?/
            );
            if (linkMatch) {
                const [, , path, desc] = linkMatch;
                let type: RelationshipType = "related";
                let reason = desc?.trim();

                // Try to extract type from description
                if (desc) {
                    const typeInDesc = desc.match(
                        /\((spawned-from|spawned|blocks|blocked-by|related)\)/i
                    );
                    if (typeInDesc) {
                        type = normalizeRelationType(typeInDesc[1]) || "related";
                        reason = desc.replace(typeInDesc[0], "").trim();
                    } else if (desc.toLowerCase().includes("blocks")) {
                        type = "blocks";
                    } else if (desc.toLowerCase().includes("blocked")) {
                        type = "blocked-by";
                    } else if (desc.toLowerCase().includes("spawned from")) {
                        type = "spawned-from";
                    }
                }

                relationships.push({
                    type,
                    targetPath: path,
                    reason: reason || undefined,
                });
                continue;
            }

            // Parse: path (type) - reason
            const simpleMatch = itemContent.match(
                /([^\s(]+)\s*(?:\((\w+(?:-\w+)?)\))?(?:\s*-\s*(.+))?/
            );
            if (simpleMatch) {
                const [, path, typeStr, reason] = simpleMatch;
                const type = typeStr
                    ? normalizeRelationType(typeStr) || "related"
                    : "related";
                relationships.push({
                    type,
                    targetPath: path,
                    reason: reason?.trim(),
                });
            }
        }
    }

    // Deduplicate within the same content
    const seen = new Set<string>();
    return relationships.filter((r) => {
        const key = `${r.type}:${r.targetPath}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Normalize a relationship type string
 */
function normalizeRelationType(str: string): RelationshipType | null {
    const normalized = str.toLowerCase().replace(/_/g, "-");
    const validTypes: RelationshipType[] = [
        "spawned-from",
        "spawned",
        "blocks",
        "blocked-by",
        "related",
    ];
    return validTypes.find((t) => t === normalized) || null;
}

/**
 * Parse relationships from a plan's SUMMARY.md or meta-prompt
 *
 * @param planPath - Path to the plan directory
 * @returns Array of parsed relationships
 */
export async function parseRelationshipsFromPlan(
    planPath: string
): Promise<ParsedRelationship[]> {
    const relationships: ParsedRelationship[] = [];

    const summaryDoc = await readPlanDoc(planPath, "summary", "SUMMARY.md");
    if (summaryDoc) {
        relationships.push(...parseRelationshipsFromContent(summaryDoc.content));
    }

    const seen = new Set<string>();
    return relationships.filter((r) => {
        const key = `${r.type}:${r.targetPath}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ===== RELATIONSHIP MANAGEMENT =====

/**
 * Add a relationship to a plan
 *
 * @param plan - The source plan
 * @param options - Relationship options
 * @returns Result with the created relationship
 */
export async function addRelationship(
    plan: Plan,
    options: AddRelationshipOptions
): Promise<AddRelationshipResult> {
    const { type, targetPath, steps, reason } = options;

    // Resolve target path
    const resolvedTarget = isAbsolute(targetPath)
        ? targetPath
        : resolve(plan.metadata.path, targetPath);

    let targetValid = false;
    let targetPlan: AddRelationshipResult["targetPlan"];

    try {
        const target = await loadPlan(resolvedTarget);
        targetValid = true;
        targetPlan = {
            code: target.metadata.code,
            name: target.metadata.name,
            path: resolvedTarget,
        };
    } catch {
        // Target doesn't exist or isn't a valid plan
    }

    const relationship: PlanRelationship = {
        type,
        planPath: targetPath, // Store original path
        steps,
        reason,
        createdAt: new Date(),
    };

    // Add to plan (in memory)
    if (!plan.relationships) {
        plan.relationships = [];
    }
    plan.relationships.push(relationship);

    return {
        relationship,
        targetValid,
        targetPlan,
    };
}

/**
 * Remove a relationship from a plan
 *
 * @param plan - The source plan
 * @param targetPath - Path to the related plan to remove
 * @param type - Optional type to match (removes all types if not specified)
 * @returns Removed relationships
 */
export function removeRelationship(
    plan: Plan,
    targetPath: string,
    type?: RelationshipType
): PlanRelationship[] {
    if (!plan.relationships) return [];

    const removed: PlanRelationship[] = [];
    plan.relationships = plan.relationships.filter((r) => {
        const matches =
            r.planPath === targetPath && (type === undefined || r.type === type);
        if (matches) removed.push(r);
        return !matches;
    });

    return removed;
}

/**
 * Get all relationships of a specific type
 *
 * @param plan - The plan to query
 * @param type - Relationship type to filter by
 * @returns Matching relationships
 */
export function getRelationshipsByType(
    plan: Plan,
    type: RelationshipType
): PlanRelationship[] {
    return (plan.relationships || []).filter((r) => r.type === type);
}

/**
 * Get the inverse relationship type
 */
export function getInverseRelationType(
    type: RelationshipType
): RelationshipType {
    switch (type) {
        case "spawned-from":
            return "spawned";
        case "spawned":
            return "spawned-from";
        case "blocks":
            return "blocked-by";
        case "blocked-by":
            return "blocks";
        case "related":
            return "related";
    }
}

/**
 * Create a bidirectional relationship between two plans
 *
 * @param sourcePlan - The source plan
 * @param targetPlan - The target plan
 * @param type - Relationship type from source's perspective
 * @param reason - Optional reason
 */
export function createBidirectionalRelationship(
    sourcePlan: Plan,
    targetPlan: Plan,
    type: RelationshipType,
    reason?: string
): void {
    // Add forward relationship
    if (!sourcePlan.relationships) {
        sourcePlan.relationships = [];
    }
    sourcePlan.relationships.push({
        type,
        planPath: relative(sourcePlan.metadata.path, targetPlan.metadata.path),
        reason,
        createdAt: new Date(),
    });

    // Add inverse relationship
    if (!targetPlan.relationships) {
        targetPlan.relationships = [];
    }
    targetPlan.relationships.push({
        type: getInverseRelationType(type),
        planPath: relative(targetPlan.metadata.path, sourcePlan.metadata.path),
        reason,
        createdAt: new Date(),
    });
}

// ===== VALIDATION =====

/**
 * Validate all relationships in a plan
 *
 * @param plan - The plan to validate
 * @returns Validation result
 */
export async function validateRelationships(
    plan: Plan
): Promise<RelationshipValidation> {
    const invalid: InvalidRelationship[] = [];
    const validRelationships: PlanRelationship[] = [];

    if (!plan.relationships) {
        return { valid: true, invalid: [], validRelationships: [] };
    }

    for (const rel of plan.relationships) {
        // Resolve path
        const resolvedPath = isAbsolute(rel.planPath)
            ? rel.planPath
            : resolve(plan.metadata.path, rel.planPath);

        try {
            await loadPlan(resolvedPath);
            validRelationships.push(rel);
        } catch {
            invalid.push({
                relationship: rel,
                reason: `Target plan not found: ${rel.planPath}`,
            });
        }
    }

    return {
        valid: invalid.length === 0,
        invalid,
        validRelationships,
    };
}

// ===== QUERY FUNCTIONS =====

/**
 * Find all plans that block this plan
 *
 * @param plan - The plan to check
 * @returns Paths to blocking plans
 */
export function getBlockingPlans(plan: Plan): string[] {
    return getRelationshipsByType(plan, "blocked-by").map((r) => r.planPath);
}

/**
 * Find all plans that this plan blocks
 *
 * @param plan - The plan to check
 * @returns Paths to blocked plans
 */
export function getBlockedPlans(plan: Plan): string[] {
    return getRelationshipsByType(plan, "blocks").map((r) => r.planPath);
}

/**
 * Find the parent plan (if this plan was spawned from another)
 *
 * @param plan - The plan to check
 * @returns Path to parent plan or null
 */
export function getParentPlan(plan: Plan): string | null {
    const spawnedFrom = getRelationshipsByType(plan, "spawned-from");
    return spawnedFrom.length > 0 ? spawnedFrom[0].planPath : null;
}

/**
 * Find all child plans (plans spawned from this one)
 *
 * @param plan - The plan to check
 * @returns Paths to child plans
 */
export function getChildPlans(plan: Plan): string[] {
    return getRelationshipsByType(plan, "spawned").map((r) => r.planPath);
}

/**
 * Find all related plans (general relationships)
 *
 * @param plan - The plan to check
 * @returns Paths to related plans
 */
export function getRelatedPlans(plan: Plan): string[] {
    return getRelationshipsByType(plan, "related").map((r) => r.planPath);
}

// ===== SERIALIZATION =====

/**
 * Generate markdown for a plan's relationships section
 *
 * @param plan - The plan with relationships
 * @returns Markdown string for ## Related Plans section
 */
export function generateRelationshipsMarkdown(plan: Plan): string {
    if (!plan.relationships || plan.relationships.length === 0) {
        return "";
    }

    const lines: string[] = ["## Related Plans", ""];

    // Group by type
    const byType = new Map<RelationshipType, PlanRelationship[]>();
    for (const rel of plan.relationships) {
        const list = byType.get(rel.type) || [];
        list.push(rel);
        byType.set(rel.type, list);
    }

    const typeLabels: Record<RelationshipType, string> = {
        "spawned-from": "Spawned From",
        spawned: "Spawned",
        blocks: "Blocks",
        "blocked-by": "Blocked By",
        related: "Related",
    };

    for (const [type, rels] of byType) {
        lines.push(`### ${typeLabels[type]}`);
        lines.push("");
        for (const rel of rels) {
            let line = `- **${type}**: ${rel.planPath}`;
            if (rel.reason) {
                line += ` - ${rel.reason}`;
            }
            if (rel.steps && rel.steps.length > 0) {
                line += ` (Steps: ${rel.steps.join(", ")})`;
            }
            lines.push(line);
        }
        lines.push("");
    }

    return lines.join("\n");
}

/**
 * Update a plan's SUMMARY.md with relationships
 *
 * @param plan - The plan to update
 */
export async function updatePlanRelationships(plan: Plan): Promise<void> {
    const doc = await readPlanDoc(plan.metadata.path, "summary", "SUMMARY.md");

    let content: string;
    if (doc) {
        content = doc.content;
    } else {
        content = `# ${plan.metadata.name}\n\n${plan.metadata.description || "Plan summary."}\n\n`;
    }

    const lines = content.split('\n');
    const filtered: string[] = [];
    let inRelatedSection = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (/^##\s+Related\s+Plans?$/i.test(line)) {
            inRelatedSection = true;
            continue;
        }
        
        if (inRelatedSection && /^#/.test(line)) {
            inRelatedSection = false;
        }
        
        if (!inRelatedSection) {
            filtered.push(line);
        }
    }
    
    content = filtered.join('\n');

    const relSection = generateRelationshipsMarkdown(plan);
    if (relSection) {
        content = content.trimEnd() + "\n\n" + relSection;
    }

    await savePlanDoc(plan.metadata.path, "summary", "SUMMARY.md", content);
}

