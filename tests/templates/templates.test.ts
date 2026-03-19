/**
 * Tests for riotplan-templates
 */

import { describe, it, expect } from "vitest";
import {
    getTemplate,
    listTemplates,
    BasicTemplate,
    FeatureTemplate,
    RefactoringTemplate,
    MigrationTemplate,
    SprintTemplate,
} from "../../src/index.js";

describe("riotplan-templates", () => {
    describe("Template Registry", () => {
        it("should have all built-in templates registered", () => {
            const templates = listTemplates();
            expect(templates.length).toBeGreaterThanOrEqual(5);

            const ids = templates.map((t) => t.id);
            expect(ids).toContain("basic");
            expect(ids).toContain("feature");
            expect(ids).toContain("refactoring");
            expect(ids).toContain("migration");
            expect(ids).toContain("sprint");
        });

        it("should get template by ID", () => {
            const basic = getTemplate("basic");
            expect(basic).toBeDefined();
            expect(basic!.name).toBe("Basic Plan");

            const feature = getTemplate("feature");
            expect(feature).toBeDefined();
            expect(feature!.name).toBe("Feature Development");
        });

        it("should return undefined for unknown template", () => {
            const unknown = getTemplate("non-existent");
            expect(unknown).toBeUndefined();
        });
    });

    describe("Built-in Templates", () => {
        it("BasicTemplate should have correct structure", () => {
            expect(BasicTemplate.id).toBe("basic");
            expect(BasicTemplate.category).toBe("general");
            expect(BasicTemplate.steps.length).toBeGreaterThanOrEqual(2);
        });

        it("FeatureTemplate should have phases", () => {
            expect(FeatureTemplate.id).toBe("feature");
            expect(FeatureTemplate.category).toBe("development");
            expect(FeatureTemplate.phases).toBeDefined();
            expect(FeatureTemplate.phases!.length).toBe(4);
        });

        it("RefactoringTemplate should focus on safety", () => {
            expect(RefactoringTemplate.id).toBe("refactoring");
            expect(RefactoringTemplate.tags).toContain("technical-debt");
            const testStep = RefactoringTemplate.steps.find((s) =>
                s.title.includes("Test"),
            );
            expect(testStep).toBeDefined();
        });

        it("MigrationTemplate should have rollback planning", () => {
            expect(MigrationTemplate.id).toBe("migration");
            expect(MigrationTemplate.category).toBe("operations");
            const planStep = MigrationTemplate.steps.find(
                (s) => s.title === "Planning",
            );
            expect(planStep).toBeDefined();
            expect(planStep!.tasks).toContain("Plan rollback procedures");
        });

        it("SprintTemplate should have agile steps", () => {
            expect(SprintTemplate.id).toBe("sprint");
            expect(SprintTemplate.tags).toContain("agile");
            const stepTitles = SprintTemplate.steps.map((s) => s.title);
            expect(stepTitles).toContain("Sprint Planning");
            expect(stepTitles).toContain("Sprint Retrospective");
        });
    });
});
