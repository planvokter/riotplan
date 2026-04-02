/**
 * Refactoring Template
 *
 * Template for code refactoring projects.
 * Focuses on safety, incremental changes, and verification.
 */

import type { PlanTemplate } from "../registry.js";

export const RefactoringTemplate: PlanTemplate = {
    id: "refactoring",
    name: "Code Refactoring",
    description:
    "Plan template for code refactoring. Emphasizes safety, incremental changes, and thorough testing.",
    category: "development",
    tags: ["refactoring", "cleanup", "technical-debt", "maintenance"],
    steps: [
        {
            title: "Analysis",
            description: "Analyze the code to be refactored.",
            tasks: [
                "Identify code to refactor",
                "Understand current behavior",
                "Map dependencies",
                "Document current tests",
            ],
            criteria: [
                "Code scope defined",
                "Dependencies mapped",
                "Existing tests documented",
            ],
        },
        {
            title: "Test Coverage",
            description: "Ensure adequate test coverage before refactoring.",
            tasks: [
                "Identify test gaps",
                "Write characterization tests",
                "Verify all tests pass",
                "Document expected behavior",
            ],
            criteria: [
                "Test coverage adequate",
                "All tests passing",
                "Behavior documented",
            ],
        },
        {
            title: "Plan Changes",
            description: "Plan the refactoring approach.",
            tasks: [
                "Define target architecture",
                "Plan incremental steps",
                "Identify safe checkpoints",
                "Estimate effort",
            ],
            criteria: [
                "Target state defined",
                "Steps planned",
                "Checkpoints identified",
            ],
        },
        {
            title: "Incremental Refactoring",
            description: "Apply refactoring in small, safe increments.",
            tasks: [
                "Apply changes incrementally",
                "Run tests after each change",
                "Commit at checkpoints",
                "Document changes made",
            ],
            criteria: [
                "Changes applied safely",
                "Tests passing at each step",
                "Changes documented",
            ],
        },
        {
            title: "Verification",
            description: "Verify refactoring maintains behavior.",
            tasks: [
                "Run full test suite",
                "Perform manual testing",
                "Check performance",
                "Review for regressions",
            ],
            criteria: [
                "All tests passing",
                "No regressions",
                "Performance acceptable",
            ],
        },
        {
            title: "Cleanup",
            description: "Final cleanup and documentation.",
            tasks: [
                "Remove old code",
                "Update documentation",
                "Update related code comments",
                "Final review",
            ],
            criteria: [
                "Old code removed",
                "Documentation updated",
                "Code review complete",
            ],
        },
    ],
};
