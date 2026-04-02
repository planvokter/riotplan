/**
 * Tests for Step Operations
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    loadPlan,
    insertStep,
    removeStep,
    moveStep,
    blockStep,
    unblockStep,
    completeStep,
    startStep,
    skipStep,
    failStep,
} from "../src/index.js";
import type { Plan } from "../src/index.js";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import { createTestPlan } from "./helpers/create-test-plan.js";
import { createSqliteProvider } from "@planvokter/riotplan-format";

async function getStepContents(planPath: string): Promise<Map<number, string>> {
    const provider = createSqliteProvider(planPath);
    try {
        const result = await provider.getSteps();
        const map = new Map<number, string>();
        if (result.success && result.data) {
            for (const s of result.data) {
                map.set(s.number, s.content);
            }
        }
        return map;
    } finally {
        await provider.close();
    }
}

async function getStepCodes(planPath: string): Promise<string[]> {
    const provider = createSqliteProvider(planPath);
    try {
        const result = await provider.getSteps();
        if (!result.success || !result.data) return [];
        return result.data.sort((a, b) => a.number - b.number).map(s => `${String(s.number).padStart(2, "0")}-${s.code}.md`);
    } finally {
        await provider.close();
    }
}

describe("Step Operations", () => {
    let planPath: string;
    let plan: Plan;

    beforeEach(async () => {
        planPath = await createTestPlan({
            id: "test-plan",
            name: "Test Plan",
            steps: [
                { number: 1, code: "first-step", title: "First Step", status: "pending" },
                { number: 2, code: "second-step", title: "Second Step", status: "pending" },
                { number: 3, code: "third-step", title: "Third Step", status: "pending" },
            ],
        });
        plan = await loadPlan(planPath);
    });

    afterEach(async () => {
        try {
            await rm(dirname(planPath), { recursive: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe("insertStep", () => {
        it("should insert step at beginning", async () => {
            const result = await insertStep(plan, {
                title: "New First",
                position: 1,
            });

            expect(result.step.number).toBe(1);
            expect(result.step.title).toBe("New First");
            expect(result.createdFile).toContain("01-new-first.md");

            const files = await getStepCodes(planPath);
            expect(files).toContain("01-new-first.md");
            expect(files).toContain("02-first-step.md");
            expect(files).toContain("03-second-step.md");
            expect(files).toContain("04-third-step.md");
        });

        it("should insert step in middle", async () => {
            const result = await insertStep(plan, {
                title: "New Middle",
                position: 2,
            });

            expect(result.step.number).toBe(2);
            expect(result.renamedFiles.length).toBeGreaterThan(0);

            const files = await getStepCodes(planPath);
            expect(files).toContain("01-first-step.md");
            expect(files).toContain("02-new-middle.md");
            expect(files).toContain("03-second-step.md");
            expect(files).toContain("04-third-step.md");
        });

        it("should append step when no position given", async () => {
            const result = await insertStep(plan, {
                title: "Appended Step",
            });

            expect(result.step.number).toBe(4);
            expect(result.renamedFiles.length).toBe(0);

            const files = await getStepCodes(planPath);
            expect(files).toContain("04-appended-step.md");
        });

        it("should insert after specified step", async () => {
            const result = await insertStep(plan, {
                title: "After Second",
                after: 2,
            });

            expect(result.step.number).toBe(3);

            const files = await getStepCodes(planPath);
            expect(files).toContain("03-after-second.md");
            expect(files).toContain("04-third-step.md");
        });

        it("should generate step content with description", async () => {
            const result = await insertStep(plan, {
                title: "Documented Step",
                description: "This step does important things",
                position: 1,
            });

            const contents = await getStepContents(planPath);
            const content = contents.get(1)!;
            expect(content).toContain("# Step 01: Documented Step");
            expect(content).toContain("This step does important things");
        });

        it("should set initial status", async () => {
            const result = await insertStep(plan, {
                title: "In Progress Step",
                status: "in_progress",
            });

            expect(result.step.status).toBe("in_progress");
        });

        it("should update step numbers in file content", async () => {
            await insertStep(plan, {
                title: "New First",
                position: 1,
            });

            const contents = await getStepContents(planPath);
            const content = contents.get(2)!;
            expect(content).toContain("# Step 02:");
        });

        it("should throw for invalid position", async () => {
            await expect(
                insertStep(plan, {
                    title: "Invalid",
                    position: 10,
                })
            ).rejects.toThrow("Invalid position");

            await expect(
                insertStep(plan, {
                    title: "Invalid",
                    position: 0,
                })
            ).rejects.toThrow("Invalid position");
        });

        it("should generate code from title", async () => {
            const result = await insertStep(plan, {
                title: "My Complex Step Title!",
            });

            expect(result.step.code).toBe("my-complex-step-title");
            expect(result.step.filename).toContain("my-complex-step-title.md");
        });
    });

    describe("removeStep", () => {
        it("should remove step and renumber", async () => {
            const result = await removeStep(plan, 2);

            expect(result.removedStep.title).toContain("Second Step");
            expect(result.deletedFile).toContain("02-second-step.md");

            const files = await getStepCodes(planPath);
            expect(files.length).toBe(2);
            expect(files).toContain("01-first-step.md");
            expect(files).toContain("02-third-step.md");
        });

        it("should remove first step", async () => {
            await removeStep(plan, 1);

            const files = await getStepCodes(planPath);
            expect(files.length).toBe(2);
            expect(files).toContain("01-second-step.md");
            expect(files).toContain("02-third-step.md");
        });

        it("should remove last step without renumbering", async () => {
            const result = await removeStep(plan, 3);

            expect(result.renamedFiles.length).toBe(0);

            const files = await getStepCodes(planPath);
            expect(files.length).toBe(2);
            expect(files).toContain("01-first-step.md");
            expect(files).toContain("02-second-step.md");
        });

        it("should throw for non-existent step", async () => {
            await expect(removeStep(plan, 99)).rejects.toThrow(
                "Step 99 not found"
            );
        });

        it("should update step numbers in remaining files", async () => {
            await removeStep(plan, 1);

            const contents = await getStepContents(planPath);
            const content = contents.get(1)!;
            expect(content).toContain("# Step 01:");
        });
    });

    describe("moveStep", () => {
        it("should move step down", async () => {
            const result = await moveStep(plan, 1, 3);

            expect(result.newPosition).toBe(3);
            expect(result.step.number).toBe(3);

            const reloaded = await loadPlan(planPath);
            expect(reloaded.steps[0].title).toContain("Second Step");
            expect(reloaded.steps[1].title).toContain("Third Step");
            expect(reloaded.steps[2].title).toContain("First Step");
        });

        it("should move step up", async () => {
            const result = await moveStep(plan, 3, 1);

            expect(result.newPosition).toBe(1);

            const reloaded = await loadPlan(planPath);
            expect(reloaded.steps[0].title).toContain("Third Step");
            expect(reloaded.steps[1].title).toContain("First Step");
            expect(reloaded.steps[2].title).toContain("Second Step");
        });

        it("should throw for same source and destination", async () => {
            await expect(moveStep(plan, 2, 2)).rejects.toThrow(
                "Source and destination are the same"
            );
        });

        it("should throw for non-existent step", async () => {
            await expect(moveStep(plan, 99, 1)).rejects.toThrow(
                "Step 99 not found"
            );
        });

        it("should throw for invalid destination", async () => {
            await expect(moveStep(plan, 1, 10)).rejects.toThrow(
                "Invalid destination"
            );
            await expect(moveStep(plan, 1, 0)).rejects.toThrow(
                "Invalid destination"
            );
        });

        it("should update step numbers in file content", async () => {
            await moveStep(plan, 1, 3);

            const contents = await getStepContents(planPath);
            const content = contents.get(3)!;
            expect(content).toContain("# Step 03:");
        });

        it("should return renamed files", async () => {
            const result = await moveStep(plan, 1, 3);

            expect(result.renamedFiles.length).toBeGreaterThan(0);
        });
    });

    describe("blockStep", () => {
        it("should block step with reason", () => {
            const blocked = blockStep(plan, 2, "Waiting on external API");

            expect(blocked.status).toBe("blocked");
            expect(blocked.notes).toBe("Waiting on external API");
            expect(blocked.number).toBe(2);
        });

        it("should throw for non-existent step", () => {
            expect(() => blockStep(plan, 99, "reason")).toThrow(
                "Step 99 not found"
            );
        });

        it("should not modify original plan", () => {
            const originalStatus = plan.steps[1].status;
            blockStep(plan, 2, "reason");
            expect(plan.steps[1].status).toBe(originalStatus);
        });
    });

    describe("unblockStep", () => {
        it("should unblock step", () => {
            const blocked = blockStep(plan, 2, "reason");
            const blockedPlan = {
                ...plan,
                steps: plan.steps.map((s) =>
                    s.number === 2 ? blocked : s
                ),
            };

            const unblocked = unblockStep(blockedPlan, 2);

            expect(unblocked.status).toBe("pending");
            expect(unblocked.notes).toBeUndefined();
        });

        it("should throw for non-existent step", () => {
            expect(() => unblockStep(plan, 99)).toThrow("Step 99 not found");
        });
    });

    describe("completeStep", () => {
        it("should complete step", async () => {
            const completed = await completeStep(plan, 1);

            expect(completed.status).toBe("completed");
            expect(completed.completedAt).toBeInstanceOf(Date);
        });

        it("should complete step with notes", async () => {
            const completed = await completeStep(plan, 1, { notes: "Finished early" });

            expect(completed.notes).toBe("Finished early");
        });

        it("should throw for non-existent step", async () => {
            await expect(completeStep(plan, 99)).rejects.toThrow("Step 99 not found");
        });
    });

    describe("startStep", () => {
        it("should start step", () => {
            const started = startStep(plan, 1);

            expect(started.status).toBe("in_progress");
            expect(started.startedAt).toBeInstanceOf(Date);
        });

        it("should throw for non-existent step", () => {
            expect(() => startStep(plan, 99)).toThrow("Step 99 not found");
        });
    });

    describe("skipStep", () => {
        it("should skip step", () => {
            const skipped = skipStep(plan, 2);

            expect(skipped.status).toBe("skipped");
        });

        it("should skip step with reason", () => {
            const skipped = skipStep(plan, 2, "Not needed");

            expect(skipped.status).toBe("skipped");
            expect(skipped.notes).toBe("Not needed");
        });

        it("should throw for non-existent step", () => {
            expect(() => skipStep(plan, 99)).toThrow("Step 99 not found");
        });
    });

    describe("failStep", () => {
        it("should fail step", () => {
            const failed = failStep(plan, 1);

            expect(failed.status).toBe("failed");
        });

        it("should fail step with reason", () => {
            const failed = failStep(plan, 1, "Tests did not pass");

            expect(failed.status).toBe("failed");
            expect(failed.notes).toBe("Tests did not pass");
        });

        it("should throw for non-existent step", () => {
            expect(() => failStep(plan, 99)).toThrow("Step 99 not found");
        });
    });

    describe("complex operations", () => {
        it("should handle multiple inserts", async () => {
            await insertStep(plan, { title: "Insert 1", position: 1 });
            const reloaded1 = await loadPlan(planPath);

            await insertStep(reloaded1, { title: "Insert 2", position: 3 });
            const reloaded2 = await loadPlan(planPath);

            expect(reloaded2.steps.length).toBe(5);
            expect(reloaded2.steps[0].title).toContain("Insert 1");
            expect(reloaded2.steps[2].title).toContain("Insert 2");
        });

        it("should handle insert then remove", async () => {
            await insertStep(plan, { title: "Temporary", position: 2 });
            const reloaded1 = await loadPlan(planPath);

            await removeStep(reloaded1, 2);
            const reloaded2 = await loadPlan(planPath);

            expect(reloaded2.steps.length).toBe(3);
            expect(reloaded2.steps[0].title).toContain("First Step");
            expect(reloaded2.steps[1].title).toContain("Second Step");
            expect(reloaded2.steps[2].title).toContain("Third Step");
        });

        it("should handle move then insert", async () => {
            await moveStep(plan, 1, 3);
            const reloaded1 = await loadPlan(planPath);

            await insertStep(reloaded1, { title: "New First", position: 1 });
            const reloaded2 = await loadPlan(planPath);

            expect(reloaded2.steps.length).toBe(4);
            expect(reloaded2.steps[0].title).toContain("New First");
        });
    });

    describe("plan completion detection", () => {
        it("should detect when all steps are completed", async () => {
            const step1 = await completeStep(plan, 1);
            const step2 = await completeStep(plan, 2);
            const step3 = await completeStep(plan, 3);

            const completedPlan = {
                ...plan,
                steps: [step1, step2, step3]
            };

            const allCompleted = completedPlan.steps.every(
                s => s.status === 'completed' || s.status === 'skipped'
            );

            expect(allCompleted).toBe(true);
        });

        it("should not detect completion when steps are pending", async () => {
            const step1 = await completeStep(plan, 1);
            const step2 = await completeStep(plan, 2);

            const partialPlan = {
                ...plan,
                steps: [step1, step2, plan.steps[2]]
            };

            const allCompleted = partialPlan.steps.every(
                s => s.status === 'completed' || s.status === 'skipped'
            );

            expect(allCompleted).toBe(false);
        });

        it("should detect completion with mix of completed and skipped steps", async () => {
            const step1 = await completeStep(plan, 1);
            const step2 = await completeStep(plan, 2);
            const step3 = skipStep(plan, 3, "Not needed");

            const mixedPlan = {
                ...plan,
                steps: [step1, step2, step3]
            };

            const allCompleted = mixedPlan.steps.every(
                s => s.status === 'completed' || s.status === 'skipped'
            );

            expect(allCompleted).toBe(true);
        });

        it("should not detect completion when a step is blocked", async () => {
            const step1 = await completeStep(plan, 1);
            const step2 = await completeStep(plan, 2);
            const step3 = blockStep(plan, 3, "Waiting on dependency");

            const blockedPlan = {
                ...plan,
                steps: [step1, step2, step3]
            };

            const allCompleted = blockedPlan.steps.every(
                s => s.status === 'completed' || s.status === 'skipped'
            );

            expect(allCompleted).toBe(false);
        });

        it("should not detect completion when a step has failed", async () => {
            const step1 = await completeStep(plan, 1);
            const step2 = await completeStep(plan, 2);
            const step3 = failStep(plan, 3, "Tests failed");

            const failedPlan = {
                ...plan,
                steps: [step1, step2, step3]
            };

            const allCompleted = failedPlan.steps.every(
                s => s.status === 'completed' || s.status === 'skipped'
            );

            expect(allCompleted).toBe(false);
        });
    });
});
