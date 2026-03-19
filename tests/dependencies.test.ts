/**
 * Tests for the Dependencies module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import {
    parseDependenciesFromContent,
    buildDependencyGraph,
    validateDependencies,
    findCriticalPath,
    computeExecutionOrder,
    getReadySteps,
    getDependencyChain,
} from "../src/dependencies/index.js";
import { loadPlan } from "../src/plan/loader.js";
import { createTestPlan } from "./helpers/create-test-plan.js";

describe("Dependencies Module", () => {
    describe("parseDependenciesFromContent", () => {
        it("should parse dependencies from ## Dependencies section", () => {
            const content = `# Step 03: Test Step

## Dependencies

- Step 01
- Step 02

## Tasks

Do the work.
`;
            const deps = parseDependenciesFromContent(content);
            expect(deps).toEqual([1, 2]);
        });

        it("should parse dependencies with just numbers", () => {
            const content = `# Step 03: Test Step

## Dependencies

- 1
- 2

## Tasks

Do the work.
`;
            const deps = parseDependenciesFromContent(content);
            expect(deps).toEqual([1, 2]);
        });

        it("should parse inline dependency references", () => {
            const content = `# Step 03: Test Step

This step (depends on Step 01, 02) builds on previous work.

## Tasks

Do the work.
`;
            const deps = parseDependenciesFromContent(content);
            expect(deps).toEqual([1, 2]);
        });

        it("should parse Requires: format", () => {
            const content = `# Step 03: Test Step

Requires: Step 01, Step 02

## Tasks

Do the work.
`;
            const deps = parseDependenciesFromContent(content);
            expect(deps).toEqual([1, 2]);
        });

        it("should parse frontmatter depends-on", () => {
            const content = `---
title: Test Step
depends-on: 1, 2, 3
---

# Step 04: Test Step

## Tasks

Do the work.
`;
            const deps = parseDependenciesFromContent(content);
            expect(deps).toEqual([1, 2, 3]);
        });

        it("should return empty array when no dependencies", () => {
            const content = `# Step 01: First Step

## Tasks

Do the work.
`;
            const deps = parseDependenciesFromContent(content);
            expect(deps).toEqual([]);
        });

        it("should deduplicate dependencies", () => {
            const content = `# Step 03: Test Step

## Dependencies

- Step 01
- Step 01
- Step 02

Also (depends on Step 01) mentioned again.
`;
            const deps = parseDependenciesFromContent(content);
            expect(deps).toEqual([1, 2]);
        });

        it("should sort dependencies numerically", () => {
            const content = `# Step 05: Test Step

## Dependencies

- Step 03
- Step 01
- Step 02

## Tasks

Work
`;
            const deps = parseDependenciesFromContent(content);
            expect(deps).toEqual([1, 2, 3]);
        });
    });

    describe("buildDependencyGraph", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "plan-with-deps",
                name: "Plan With Dependencies",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Tasks\n\nFirst step." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond step." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 01\n- Step 02\n\n## Tasks\n\nThird step." },
                    { number: 4, code: "step-4", title: "Step 4", content: "# Step 04: Step 4\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nFourth step." },
                    { number: 5, code: "step-5", title: "Step 5", content: "# Step 05: Step 5\n\n## Dependencies\n\n- Step 03\n- Step 04\n\n## Tasks\n\nFifth step." },
                ],
            });
        });

        afterEach(async () => {
            try { await rm(dirname(planPath), { recursive: true }); } catch {}
        });

        it("should build a correct dependency graph", async () => {
            const plan = await loadPlan(planPath);
            const graph = await buildDependencyGraph(plan);

            expect(graph.roots).toEqual([1]);
            expect(graph.leaves).toEqual([5]);
            expect(graph.hasCircular).toBe(false);
            expect(graph.circularChains).toEqual([]);

            const step1 = graph.dependencies.get(1)!;
            expect(step1.dependsOn).toEqual([]);
            expect(step1.blockedBy).toContain(2);
            expect(step1.blockedBy).toContain(3);

            const step3 = graph.dependencies.get(3)!;
            expect(step3.dependsOn).toEqual([1, 2]);
            expect(step3.blockedBy).toContain(5);

            const step5 = graph.dependencies.get(5)!;
            expect(step5.dependsOn).toEqual([3, 4]);
            expect(step5.blockedBy).toEqual([]);
        });

        it("should detect circular dependencies", async () => {
            const circularPath = await createTestPlan({
                id: "plan-circular-deps",
                name: "Plan Circular Deps",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Dependencies\n\n- Step 03\n\n## Tasks\n\nFirst." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nThird." },
                ],
            });

            const plan = await loadPlan(circularPath);
            const graph = await buildDependencyGraph(plan);

            expect(graph.hasCircular).toBe(true);
            expect(graph.circularChains.length).toBeGreaterThan(0);

            const cycle = graph.circularChains[0];
            expect(cycle).toContain(1);
            expect(cycle).toContain(2);
            expect(cycle).toContain(3);

            await rm(dirname(circularPath), { recursive: true }).catch(() => {});
        });
    });

    describe("validateDependencies", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "plan-with-deps",
                name: "Plan With Dependencies",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Tasks\n\nFirst step." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond step." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 01\n- Step 02\n\n## Tasks\n\nThird step." },
                    { number: 4, code: "step-4", title: "Step 4", content: "# Step 04: Step 4\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nFourth step." },
                    { number: 5, code: "step-5", title: "Step 5", content: "# Step 05: Step 5\n\n## Dependencies\n\n- Step 03\n- Step 04\n\n## Tasks\n\nFifth step." },
                ],
            });
        });

        afterEach(async () => {
            try { await rm(dirname(planPath), { recursive: true }); } catch {}
        });

        it("should pass validation for valid dependencies", async () => {
            const plan = await loadPlan(planPath);
            const result = await validateDependencies(plan);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it("should fail validation for circular dependencies", async () => {
            const circularPath = await createTestPlan({
                id: "plan-circular-deps",
                name: "Plan Circular Deps",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Dependencies\n\n- Step 03\n\n## Tasks\n\nFirst." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nThird." },
                ],
            });

            const plan = await loadPlan(circularPath);
            const result = await validateDependencies(plan);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.type === "circular")).toBe(true);

            await rm(dirname(circularPath), { recursive: true }).catch(() => {});
        });

        it("should detect invalid step references", async () => {
            const plan = await loadPlan(planPath);

            const deps = new Map<number, number[]>();
            deps.set(1, []);
            deps.set(2, [1, 99]);
            deps.set(3, [1, 2]);
            deps.set(4, [2]);
            deps.set(5, [3, 4]);

            const { buildDependencyGraphFromMap } = await import(
                "../src/dependencies/index.js"
            );
            const graph = buildDependencyGraphFromMap(plan, deps);
            const result = await validateDependencies(plan, graph, deps);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.type === "invalid-step")).toBe(
                true
            );
        });
    });

    describe("findCriticalPath", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "plan-with-deps",
                name: "Plan With Dependencies",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Tasks\n\nFirst step." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond step." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 01\n- Step 02\n\n## Tasks\n\nThird step." },
                    { number: 4, code: "step-4", title: "Step 4", content: "# Step 04: Step 4\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nFourth step." },
                    { number: 5, code: "step-5", title: "Step 5", content: "# Step 05: Step 5\n\n## Dependencies\n\n- Step 03\n- Step 04\n\n## Tasks\n\nFifth step." },
                ],
            });
        });

        afterEach(async () => {
            try { await rm(dirname(planPath), { recursive: true }); } catch {}
        });

        it("should find the critical path", async () => {
            const plan = await loadPlan(planPath);
            const critical = await findCriticalPath(plan);

            expect(critical.length).toBe(4);
            expect(critical.path[0]).toBe(1);
            expect(critical.path[critical.path.length - 1]).toBe(5);
        });

        it("should return empty path for circular dependencies", async () => {
            const circularPath = await createTestPlan({
                id: "plan-circular-deps",
                name: "Plan Circular Deps",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Dependencies\n\n- Step 03\n\n## Tasks\n\nFirst." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nThird." },
                ],
            });

            const plan = await loadPlan(circularPath);
            const critical = await findCriticalPath(plan);

            expect(critical.path).toEqual([]);
            expect(critical.length).toBe(0);

            await rm(dirname(circularPath), { recursive: true }).catch(() => {});
        });
    });

    describe("computeExecutionOrder", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "plan-with-deps",
                name: "Plan With Dependencies",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Tasks\n\nFirst step." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond step." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 01\n- Step 02\n\n## Tasks\n\nThird step." },
                    { number: 4, code: "step-4", title: "Step 4", content: "# Step 04: Step 4\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nFourth step." },
                    { number: 5, code: "step-5", title: "Step 5", content: "# Step 05: Step 5\n\n## Dependencies\n\n- Step 03\n- Step 04\n\n## Tasks\n\nFifth step." },
                ],
            });
        });

        afterEach(async () => {
            try { await rm(dirname(planPath), { recursive: true }); } catch {}
        });

        it("should compute valid execution order", async () => {
            const plan = await loadPlan(planPath);
            const order = await computeExecutionOrder(plan);

            expect(order.order[0]).toBe(1);
            const idx2 = order.order.indexOf(2);
            const idx3 = order.order.indexOf(3);
            const idx4 = order.order.indexOf(4);
            expect(idx2).toBeLessThan(idx3);
            expect(idx2).toBeLessThan(idx4);
            expect(order.order[order.order.length - 1]).toBe(5);
        });

        it("should identify parallel execution levels", async () => {
            const plan = await loadPlan(planPath);
            const order = await computeExecutionOrder(plan);

            expect(order.levels[0]).toEqual([1]);
            expect(order.levels[1]).toEqual([2]);
            expect(order.levels[2].sort()).toEqual([3, 4]);
            expect(order.levels[3]).toEqual([5]);
        });
    });

    describe("getReadySteps", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "plan-with-deps",
                name: "Plan With Dependencies",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Tasks\n\nFirst step." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond step." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 01\n- Step 02\n\n## Tasks\n\nThird step." },
                    { number: 4, code: "step-4", title: "Step 4", content: "# Step 04: Step 4\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nFourth step." },
                    { number: 5, code: "step-5", title: "Step 5", content: "# Step 05: Step 5\n\n## Dependencies\n\n- Step 03\n- Step 04\n\n## Tasks\n\nFifth step." },
                ],
            });
        });

        afterEach(async () => {
            try { await rm(dirname(planPath), { recursive: true }); } catch {}
        });

        it("should return steps ready to start", async () => {
            const plan = await loadPlan(planPath);

            let ready = await getReadySteps(plan);
            expect(ready.map((s) => s.number)).toEqual([1]);

            plan.steps[0].status = "completed";
            ready = await getReadySteps(plan);
            expect(ready.map((s) => s.number)).toEqual([2]);

            plan.steps[1].status = "completed";
            ready = await getReadySteps(plan);
            expect(ready.map((s) => s.number).sort()).toEqual([3, 4]);
        });

        it("should not return in-progress or blocked steps", async () => {
            const plan = await loadPlan(planPath);

            plan.steps[0].status = "completed";
            plan.steps[1].status = "in_progress";

            const ready = await getReadySteps(plan);
            expect(ready.map((s) => s.number)).toEqual([]);
        });
    });

    describe("getDependencyChain", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "plan-with-deps",
                name: "Plan With Dependencies",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Tasks\n\nFirst step." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond step." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 01\n- Step 02\n\n## Tasks\n\nThird step." },
                    { number: 4, code: "step-4", title: "Step 4", content: "# Step 04: Step 4\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nFourth step." },
                    { number: 5, code: "step-5", title: "Step 5", content: "# Step 05: Step 5\n\n## Dependencies\n\n- Step 03\n- Step 04\n\n## Tasks\n\nFifth step." },
                ],
            });
        });

        afterEach(async () => {
            try { await rm(dirname(planPath), { recursive: true }); } catch {}
        });

        it("should return all transitive dependencies", async () => {
            const plan = await loadPlan(planPath);
            const chain = await getDependencyChain(plan, 5);
            expect(chain.sort()).toEqual([1, 2, 3, 4]);
        });

        it("should return empty array for root steps", async () => {
            const plan = await loadPlan(planPath);
            const chain = await getDependencyChain(plan, 1);
            expect(chain).toEqual([]);
        });
    });

    describe("loader integration", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "plan-with-deps",
                name: "Plan With Dependencies",
                steps: [
                    { number: 1, code: "step-1", title: "Step 1", content: "# Step 01: Step 1\n\n## Tasks\n\nFirst step." },
                    { number: 2, code: "step-2", title: "Step 2", content: "# Step 02: Step 2\n\n## Dependencies\n\n- Step 01\n\n## Tasks\n\nSecond step." },
                    { number: 3, code: "step-3", title: "Step 3", content: "# Step 03: Step 3\n\n## Dependencies\n\n- Step 01\n- Step 02\n\n## Tasks\n\nThird step." },
                    { number: 4, code: "step-4", title: "Step 4", content: "# Step 04: Step 4\n\n## Dependencies\n\n- Step 02\n\n## Tasks\n\nFourth step." },
                    { number: 5, code: "step-5", title: "Step 5", content: "# Step 05: Step 5\n\n## Dependencies\n\n- Step 03\n- Step 04\n\n## Tasks\n\nFifth step." },
                ],
            });
        });

        afterEach(async () => {
            try { await rm(dirname(planPath), { recursive: true }); } catch {}
        });

        it("should populate step dependencies when loading", async () => {
            const plan = await loadPlan(planPath);

            expect(plan.steps[0].dependencies).toBeUndefined();
            expect(plan.steps[1].dependencies).toEqual([1]);
            expect(plan.steps[2].dependencies).toEqual([1, 2]);
            expect(plan.steps[3].dependencies).toEqual([2]);
            expect(plan.steps[4].dependencies).toEqual([3, 4]);
        });
    });
});
