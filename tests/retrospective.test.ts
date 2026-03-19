/**
 * Tests for retrospective generation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import type { Plan } from "../src/types.js";
import {
    generateRetrospective,
    generateRetrospectiveMarkdown,
    createRetrospective,
} from "../src/retrospective/index.js";
import { readPlanDoc } from "../src/artifacts/operations.js";
import { createTestPlan } from "./helpers/create-test-plan.js";

const createMockPlan = (overrides?: Partial<Plan>): Plan => ({
    metadata: {
        code: "test-plan",
        name: "Test Plan",
        path: "/test/plan",
    },
    files: {
        steps: [],
        subdirectories: [],
    },
    steps: [
        {
            number: 1,
            code: "setup",
            filename: "01-setup.md",
            title: "Setup",
            status: "completed",
            filePath: "/test/plan/01-setup.md",
            completedAt: new Date("2026-01-14"),
        },
        {
            number: 2,
            code: "implement",
            filename: "02-implement.md",
            title: "Implementation",
            status: "completed",
            filePath: "/test/plan/02-implement.md",
            completedAt: new Date("2026-01-14"),
        },
        {
            number: 3,
            code: "test",
            filename: "03-test.md",
            title: "Testing",
            status: "skipped",
            filePath: "/test/plan/03-test.md",
        },
    ],
    state: {
        status: "completed",
        progress: 100,
        startedAt: new Date("2026-01-14T09:00:00Z"),
        completedAt: new Date("2026-01-14T17:00:00Z"),
        lastUpdatedAt: new Date("2026-01-14"),
        blockers: [],
        issues: [],
    },
    ...overrides,
});

describe("retrospective", () => {
    describe("generateRetrospective", () => {
        it("should generate retrospective from plan", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan);

            expect(retro.planName).toBe("Test Plan");
            expect(retro.planCode).toBe("test-plan");
            expect(retro.totalSteps).toBe(3);
            expect(retro.completedSteps).toBe(2);
            expect(retro.skippedSteps).toBe(1);
        });

        it("should calculate duration", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan);

            expect(retro.duration).toBe(8 * 60 * 60 * 1000);
        });

        it("should auto-generate what went well", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan);

            expect(retro.whatWentWell.length).toBeGreaterThan(0);
            expect(retro.whatWentWell).toContain("No blockers encountered");
        });

        it("should auto-generate what could improve", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan);

            expect(retro.whatCouldImprove.length).toBeGreaterThan(0);
            expect(retro.whatCouldImprove[0]).toContain("skipped");
        });

        it("should use custom options", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan, {
                whatWentWell: ["Custom success"],
                keyLearnings: ["We learned something"],
                actionItems: ["Do this next"],
            });

            expect(retro.whatWentWell).toEqual(["Custom success"]);
            expect(retro.keyLearnings).toEqual(["We learned something"]);
            expect(retro.actionItems).toEqual(["Do this next"]);
        });

        it("should include steps summary", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan);

            expect(retro.stepsSummary.length).toBe(3);
            expect(retro.stepsSummary[0].title).toBe("Setup");
            expect(retro.stepsSummary[0].status).toBe("completed");
        });

        it("should note feedback integration", () => {
            const plan = createMockPlan({
                feedback: [
                    {
                        id: "fb-001",
                        title: "Good feedback",
                        platform: "slack",
                        createdAt: new Date(),
                        participants: [],
                    },
                ],
            });

            const retro = generateRetrospective(plan);

            expect(retro.whatWentWell.some((w) => w.includes("feedback"))).toBe(
                true
            );
        });

        it("should note 100% completion rate", () => {
            const plan = createMockPlan({
                steps: [
                    {
                        number: 1,
                        code: "step1",
                        filename: "01-step1.md",
                        title: "Step 1",
                        status: "completed",
                        filePath: "/test/plan/01-step1.md",
                    },
                    {
                        number: 2,
                        code: "step2",
                        filename: "02-step2.md",
                        title: "Step 2",
                        status: "completed",
                        filePath: "/test/plan/02-step2.md",
                    },
                ],
            });

            const retro = generateRetrospective(plan);

            expect(retro.whatWentWell.some((w) => w.includes("All steps completed"))).toBe(true);
        });

        it("should note high completion rate (90-99%)", () => {
            const steps = Array.from({ length: 10 }, (_, i) => ({
                number: i + 1,
                code: `step${i + 1}`,
                filename: `${String(i + 1).padStart(2, '0')}-step${i + 1}.md`,
                title: `Step ${i + 1}`,
                status: i < 9 ? "completed" : "pending",
                filePath: `/test/plan/${String(i + 1).padStart(2, '0')}-step${i + 1}.md`,
            }));

            const plan = createMockPlan({ steps });
            const retro = generateRetrospective(plan);

            expect(retro.whatWentWell.some((w) => w.includes("High completion rate"))).toBe(true);
        });

        it("should note blockers in what could improve", () => {
            const plan = createMockPlan({
                state: {
                    status: "completed",
                    progress: 100,
                    startedAt: new Date("2026-01-14T09:00:00Z"),
                    completedAt: new Date("2026-01-14T17:00:00Z"),
                    lastUpdatedAt: new Date("2026-01-14"),
                    blockers: [
                        {
                            description: "API rate limit",
                            stepNumber: 2,
                            createdAt: new Date(),
                        },
                    ],
                    issues: [],
                },
            });

            const retro = generateRetrospective(plan);

            expect(retro.whatCouldImprove.some((w) => w.includes("blockers"))).toBe(true);
        });

        it("should note issues in what could improve", () => {
            const plan = createMockPlan({
                state: {
                    status: "completed",
                    progress: 100,
                    startedAt: new Date("2026-01-14T09:00:00Z"),
                    completedAt: new Date("2026-01-14T17:00:00Z"),
                    lastUpdatedAt: new Date("2026-01-14"),
                    blockers: [],
                    issues: [
                        {
                            description: "Test failure",
                            severity: "high",
                            createdAt: new Date(),
                        },
                    ],
                },
            });

            const retro = generateRetrospective(plan);

            expect(retro.whatCouldImprove.some((w) => w.includes("issues"))).toBe(true);
        });
    });

    describe("generateRetrospectiveMarkdown", () => {
        it("should generate valid markdown", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan);
            const md = generateRetrospectiveMarkdown(retro);

            expect(md).toContain("# Retrospective: Test Plan");
            expect(md).toContain("**Plan Code:** test-plan");
            expect(md).toContain("## Summary");
            expect(md).toContain("## What Went Well");
            expect(md).toContain("## What Could Improve");
            expect(md).toContain("## Key Learnings");
            expect(md).toContain("## Action Items");
            expect(md).toContain("## Steps Summary");
        });

        it("should include summary table", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan);
            const md = generateRetrospectiveMarkdown(retro);

            expect(md).toContain("| Total Steps | 3 |");
            expect(md).toContain("| Completed | 2 |");
            expect(md).toContain("| Skipped | 1 |");
        });

        it("should include step status emojis", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan);
            const md = generateRetrospectiveMarkdown(retro);

            expect(md).toContain("✅");
            expect(md).toContain("⏭️");
        });

        it("should show placeholder for empty sections", () => {
            const plan = createMockPlan();
            const retro = generateRetrospective(plan, {
                keyLearnings: [],
                actionItems: [],
            });
            const md = generateRetrospectiveMarkdown(retro);

            expect(md).toContain("*What did you learn?");
            expect(md).toContain("*Any follow-up tasks?");
        });
    });

    describe("createRetrospective", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "retro-test",
                name: "Test Plan",
                steps: [],
            });
        });

        afterEach(async () => {
            try {
                await rm(dirname(planPath), { recursive: true, force: true });
            } catch {}
        });

        it("should create RETROSPECTIVE.md in SQLite", async () => {
            const plan = createMockPlan({
                metadata: {
                    code: "test-plan",
                    name: "Test Plan",
                    path: planPath,
                },
            });

            const result = await createRetrospective(plan);

            expect(result).toBe("RETROSPECTIVE.md");

            const doc = await readPlanDoc(planPath, "other", "RETROSPECTIVE.md");
            expect(doc).not.toBeNull();
            expect(doc!.content).toContain("# Retrospective: Test Plan");
        });
    });
});
