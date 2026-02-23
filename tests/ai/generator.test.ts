import { describe, it, expect } from "vitest";
import { formatSummary, formatStep, parsePlanResponse } from "../../src/ai/generator.js";
import type { GeneratedStep } from "../../src/ai/generator.js";

describe("AI Generator", () => {
    describe("formatSummary", () => {
        it("should format plan summary correctly", () => {
            const plan = {
                summary: "Test summary",
                approach: "Test approach",
                successCriteria: "Test criteria",
                steps: [],
            };

            const result = formatSummary(plan, "test-plan");

            expect(result).toContain("# Test Plan - Summary");
            expect(result).toContain("Test summary");
            expect(result).toContain("Test approach");
            expect(result).toContain("Test criteria");
        });

        it("should capitalize plan name correctly", () => {
            const plan = {
                summary: "Summary",
                approach: "Approach",
                successCriteria: "Criteria",
                steps: [],
            };

            const result = formatSummary(plan, "my-test-plan");

            expect(result).toContain("# My Test Plan - Summary");
        });
    });

    describe("formatStep", () => {
        it("should format step correctly", () => {
            const step: GeneratedStep = {
                number: 1,
                title: "Test Step",
                objective: "Test objective",
                background: "Test background",
                tasks: [
                    { id: "01.1", description: "Task one" },
                    { id: "01.2", description: "Task two" },
                ],
                acceptanceCriteria: ["Criterion 1", "Criterion 2"],
                testing: "Test strategy",
                filesChanged: ["file1.ts", "file2.ts"],
                notes: "Test notes",
            };

            const result = formatStep(step);

            expect(result).toContain("# Step 01: Test Step");
            expect(result).toContain("Test objective");
            expect(result).toContain("Test background");
            expect(result).toContain("### 01.1 Task one");
            expect(result).toContain("### 01.2 Task two");
            expect(result).toContain("- [ ] Criterion 1");
            expect(result).toContain("- [ ] Criterion 2");
            expect(result).toContain("Test strategy");
            expect(result).toContain("- file1.ts");
            expect(result).toContain("- file2.ts");
            expect(result).toContain("Test notes");
        });

        it("should pad step numbers correctly", () => {
            const step: GeneratedStep = {
                number: 5,
                title: "Test",
                objective: "Obj",
                background: "Bg",
                tasks: [],
                acceptanceCriteria: [],
                testing: "Test",
                filesChanged: [],
                notes: "",
            };

            const result = formatStep(step);

            expect(result).toContain("# Step 05: Test");
        });
    });

    describe("parsePlanResponse", () => {
        it("parses fenced JSON responses", () => {
            const content = [
                "```json",
                "{",
                '  "analysis": { "constraintAnalysis": [] },',
                '  "summary": "Test summary",',
                '  "approach": "Test approach",',
                '  "successCriteria": "Test criteria",',
                '  "steps": []',
                "}",
                "```",
            ].join("\n");

            const parsed = parsePlanResponse(content, 5);
            expect(parsed.summary).toBe("Test summary");
            expect(parsed.approach).toBe("Test approach");
            expect(parsed.successCriteria).toBe("Test criteria");
            expect(parsed.steps).toEqual([]);
        });
    });
});
