/**
 * Tests for analysis module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import {
    createAnalysisDirectory,
    loadAnalysis,
    hasAnalysis,
} from "../src/analysis/index.js";
import { savePlanDoc } from "../src/artifacts/operations.js";
import { createTestPlan } from "./helpers/create-test-plan.js";

describe("Analysis", () => {
    let planPath: string;

    beforeEach(async () => {
        planPath = await createTestPlan({
            id: "analysis-test",
            name: "Analysis Test",
            steps: [],
        });
    });

    afterEach(async () => {
        try {
            await rm(dirname(planPath), { recursive: true, force: true });
        } catch {}
    });

    describe("createAnalysisDirectory", () => {
        it("should create analysis entries in SQLite", async () => {
            const result = await createAnalysisDirectory({
                planPath,
                planName: "test-plan",
                initialPrompt: "Build a thing",
            });

            expect(result).toBe("analysis");
        });

        it("should create REQUIREMENTS.md with initial prompt", async () => {
            const prompt = "Build a user authentication system";

            await createAnalysisDirectory({
                planPath,
                planName: "test-plan",
                initialPrompt: prompt,
            });

            const analysis = await loadAnalysis(planPath);
            expect(analysis).not.toBeNull();
            expect(analysis?.requirements).toContain(prompt);
            expect(analysis?.requirements).toContain("# Test Plan - Requirements Analysis");
        });

        it("should include status table in requirements", async () => {
            await createAnalysisDirectory({
                planPath,
                planName: "my-feature",
                initialPrompt: "Add feature",
            });

            const analysis = await loadAnalysis(planPath);
            expect(analysis?.requirements).toContain("| **Status** | `draft` |");
            expect(analysis?.requirements).toContain("| **Elaborations** | 0 |");
        });

        it("should format plan name as Title Case", async () => {
            await createAnalysisDirectory({
                planPath,
                planName: "my-awesome-feature",
                initialPrompt: "Build something",
            });

            const analysis = await loadAnalysis(planPath);
            expect(analysis?.requirements).toContain("# My Awesome Feature - Requirements Analysis");
        });

        it("should include verification criteria section", async () => {
            await createAnalysisDirectory({
                planPath,
                planName: "test-plan",
                initialPrompt: "Build it",
            });

            const analysis = await loadAnalysis(planPath);
            expect(analysis?.requirements).toContain("## Verification Criteria");
            expect(analysis?.requirements).toContain("### Must Have");
            expect(analysis?.requirements).toContain("### Should Have");
            expect(analysis?.requirements).toContain("### Could Have");
        });
    });

    describe("loadAnalysis", () => {
        it("should return null when no analysis exists", async () => {
            const result = await loadAnalysis(planPath);
            expect(result).toBeNull();
        });

        it("should load existing analysis", async () => {
            await createAnalysisDirectory({
                planPath,
                planName: "test-plan",
                initialPrompt: "Build a thing",
            });

            const analysis = await loadAnalysis(planPath);
            expect(analysis).not.toBeNull();
            expect(analysis?.requirements).toContain("Build a thing");
        });

        it("should return the plan path", async () => {
            await createAnalysisDirectory({
                planPath,
                planName: "test-plan",
                initialPrompt: "Build it",
            });

            const analysis = await loadAnalysis(planPath);
            expect(analysis?.path).toBe(planPath);
        });

        it("should parse status from requirements", async () => {
            await createAnalysisDirectory({
                planPath,
                planName: "test-plan",
                initialPrompt: "Build it",
            });

            const analysis = await loadAnalysis(planPath);
            expect(analysis?.metadata.status).toBe("draft");
        });

        it("should detect ready status", async () => {
            await savePlanDoc(planPath, "other", "analysis/REQUIREMENTS.md", "| **Status** | `ready` |");

            const analysis = await loadAnalysis(planPath);
            expect(analysis?.metadata.status).toBe("ready");
        });

        it("should load philosophy if present", async () => {
            await savePlanDoc(planPath, "other", "analysis/REQUIREMENTS.md", "Requirements content");
            await savePlanDoc(planPath, "other", "analysis/PHILOSOPHY.md", "Philosophy content");

            const analysis = await loadAnalysis(planPath);
            expect(analysis?.philosophy).toBe("Philosophy content");
        });
    });

    describe("hasAnalysis", () => {
        it("should return false when no analysis exists", async () => {
            const result = await hasAnalysis(planPath);
            expect(result).toBe(false);
        });

        it("should return true when analysis exists", async () => {
            await createAnalysisDirectory({
                planPath,
                planName: "test-plan",
                initialPrompt: "Build it",
            });

            const result = await hasAnalysis(planPath);
            expect(result).toBe(true);
        });

        it("should return false when no REQUIREMENTS.md in SQLite", async () => {
            const result = await hasAnalysis(planPath);
            expect(result).toBe(false);
        });
    });
});
