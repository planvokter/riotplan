/**
 * Tests for Step Operations
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    createPlan,
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
import { rm, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Step Operations", () => {
    let testDir: string;
    let planPath: string;
    let plan: Plan;

    beforeEach(async () => {
        testDir = join(tmpdir(), `riotplan-steps-test-${Date.now()}`);
        const result = await createPlan({
            code: "test-plan",
            name: "Test Plan",
            basePath: testDir,
            steps: [
                { title: "First Step" },
                { title: "Second Step" },
                { title: "Third Step" },
            ],
        });
        planPath = result.path;
        plan = await loadPlan(planPath);
    });

    afterEach(async () => {
        try {
            await rm(testDir, { recursive: true });
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

            // Verify files
            const planDir = join(planPath, "plan");
            const files = await readdir(planDir);
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

            const planDir = join(planPath, "plan");
            const files = await readdir(planDir);
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

            const planDir = join(planPath, "plan");
            const files = await readdir(planDir);
            expect(files).toContain("04-appended-step.md");
        });

        it("should insert after specified step", async () => {
            const result = await insertStep(plan, {
                title: "After Second",
                after: 2,
            });

            expect(result.step.number).toBe(3);

            const planDir = join(planPath, "plan");
            const files = await readdir(planDir);
            expect(files).toContain("03-after-second.md");
            expect(files).toContain("04-third-step.md");
        });

        it("should generate step content with description", async () => {
            const result = await insertStep(plan, {
                title: "Documented Step",
                description: "This step does important things",
                position: 1,
            });

            const content = await readFile(result.createdFile, "utf-8");
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

            const planDir = join(planPath, "plan");
            const content = await readFile(
                join(planDir, "02-first-step.md"),
                "utf-8"
            );
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

            const planDir = join(planPath, "plan");
            const files = await readdir(planDir);
            expect(files.length).toBe(2);
            expect(files).toContain("01-first-step.md");
            expect(files).toContain("02-third-step.md");
        });

        it("should remove first step", async () => {
            await removeStep(plan, 1);

            const planDir = join(planPath, "plan");
            const files = await readdir(planDir);
            expect(files.length).toBe(2);
            expect(files).toContain("01-second-step.md");
            expect(files).toContain("02-third-step.md");
        });

        it("should remove last step without renumbering", async () => {
            const result = await removeStep(plan, 3);

            expect(result.renamedFiles.length).toBe(0);

            const planDir = join(planPath, "plan");
            const files = await readdir(planDir);
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

            const planDir = join(planPath, "plan");
            const content = await readFile(
                join(planDir, "01-second-step.md"),
                "utf-8"
            );
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

            const planDir = join(planPath, "plan");
            const content = await readFile(
                join(planDir, "03-first-step.md"),
                "utf-8"
            );
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
            // First block it
            const blocked = blockStep(plan, 2, "reason");
            // Create a plan with the blocked step
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
        it("should complete step", () => {
            const completed = completeStep(plan, 1);

            expect(completed.status).toBe("completed");
            expect(completed.completedAt).toBeInstanceOf(Date);
        });

        it("should complete step with notes", () => {
            const completed = completeStep(plan, 1, "Finished early");

            expect(completed.notes).toBe("Finished early");
        });

        it("should throw for non-existent step", () => {
            expect(() => completeStep(plan, 99)).toThrow("Step 99 not found");
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

    describe("plan/ subdirectory creation", () => {
        it("should create plan/ subdirectory if it doesn't exist", async () => {
            // Create a plan directory without plan/ subdirectory
            const emptyPlanDir = join(tmpdir(), `riotplan-empty-test-${Date.now()}`);
            const { mkdir, writeFile } = await import("node:fs/promises");
            await mkdir(emptyPlanDir, { recursive: true });
            
            // Create minimal SUMMARY.md
            await writeFile(
                join(emptyPlanDir, "SUMMARY.md"),
                "# Test Plan\n\nTest plan without plan/ subdirectory",
                "utf-8"
            );

            // Load the plan (should have no steps initially)
            const emptyPlan = await loadPlan(emptyPlanDir);
            expect(emptyPlan.steps.length).toBe(0);

            // Insert a step - should create plan/ subdirectory
            const result = await insertStep(emptyPlan, {
                title: "First Step",
            });

            // Verify file was created in plan/ subdirectory
            expect(result.createdFile).toContain(join("plan", "01-first-step.md"));
            
            // Verify the file exists at the correct location
            const planSubdir = join(emptyPlanDir, "plan");
            const files = await readdir(planSubdir);
            expect(files).toContain("01-first-step.md");

            // Cleanup
            await rm(emptyPlanDir, { recursive: true });
        });

        it("should use existing plan/ subdirectory if present", async () => {
            // This is the normal case - plan/ already exists
            const planDir = join(planPath, "plan");
            const files = await readdir(planDir);
            
            // Verify initial steps are in plan/ subdirectory
            expect(files).toContain("01-first-step.md");
            expect(files).toContain("02-second-step.md");
            expect(files).toContain("03-third-step.md");

            // Add a new step
            const result = await insertStep(plan, {
                title: "Fourth Step",
            });

            // Verify new step is also in plan/ subdirectory
            expect(result.createdFile).toContain(join("plan", "04-fourth-step.md"));
            
            const updatedFiles = await readdir(planDir);
            expect(updatedFiles).toContain("04-fourth-step.md");
        });
    });
});

