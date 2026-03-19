/**
 * Tests for the Relationships module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join, dirname } from "node:path";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
    parseRelationshipsFromContent,
    parseRelationshipsFromPlan,
    addRelationship,
    removeRelationship,
    validateRelationships,
    getRelationshipsByType,
    getInverseRelationType,
    getBlockingPlans,
    getBlockedPlans,
    getParentPlan,
    getChildPlans,
    getRelatedPlans,
    createBidirectionalRelationship,
    generateRelationshipsMarkdown,
    updatePlanRelationships,
} from "../src/relationships/index.js";
import { loadPlan } from "../src/plan/loader.js";
import { readPlanDoc } from "../src/artifacts/operations.js";
import type { Plan, PlanRelationship } from "../src/types.js";
import { createTestPlan } from "./helpers/create-test-plan.js";

describe("Relationships Module", () => {
    describe("parseRelationshipsFromContent", () => {
        it("should parse frontmatter spawned-from", () => {
            const content = `---
title: Child Plan
spawned-from: ../parent-plan
---

# Child Plan

This plan was spawned from parent.
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toHaveLength(1);
            expect(rels[0].type).toBe("spawned-from");
            expect(rels[0].targetPath).toBe("../parent-plan");
        });

        it("should parse frontmatter blocks", () => {
            const content = `---
title: Plan A
blocks: ../plan-b, ../plan-c
---

# Plan A
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toHaveLength(2);
            expect(rels[0].type).toBe("blocks");
            expect(rels[0].targetPath).toBe("../plan-b");
            expect(rels[1].type).toBe("blocks");
            expect(rels[1].targetPath).toBe("../plan-c");
        });

        it("should parse frontmatter blocked-by", () => {
            const content = `---
blocked-by: ../blocker-plan
---

# Blocked Plan
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toHaveLength(1);
            expect(rels[0].type).toBe("blocked-by");
        });

        it("should parse frontmatter related", () => {
            const content = `---
related: ../similar-plan, ../other-plan
---

# Plan
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toHaveLength(2);
            expect(rels[0].type).toBe("related");
            expect(rels[1].type).toBe("related");
        });

        it("should parse ## Related Plans section with type:path format", () => {
            const content = `# Plan

## Related Plans

- **spawned-from**: ../parent-plan - This is the parent
- **blocks**: ../child-plan - We block this
- **related**: ../sibling-plan
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toHaveLength(3);
            expect(rels[0]).toEqual({
                type: "spawned-from",
                targetPath: "../parent-plan",
                reason: "This is the parent",
            });
            expect(rels[1]).toEqual({
                type: "blocks",
                targetPath: "../child-plan",
                reason: "We block this",
            });
            expect(rels[2]).toEqual({
                type: "related",
                targetPath: "../sibling-plan",
                reason: undefined,
            });
        });

        it("should parse markdown links in Related Plans section", () => {
            const content = `# Plan

## Related Plans

- [Parent Plan](../parent-plan) - spawned from this (spawned-from)
- [Blocked](../blocked-plan) - this plan blocks it
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toHaveLength(2);
            expect(rels[0].type).toBe("spawned-from");
            expect(rels[0].targetPath).toBe("../parent-plan");
            expect(rels[1].type).toBe("blocks");
            expect(rels[1].targetPath).toBe("../blocked-plan");
        });

        it("should parse simple path format", () => {
            const content = `# Plan

## Related Plans

- ../other-plan (related) - general relationship
- ../another-plan
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toHaveLength(2);
            expect(rels[0].type).toBe("related");
            expect(rels[1].type).toBe("related");
        });

        it("should deduplicate relationships", () => {
            const content = `---
spawned-from: ../parent
---

# Plan

## Related Plans

- **spawned-from**: ../parent
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toHaveLength(1);
        });

        it("should return empty array when no relationships", () => {
            const content = `# Simple Plan

Just a plan with no relationships.
`;
            const rels = parseRelationshipsFromContent(content);
            expect(rels).toEqual([]);
        });
    });

    describe("getInverseRelationType", () => {
        it("should return correct inverse types", () => {
            expect(getInverseRelationType("spawned-from")).toBe("spawned");
            expect(getInverseRelationType("spawned")).toBe("spawned-from");
            expect(getInverseRelationType("blocks")).toBe("blocked-by");
            expect(getInverseRelationType("blocked-by")).toBe("blocks");
            expect(getInverseRelationType("related")).toBe("related");
        });
    });

    describe("relationship management", () => {
        let sourcePlanPath: string;
        let targetPlanPath: string;
        let sourcePlan: Plan;
        let targetPlan: Plan;

        beforeEach(async () => {
            sourcePlanPath = await createTestPlan({
                id: "source-plan",
                name: "Source Plan",
                steps: [
                    { number: 1, code: "step-1", title: "First", status: "pending" },
                ],
                files: [
                    { type: "summary", filename: "SUMMARY.md", content: "# Source Plan\n\nThe source." },
                ],
            });

            targetPlanPath = await createTestPlan({
                id: "target-plan",
                name: "Target Plan",
                steps: [
                    { number: 1, code: "step-1", title: "First", status: "pending" },
                ],
                files: [
                    { type: "summary", filename: "SUMMARY.md", content: "# Target Plan\n\nThe target." },
                ],
            });

            sourcePlan = await loadPlan(sourcePlanPath);
            targetPlan = await loadPlan(targetPlanPath);
        });

        afterEach(async () => {
            try {
                await rm(dirname(sourcePlanPath), { recursive: true });
                await rm(dirname(targetPlanPath), { recursive: true });
            } catch {
                // Ignore cleanup errors
            }
        });

        it("should add a relationship", async () => {
            const result = await addRelationship(sourcePlan, {
                type: "blocks",
                targetPath: targetPlanPath,
                reason: "Source blocks target",
            });

            expect(result.relationship.type).toBe("blocks");
            expect(result.relationship.planPath).toBe(targetPlanPath);
            expect(result.relationship.reason).toBe("Source blocks target");
            expect(result.targetValid).toBe(true);
            expect(result.targetPlan?.code).toBe("target-plan");
        });

        it("should handle invalid target path", async () => {
            const result = await addRelationship(sourcePlan, {
                type: "blocks",
                targetPath: "/non-existent-plan.plan",
            });

            expect(result.targetValid).toBe(false);
            expect(result.targetPlan).toBeUndefined();
        });

        it("should remove a relationship", async () => {
            await addRelationship(sourcePlan, {
                type: "blocks",
                targetPath: targetPlanPath,
            });

            const removed = removeRelationship(sourcePlan, targetPlanPath);
            expect(removed).toHaveLength(1);
            expect(sourcePlan.relationships).toHaveLength(0);
        });

        it("should remove relationship by type", async () => {
            await addRelationship(sourcePlan, {
                type: "blocks",
                targetPath: targetPlanPath,
            });
            await addRelationship(sourcePlan, {
                type: "related",
                targetPath: targetPlanPath,
            });

            const removed = removeRelationship(
                sourcePlan,
                targetPlanPath,
                "blocks"
            );
            expect(removed).toHaveLength(1);
            expect(sourcePlan.relationships).toHaveLength(1);
            expect(sourcePlan.relationships![0].type).toBe("related");
        });

        it("should create bidirectional relationship", () => {
            createBidirectionalRelationship(
                sourcePlan,
                targetPlan,
                "blocks",
                "Test blocking"
            );

            expect(sourcePlan.relationships).toHaveLength(1);
            expect(sourcePlan.relationships![0].type).toBe("blocks");

            expect(targetPlan.relationships).toHaveLength(1);
            expect(targetPlan.relationships![0].type).toBe("blocked-by");
        });
    });

    describe("validation", () => {
        let sourcePlanPath: string;
        let targetPlanPath: string;

        beforeEach(async () => {
            sourcePlanPath = await createTestPlan({
                id: "source",
                name: "Source",
                steps: [
                    { number: 1, code: "step-1", title: "Step", status: "pending" },
                ],
                files: [
                    { type: "summary", filename: "SUMMARY.md", content: "# Source\n\nSource plan." },
                ],
            });

            targetPlanPath = await createTestPlan({
                id: "target",
                name: "Target",
                steps: [
                    { number: 1, code: "step-1", title: "Step", status: "pending" },
                ],
                files: [
                    { type: "summary", filename: "SUMMARY.md", content: "# Target\n\nTarget plan." },
                ],
            });
        });

        afterEach(async () => {
            try {
                await rm(dirname(sourcePlanPath), { recursive: true });
                await rm(dirname(targetPlanPath), { recursive: true });
            } catch {
                // Ignore cleanup errors
            }
        });

        it("should validate relationships with valid targets", async () => {
            const plan = await loadPlan(sourcePlanPath);
            await addRelationship(plan, {
                type: "related",
                targetPath: targetPlanPath,
            });

            const result = await validateRelationships(plan);
            expect(result.valid).toBe(true);
            expect(result.invalid).toHaveLength(0);
        });

        it("should detect invalid relationship targets", async () => {
            const plan = await loadPlan(sourcePlanPath);
            await addRelationship(plan, {
                type: "blocks",
                targetPath: "/non-existent.plan",
            });

            const result = await validateRelationships(plan);
            expect(result.valid).toBe(false);
            expect(result.invalid).toHaveLength(1);
            expect(result.invalid[0].reason).toContain("not found");
        });
    });

    describe("query functions", () => {
        it("should get relationships by type", () => {
            const plan: Plan = {
                metadata: { code: "test", name: "Test", path: "/test.plan" },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
                relationships: [
                    { type: "blocks", planPath: "../a", createdAt: new Date() },
                    { type: "blocks", planPath: "../b", createdAt: new Date() },
                    { type: "related", planPath: "../c", createdAt: new Date() },
                ],
            };

            const blocks = getRelationshipsByType(plan, "blocks");
            expect(blocks).toHaveLength(2);

            const related = getRelationshipsByType(plan, "related");
            expect(related).toHaveLength(1);
        });

        it("should get blocking/blocked plans", () => {
            const plan: Plan = {
                metadata: { code: "test", name: "Test", path: "/test.plan" },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
                relationships: [
                    { type: "blocked-by", planPath: "../blocker", createdAt: new Date() },
                    { type: "blocks", planPath: "../blocked", createdAt: new Date() },
                ],
            };

            expect(getBlockingPlans(plan)).toEqual(["../blocker"]);
            expect(getBlockedPlans(plan)).toEqual(["../blocked"]);
        });

        it("should get parent/child plans", () => {
            const plan: Plan = {
                metadata: { code: "test", name: "Test", path: "/test.plan" },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
                relationships: [
                    { type: "spawned-from", planPath: "../parent", createdAt: new Date() },
                    { type: "spawned", planPath: "../child1", createdAt: new Date() },
                    { type: "spawned", planPath: "../child2", createdAt: new Date() },
                ],
            };

            expect(getParentPlan(plan)).toBe("../parent");
            expect(getChildPlans(plan)).toEqual(["../child1", "../child2"]);
        });

        it("should return null for no parent", () => {
            const plan: Plan = {
                metadata: { code: "test", name: "Test", path: "/test.plan" },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
            };

            expect(getParentPlan(plan)).toBeNull();
        });

        it("should return related plans", () => {
            const plan: Plan = {
                metadata: { code: "test", name: "Test", path: "/test.plan" },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
                relationships: [
                    { type: "related", planPath: "../alpha", createdAt: new Date() },
                    { type: "blocks", planPath: "../beta", createdAt: new Date() },
                    { type: "related", planPath: "../gamma", createdAt: new Date() },
                ],
            };

            expect(getRelatedPlans(plan)).toEqual(["../alpha", "../gamma"]);
        });
    });

    describe("generateRelationshipsMarkdown", () => {
        it("should generate markdown for relationships", () => {
            const plan: Plan = {
                metadata: { code: "test", name: "Test", path: "/test.plan" },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
                relationships: [
                    {
                        type: "spawned-from",
                        planPath: "../parent",
                        reason: "This is the parent plan",
                        createdAt: new Date(),
                    },
                    {
                        type: "blocks",
                        planPath: "../other",
                        steps: [1, 2],
                        createdAt: new Date(),
                    },
                ],
            };

            const md = generateRelationshipsMarkdown(plan);
            expect(md).toContain("## Related Plans");
            expect(md).toContain("### Spawned From");
            expect(md).toContain("../parent");
            expect(md).toContain("This is the parent plan");
            expect(md).toContain("### Blocks");
            expect(md).toContain("../other");
            expect(md).toContain("Steps: 1, 2");
        });

        it("should return empty string for no relationships", () => {
            const plan: Plan = {
                metadata: { code: "test", name: "Test", path: "/test.plan" },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
            };

            expect(generateRelationshipsMarkdown(plan)).toBe("");
        });
    });

    describe("parseRelationshipsFromPlan", () => {
        it("should parse relationships from plan", async () => {
            const planPath = await createTestPlan({
                id: "valid-plan",
                name: "Valid Plan",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", status: "pending" },
                ],
                files: [
                    { type: "summary", filename: "SUMMARY.md", content: "# Valid Plan\n\nA valid plan." },
                ],
            });

            const rels = await parseRelationshipsFromPlan(planPath);
            expect(Array.isArray(rels)).toBe(true);

            await rm(dirname(planPath), { recursive: true }).catch(() => {});
        });
    });

    describe("updatePlanRelationships", () => {
        let planPath: string;

        afterEach(async () => {
            try {
                await rm(dirname(planPath), { recursive: true });
            } catch {
                // Ignore cleanup errors
            }
        });

        it("creates SUMMARY.md when missing and appends relationships", async () => {
            planPath = await createTestPlan({
                id: "no-summary-plan",
                name: "No Summary Plan",
                description: "Generated description",
                steps: [],
            });

            const plan: Plan = {
                metadata: {
                    code: "no-summary-plan",
                    name: "No Summary Plan",
                    path: planPath,
                    description: "Generated description",
                },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
                relationships: [
                    {
                        type: "related",
                        planPath: "../other-plan",
                        reason: "Shared domain",
                        createdAt: new Date(),
                    },
                ],
            };

            await updatePlanRelationships(plan);
            const doc = await readPlanDoc(planPath, "summary", "SUMMARY.md");
            expect(doc).not.toBeNull();
            expect(doc!.content).toContain("# No Summary Plan");
            expect(doc!.content).toContain("## Related Plans");
            expect(doc!.content).toContain("../other-plan");
        });

        it("replaces existing Related Plans section without touching other sections", async () => {
            planPath = await createTestPlan({
                id: "with-summary-plan",
                name: "Existing Plan",
                steps: [],
                files: [
                    {
                        type: "summary",
                        filename: "SUMMARY.md",
                        content: `# Existing Plan

Intro text.

## Related Plans

- **related**: ../old-one

## Implementation Notes

Keep this section.
`,
                    },
                ],
            });

            const plan: Plan = {
                metadata: {
                    code: "with-summary-plan",
                    name: "Existing Plan",
                    path: planPath,
                },
                files: { steps: [], subdirectories: [] },
                steps: [],
                state: {
                    status: "pending",
                    lastUpdatedAt: new Date(),
                    blockers: [],
                    issues: [],
                    progress: 0,
                },
                relationships: [
                    {
                        type: "blocks",
                        planPath: "../new-target",
                        steps: [2],
                        createdAt: new Date(),
                    },
                ],
            };

            await updatePlanRelationships(plan);
            const doc = await readPlanDoc(planPath, "summary", "SUMMARY.md");
            expect(doc).not.toBeNull();
            expect(doc!.content).not.toContain("../old-one");
            expect(doc!.content).toContain("../new-target");
            expect(doc!.content).toContain("## Implementation Notes");
        });
    });
});
