/**
 * Tests for STATUS.md Generator
 */

import { describe, it, expect } from "vitest";
import { generateStatus, updateStatus, parseStatus } from "../src/index.js";
import type { Plan, PlanStep, PlanPhase, PlanState, PlanMetadata, PlanFiles } from "../src/index.js";

// Helper to create a minimal plan for testing
function createTestPlan(overrides: Partial<Plan> = {}): Plan {
    const defaultSteps: PlanStep[] = [
        {
            number: 1,
            code: "setup",
            filename: "01-setup.md",
            title: "Setup",
            status: "completed",
            filePath: "/test/plan/01-setup.md",
            startedAt: new Date("2026-01-10"),
            completedAt: new Date("2026-01-10"),
        },
        {
            number: 2,
            code: "foundation",
            filename: "02-foundation.md",
            title: "Foundation",
            status: "completed",
            filePath: "/test/plan/02-foundation.md",
            startedAt: new Date("2026-01-11"),
            completedAt: new Date("2026-01-12"),
        },
        {
            number: 3,
            code: "core",
            filename: "03-core.md",
            title: "Core Implementation",
            status: "in_progress",
            filePath: "/test/plan/03-core.md",
            startedAt: new Date("2026-01-13"),
        },
        {
            number: 4,
            code: "testing",
            filename: "04-testing.md",
            title: "Testing",
            status: "pending",
            filePath: "/test/plan/04-testing.md",
        },
    ];

    const defaultState: PlanState = {
        status: "in_progress",
        currentStep: 3,
        lastCompletedStep: 2,
        progress: 50,
        blockers: [],
        issues: [],
        startedAt: new Date("2026-01-10"),
        lastUpdatedAt: new Date("2026-01-14"),
    };

    const defaultMetadata: PlanMetadata = {
        name: "Test Plan",
        description: "A test plan for unit testing",
        code: "test-plan",
        path: "/test",
    };

    const defaultFiles: PlanFiles = {
        root: "/test",
        summary: "/test/SUMMARY.md",
        executionPlan: "/test/EXECUTION_PLAN.md",
        status: "/test/STATUS.md",
        planDir: "/test/plan",
        stepFiles: [
            "/test/plan/01-setup.md",
            "/test/plan/02-foundation.md",
            "/test/plan/03-core.md",
            "/test/plan/04-testing.md",
        ],
    };

    return {
        metadata: defaultMetadata,
        files: defaultFiles,
        steps: defaultSteps,
        state: defaultState,
        ...overrides,
    };
}

describe("generateStatus", () => {
    describe("basic generation", () => {
        it("should generate valid STATUS.md", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("# Test Plan Status");
            expect(status).toContain("## Current State");
            expect(status).toContain("## Step Progress");
            expect(status).toContain("## Blockers");
            expect(status).toContain("## Issues");
            expect(status).toContain("## Notes");
        });

        it("should include status legend", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("**Status Legend**");
            expect(status).toContain("⬜ Pending");
            expect(status).toContain("🔄 In Progress");
            expect(status).toContain("✅ Completed");
        });

        it("should include last updated timestamp", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("*Last updated:");
        });
    });

    describe("current state section", () => {
        it("should display current status", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("🔄 IN PROGRESS");
        });

        it("should display current step", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("03 - Core Implementation");
        });

        it("should display last completed step", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("02 - Foundation");
        });

        it("should display progress percentage", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("50%");
            expect(status).toContain("2/4 steps");
        });

        it("should handle no current step", async () => {
            const plan = createTestPlan({
                state: {
                    status: "pending",
                    progress: 0,
                    blockers: [],
                    issues: [],
                },
            });
            const status = await generateStatus(plan);

            expect(status).toContain("| **Current Step** | - |");
        });
    });

    describe("step progress section", () => {
        it("should list all steps", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("| 01 | Setup |");
            expect(status).toContain("| 02 | Foundation |");
            expect(status).toContain("| 03 | Core Implementation |");
            expect(status).toContain("| 04 | Testing |");
        });

        it("should show step statuses with emojis", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            // Completed steps
            expect(status).toMatch(/\| 01 \| Setup \| ✅/);
            // In progress step
            expect(status).toMatch(/\| 03 \| Core Implementation \| 🔄/);
            // Pending step
            expect(status).toMatch(/\| 04 \| Testing \| ⬜/);
        });

        it("should show step dates", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("2026-01-10");
            expect(status).toContain("2026-01-12");
        });

        it("should show step notes", async () => {
            const plan = createTestPlan({
                steps: [
                    {
                        number: 1,
                        code: "setup",
                        filename: "01-setup.md",
                        title: "Setup",
                        status: "completed",
                        filePath: "/test/plan/01-setup.md",
                        notes: "Completed early",
                    },
                ],
            });
            const status = await generateStatus(plan);

            expect(status).toContain("Completed early");
        });
    });

    describe("phase progress section", () => {
        it("should include phase progress when phases defined", async () => {
            const phases: PlanPhase[] = [
                {
                    name: "Phase 1: Foundation",
                    steps: [1, 2],
                    status: "completed",
                },
                {
                    name: "Phase 2: Implementation",
                    steps: [3, 4],
                    status: "in_progress",
                },
            ];

            const plan = createTestPlan({ phases });
            const status = await generateStatus(plan);

            expect(status).toContain("## Phase Progress");
            expect(status).toContain("Phase 1: Foundation");
            expect(status).toContain("Phase 2: Implementation");
        });

        it("should show phase step ranges", async () => {
            const phases: PlanPhase[] = [
                {
                    name: "Phase 1",
                    steps: [1, 2],
                    status: "completed",
                },
            ];

            const plan = createTestPlan({ phases });
            const status = await generateStatus(plan);

            expect(status).toContain("01-02");
        });

        it("should not include phases when none defined", async () => {
            const plan = createTestPlan({ phases: undefined });
            const status = await generateStatus(plan);

            expect(status).not.toContain("## Phase Progress");
        });

        it("should respect includePhases option", async () => {
            const phases: PlanPhase[] = [
                { name: "Phase 1", steps: [1, 2], status: "completed" },
            ];

            const plan = createTestPlan({ phases });
            const status = await generateStatus(plan, { includePhases: false });

            expect(status).not.toContain("## Phase Progress");
        });
    });

    describe("blockers section", () => {
        it("should show 'None currently' when no blockers", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("## Blockers");
            expect(status).toContain("None currently.");
        });

        it("should list blockers", async () => {
            const plan = createTestPlan({
                state: {
                    status: "blocked",
                    progress: 50,
                    blockers: [
                        {
                            id: "blocker-1",
                            description: "Waiting on external API",
                            severity: "high",
                            affectedSteps: [3, 4],
                            createdAt: new Date(),
                        },
                    ],
                    issues: [],
                },
            });
            const status = await generateStatus(plan);

            expect(status).toContain("Waiting on external API");
            expect(status).toContain("affects steps: 3, 4");
        });
    });

    describe("issues section", () => {
        it("should show 'None currently' when no issues", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toContain("## Issues");
            expect(status).toContain("None currently.");
        });

        it("should list issues", async () => {
            const plan = createTestPlan({
                state: {
                    status: "in_progress",
                    progress: 50,
                    blockers: [],
                    issues: [
                        {
                            id: "issue-1",
                            title: "Performance",
                            description: "Tests running slowly",
                            severity: "low",
                            createdAt: new Date(),
                        },
                    ],
                },
            });
            const status = await generateStatus(plan);

            expect(status).toContain("**Performance**");
            expect(status).toContain("Tests running slowly");
        });
    });

    describe("notes preservation", () => {
        it("should preserve existing notes", async () => {
            const plan = createTestPlan();
            const existingContent = `# Old Status

## Notes

- Important note 1
- Important note 2

---
`;
            const status = await generateStatus(plan, {
                preserveNotes: true,
                existingContent,
            });

            expect(status).toContain("Important note 1");
            expect(status).toContain("Important note 2");
        });

        it("should not preserve notes when disabled", async () => {
            const plan = createTestPlan();
            const existingContent = `# Old Status

## Notes

- Important note

---
`;
            const status = await generateStatus(plan, {
                preserveNotes: false,
                existingContent,
            });

            expect(status).not.toContain("Important note");
        });
    });

    describe("date formatting", () => {
        it("should use short format by default", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan);

            expect(status).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        it("should support iso format", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan, { dateFormat: "iso" });

            expect(status).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        it("should support long format", async () => {
            const plan = createTestPlan();
            const status = await generateStatus(plan, { dateFormat: "long" });

            expect(status).toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/);
        });
    });

    describe("progress calculation", () => {
        it("should calculate 0% for no completed steps", async () => {
            const plan = createTestPlan({
                steps: [
                    { number: 1, code: "a", filename: "01-a.md", title: "A", status: "pending", filePath: "" },
                    { number: 2, code: "b", filename: "02-b.md", title: "B", status: "pending", filePath: "" },
                ],
            });
            const status = await generateStatus(plan);

            expect(status).toContain("0%");
            expect(status).toContain("0/2 steps");
        });

        it("should calculate 100% for all completed steps", async () => {
            const plan = createTestPlan({
                steps: [
                    { number: 1, code: "a", filename: "01-a.md", title: "A", status: "completed", filePath: "" },
                    { number: 2, code: "b", filename: "02-b.md", title: "B", status: "completed", filePath: "" },
                ],
            });
            const status = await generateStatus(plan);

            expect(status).toContain("100%");
            expect(status).toContain("2/2 steps");
        });

        it("should handle empty steps array", async () => {
            const plan = createTestPlan({ steps: [] });
            const status = await generateStatus(plan);

            expect(status).toContain("0%");
            expect(status).toContain("0/0 steps");
        });
    });

    describe("roundtrip consistency", () => {
        it("should produce parseable output", async () => {
            const plan = createTestPlan();
            const generated = await generateStatus(plan);
            const parsed = parseStatus(generated);

            expect(parsed.document.currentState.status).toBe("in_progress");
            expect(parsed.document.stepProgress.length).toBe(4);
        });

        it("should preserve step statuses through roundtrip", async () => {
            const plan = createTestPlan();
            const generated = await generateStatus(plan);
            const parsed = parseStatus(generated);

            expect(parsed.document.stepProgress[0].status).toBe("completed");
            expect(parsed.document.stepProgress[2].status).toBe("in_progress");
            expect(parsed.document.stepProgress[3].status).toBe("pending");
        });
    });
});

describe("updateStatus", () => {
    describe("step status updates", () => {
        it("should update step status to in_progress", () => {
            const plan = createTestPlan();
            const updated = updateStatus(plan, {
                step: 4,
                stepStatus: "in_progress",
            });

            expect(updated.steps[3].status).toBe("in_progress");
            expect(updated.steps[3].startedAt).toBeDefined();
        });

        it("should update step status to completed", () => {
            const plan = createTestPlan();
            const updated = updateStatus(plan, {
                step: 3,
                stepStatus: "completed",
            });

            expect(updated.steps[2].status).toBe("completed");
            expect(updated.steps[2].completedAt).toBeDefined();
        });

        it("should update current step when starting", () => {
            const plan = createTestPlan();
            const updated = updateStatus(plan, {
                step: 4,
                stepStatus: "in_progress",
            });

            expect(updated.state.currentStep).toBe(4);
        });

        it("should update last completed step", () => {
            const plan = createTestPlan();
            const updated = updateStatus(plan, {
                step: 3,
                stepStatus: "completed",
            });

            expect(updated.state.lastCompletedStep).toBe(3);
        });

        it("should start plan when first step starts", () => {
            const plan = createTestPlan({
                state: {
                    status: "pending",
                    progress: 0,
                    blockers: [],
                    issues: [],
                },
            });
            const updated = updateStatus(plan, {
                step: 1,
                stepStatus: "in_progress",
            });

            expect(updated.state.status).toBe("in_progress");
            expect(updated.state.startedAt).toBeDefined();
        });

        it("should complete plan when all steps complete", () => {
            const plan = createTestPlan({
                steps: [
                    { number: 1, code: "a", filename: "01-a.md", title: "A", status: "completed", filePath: "" },
                    { number: 2, code: "b", filename: "02-b.md", title: "B", status: "in_progress", filePath: "" },
                ],
                state: {
                    status: "in_progress",
                    progress: 50,
                    blockers: [],
                    issues: [],
                },
            });
            const updated = updateStatus(plan, {
                step: 2,
                stepStatus: "completed",
            });

            expect(updated.state.status).toBe("completed");
            expect(updated.state.completedAt).toBeDefined();
        });

        it("should handle skipped steps in completion check", () => {
            const plan = createTestPlan({
                steps: [
                    { number: 1, code: "a", filename: "01-a.md", title: "A", status: "completed", filePath: "" },
                    { number: 2, code: "b", filename: "02-b.md", title: "B", status: "skipped", filePath: "" },
                    { number: 3, code: "c", filename: "03-c.md", title: "C", status: "in_progress", filePath: "" },
                ],
                state: {
                    status: "in_progress",
                    progress: 33,
                    blockers: [],
                    issues: [],
                },
            });
            const updated = updateStatus(plan, {
                step: 3,
                stepStatus: "completed",
            });

            expect(updated.state.status).toBe("completed");
        });

        it("should not modify original plan", () => {
            const plan = createTestPlan();
            const originalStatus = plan.steps[3].status;

            updateStatus(plan, {
                step: 4,
                stepStatus: "in_progress",
            });

            expect(plan.steps[3].status).toBe(originalStatus);
        });
    });

    describe("blocker management", () => {
        it("should add blocker", () => {
            const plan = createTestPlan();
            const updated = updateStatus(plan, {
                addBlocker: "Waiting on external dependency",
            });

            expect(updated.state.blockers.length).toBe(1);
            expect(updated.state.blockers[0].description).toBe("Waiting on external dependency");
        });

        it("should remove blocker by description match", () => {
            const plan = createTestPlan({
                state: {
                    status: "blocked",
                    progress: 50,
                    blockers: [
                        {
                            id: "blocker-1",
                            description: "Waiting on API",
                            severity: "high",
                            affectedSteps: [],
                            createdAt: new Date(),
                        },
                    ],
                    issues: [],
                },
            });
            const updated = updateStatus(plan, {
                removeBlocker: "API",
            });

            expect(updated.state.blockers.length).toBe(0);
        });

        it("should not remove non-matching blockers", () => {
            const plan = createTestPlan({
                state: {
                    status: "blocked",
                    progress: 50,
                    blockers: [
                        {
                            id: "blocker-1",
                            description: "Waiting on API",
                            severity: "high",
                            affectedSteps: [],
                            createdAt: new Date(),
                        },
                    ],
                    issues: [],
                },
            });
            const updated = updateStatus(plan, {
                removeBlocker: "database",
            });

            expect(updated.state.blockers.length).toBe(1);
        });
    });

    describe("issue management", () => {
        it("should add issue", () => {
            const plan = createTestPlan();
            const updated = updateStatus(plan, {
                addIssue: {
                    title: "Performance",
                    description: "Tests are slow",
                },
            });

            expect(updated.state.issues.length).toBe(1);
            expect(updated.state.issues[0].title).toBe("Performance");
            expect(updated.state.issues[0].description).toBe("Tests are slow");
        });
    });

    describe("progress calculation", () => {
        it("should recalculate progress after update", () => {
            const plan = createTestPlan({
                steps: [
                    { number: 1, code: "a", filename: "01-a.md", title: "A", status: "completed", filePath: "" },
                    { number: 2, code: "b", filename: "02-b.md", title: "B", status: "pending", filePath: "" },
                    { number: 3, code: "c", filename: "03-c.md", title: "C", status: "pending", filePath: "" },
                    { number: 4, code: "d", filename: "04-d.md", title: "D", status: "pending", filePath: "" },
                ],
                state: {
                    status: "in_progress",
                    progress: 25,
                    blockers: [],
                    issues: [],
                },
            });
            const updated = updateStatus(plan, {
                step: 2,
                stepStatus: "completed",
            });

            expect(updated.state.progress).toBe(50);
        });
    });

    describe("timestamp updates", () => {
        it("should update lastUpdatedAt", () => {
            const plan = createTestPlan();
            const before = new Date();

            const updated = updateStatus(plan, {
                step: 4,
                stepStatus: "in_progress",
            });

            expect(updated.state.lastUpdatedAt).toBeDefined();
            expect(updated.state.lastUpdatedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
        });
    });

    describe("edge cases", () => {
        it("should handle non-existent step", () => {
            const plan = createTestPlan();
            const updated = updateStatus(plan, {
                step: 99,
                stepStatus: "completed",
            });

            // Should not throw, just not update anything
            expect(updated.steps.length).toBe(plan.steps.length);
        });

        it("should handle empty updates", () => {
            const plan = createTestPlan();
            const updated = updateStatus(plan, {});

            // Should still update timestamp
            expect(updated.state.lastUpdatedAt).toBeDefined();
        });
    });
});

