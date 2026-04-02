/**
 * Feature Development Template
 *
 * Template for planning new feature development.
 * Includes analysis, design, implementation, and testing phases.
 */

import type { PlanTemplate } from "../registry.js";

export const FeatureTemplate: PlanTemplate = {
    id: "feature",
    name: "Feature Development",
    description:
    "Plan template for developing new features. Covers analysis, design, implementation, testing, and deployment.",
    category: "development",
    tags: ["feature", "development", "agile", "software"],
    phases: [
        {
            name: "Discovery",
            description: "Understand requirements and constraints",
            steps: [0, 1],
        },
        {
            name: "Design",
            description: "Design the solution",
            steps: [2, 3],
        },
        {
            name: "Implementation",
            description: "Build the feature",
            steps: [4, 5],
        },
        {
            name: "Delivery",
            description: "Test and deploy",
            steps: [6, 7],
        },
    ],
    steps: [
        {
            title: "Requirements Analysis",
            description: "Gather and analyze feature requirements.",
            tasks: [
                "Review user stories or requirements",
                "Identify stakeholders",
                "Document acceptance criteria",
                "Clarify any ambiguities",
            ],
            criteria: [
                "Requirements documented",
                "Acceptance criteria defined",
                "Stakeholder sign-off",
            ],
        },
        {
            title: "Technical Assessment",
            description: "Assess technical feasibility and constraints.",
            tasks: [
                "Review existing codebase",
                "Identify dependencies",
                "Estimate effort",
                "Identify risks",
            ],
            criteria: [
                "Technical assessment documented",
                "Dependencies identified",
                "Effort estimated",
            ],
        },
        {
            title: "Architecture Design",
            description: "Design the feature architecture.",
            tasks: [
                "Create high-level design",
                "Define data models",
                "Design APIs/interfaces",
                "Document architecture decisions",
            ],
            criteria: ["Architecture documented", "Design reviewed"],
        },
        {
            title: "Detailed Design",
            description: "Create detailed implementation design.",
            tasks: [
                "Break down into components",
                "Design component interfaces",
                "Plan database changes",
                "Design error handling",
            ],
            criteria: ["Detailed design complete", "Component breakdown documented"],
        },
        {
            title: "Core Implementation",
            description: "Implement the core feature functionality.",
            tasks: [
                "Implement data models",
                "Build core logic",
                "Implement APIs",
                "Write unit tests",
            ],
            criteria: ["Core functionality implemented", "Unit tests passing"],
        },
        {
            title: "Integration",
            description: "Integrate with existing systems.",
            tasks: [
                "Integrate with dependencies",
                "Handle edge cases",
                "Add error handling",
                "Write integration tests",
            ],
            criteria: ["Integration complete", "Integration tests passing"],
        },
        {
            title: "Testing",
            description: "Comprehensive testing of the feature.",
            tasks: [
                "Run full test suite",
                "Perform manual testing",
                "Fix any bugs found",
                "Document test results",
            ],
            criteria: [
                "All tests passing",
                "Manual testing complete",
                "No critical bugs",
            ],
        },
        {
            title: "Deployment",
            description: "Deploy the feature to production.",
            tasks: [
                "Prepare deployment artifacts",
                "Update documentation",
                "Deploy to staging",
                "Deploy to production",
                "Monitor for issues",
            ],
            criteria: [
                "Feature deployed",
                "Documentation updated",
                "No production issues",
            ],
        },
    ],
};
