/**
 * Tests for riotplan-history
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import type { PlanHistory } from "../../src/types.js";
import {
    createRevision,
    getRevision,
    listRevisions,
    compareRevisions,
    createMilestone,
    getMilestone,
    listMilestones,
    rollbackToMilestone,
    getLatestMilestone,
    initHistory,
    loadHistory,
    saveHistory,
} from "../../src/index.js";
import { createTestPlan } from "../helpers/create-test-plan.js";

describe("riotplan-history", () => {
    describe("Revisions", () => {
        let history: PlanHistory;

        beforeEach(() => {
            history = initHistory("0.1");
        });

        it("should create initial history with first revision", () => {
            expect(history.currentVersion).toBe("0.1");
            expect(history.revisions.length).toBe(1);
            expect(history.revisions[0].message).toBe("Initial version");
        });

        it("should create new revision", () => {
            const revision = createRevision(history, "Added new feature");

            expect(revision.version).toBe("0.2");
            expect(revision.message).toBe("Added new feature");
            expect(history.currentVersion).toBe("0.2");
            expect(history.revisions.length).toBe(2);
        });

        it("should create revision with author", () => {
            const revision = createRevision(history, "Bug fix", {
                author: "Test Author",
            });

            expect(revision.author).toBe("Test Author");
        });

        it("should create revision with feedbackId", () => {
            const revision = createRevision(history, "Based on feedback", {
                feedbackId: "feedback-001",
            });

            expect(revision.feedbackId).toBe("feedback-001");
        });

        it("should get revision by version", () => {
            createRevision(history, "Second revision");

            const revision = getRevision(history, "0.1");

            expect(revision).toBeDefined();
            expect(revision!.version).toBe("0.1");
            expect(revision!.index).toBe(0);
            expect(revision!.isCurrent).toBe(false);
        });

        it("should return undefined for unknown version", () => {
            const revision = getRevision(history, "9.9");

            expect(revision).toBeUndefined();
        });

        it("should list all revisions", () => {
            createRevision(history, "Second");
            createRevision(history, "Third");

            const revisions = listRevisions(history);

            expect(revisions.length).toBe(3);
            expect(revisions[0].isCurrent).toBe(false);
            expect(revisions[2].isCurrent).toBe(true);
        });

        it("should compare revisions", () => {
            createRevision(history, "Second");
            createRevision(history, "Third");

            const comparison = compareRevisions(history, "0.1", "0.3");

            expect(comparison).toBeDefined();
            expect(comparison!.from.version).toBe("0.1");
            expect(comparison!.to.version).toBe("0.3");
            expect(comparison!.revisionCount).toBe(2);
        });

        it("should return undefined for invalid comparison", () => {
            const comparison = compareRevisions(history, "0.1", "9.9");

            expect(comparison).toBeUndefined();
        });
    });

    describe("Milestones", () => {
        let history: PlanHistory;

        beforeEach(() => {
            history = initHistory("0.1");
        });

        it("should create milestone", () => {
            const milestone = createMilestone(history, "v1.0", "First release");

            expect(milestone.name).toBe("v1.0");
            expect(milestone.version).toBe("0.1");
            expect(milestone.description).toBe("First release");
            expect(history.milestones?.length).toBe(1);
        });

        it("should get milestone by name", () => {
            createMilestone(history, "v1.0");

            const milestone = getMilestone(history, "v1.0");

            expect(milestone).toBeDefined();
            expect(milestone!.name).toBe("v1.0");
            expect(milestone!.index).toBe(0);
        });

        it("should return undefined for unknown milestone", () => {
            const milestone = getMilestone(history, "unknown");

            expect(milestone).toBeUndefined();
        });

        it("should list all milestones", () => {
            createMilestone(history, "v1.0");
            createRevision(history, "Update");
            createMilestone(history, "v2.0");

            const milestones = listMilestones(history);

            expect(milestones.length).toBe(2);
            expect(milestones[0].name).toBe("v1.0");
            expect(milestones[1].name).toBe("v2.0");
        });

        it("should rollback to milestone", () => {
            createMilestone(history, "v1.0");
            createRevision(history, "Update 1");
            createRevision(history, "Update 2");

            const result = rollbackToMilestone(history, "v1.0");

            expect(result.success).toBe(true);
            expect(result.newVersion).toBe("0.1");
            expect(result.revisionsRolledBack).toBe(2);
            expect(history.currentVersion).toBe("0.1");
        });

        it("should fail rollback for unknown milestone", () => {
            const result = rollbackToMilestone(history, "unknown");

            expect(result.success).toBe(false);
            expect(result.error).toContain("not found");
        });

        it("should fail rollback when milestone version not in revisions", () => {
            const milestone = createMilestone(history, "v1.0");
            milestone.version = "9.9.9";

            const result = rollbackToMilestone(history, "v1.0");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Revision not found");
        });

        it("should return empty array when no milestones exist", () => {
            const milestones = listMilestones(history);
            expect(milestones).toEqual([]);
        });

        it("should return undefined when getting milestone from empty history", () => {
            const milestone = getMilestone(history, "v1.0");
            expect(milestone).toBeUndefined();
        });

        it("should get latest milestone", () => {
            createMilestone(history, "v1.0");
            createRevision(history, "Update");
            createMilestone(history, "v2.0");

            const latest = getLatestMilestone(history);

            expect(latest).toBeDefined();
            expect(latest!.name).toBe("v2.0");
            expect(latest!.index).toBe(1);
        });

        it("should return undefined when no milestones exist for getLatestMilestone", () => {
            const latest = getLatestMilestone(history);
            expect(latest).toBeUndefined();
        });
    });

    describe("History Manager", () => {
        let planPath: string;

        beforeEach(async () => {
            planPath = await createTestPlan({
                id: "history-test",
                name: "History Test",
                steps: [],
            });
        });

        afterEach(async () => {
            try {
                await rm(dirname(planPath), { recursive: true, force: true });
            } catch {}
        });

        it("should save history to SQLite", async () => {
            const history = initHistory("1.0");
            createRevision(history, "Update");

            await saveHistory(history, planPath);

            const manager = await loadHistory(planPath);
            expect(manager.history.currentVersion).toBe("1.1");
            expect(manager.history.revisions.length).toBe(2);
        });

        it("should load history from SQLite", async () => {
            const original = initHistory("1.0");
            createMilestone(original, "v1.0");
            await saveHistory(original, planPath);

            const manager = await loadHistory(planPath);

            expect(manager.history.currentVersion).toBe("1.0");
            expect(manager.history.milestones?.length).toBe(1);
        });

        it("should initialize new history if not stored", async () => {
            const manager = await loadHistory(planPath);

            expect(manager.history.currentVersion).toBe("0.1");
            expect(manager.history.revisions.length).toBe(1);
        });

        it("should save via manager", async () => {
            const manager = await loadHistory(planPath);
            createRevision(manager.history, "Update");

            await manager.save();

            const reloaded = await loadHistory(planPath);
            expect(reloaded.history.revisions.length).toBe(2);
        });
    });
});
