/**
 * Sprint Template
 *
 * Template for sprint/iteration planning.
 * Covers planning, execution, review, and retrospective.
 */

import type { PlanTemplate } from "../registry.js";

export const SprintTemplate: PlanTemplate = {
    id: "sprint",
    name: "Sprint Plan",
    description:
    "Plan template for agile sprints or iterations. Covers planning, daily execution, review, and retrospective.",
    category: "general",
    tags: ["sprint", "agile", "iteration", "scrum"],
    steps: [
        {
            title: "Sprint Planning",
            description: "Plan the sprint goals and work items.",
            tasks: [
                "Review backlog",
                "Select sprint items",
                "Define sprint goal",
                "Break down stories",
                "Estimate capacity",
            ],
            criteria: [
                "Sprint goal defined",
                "Items selected and estimated",
                "Team committed",
            ],
        },
        {
            title: "Sprint Execution",
            description: "Execute the sprint work.",
            tasks: [
                "Daily standups",
                "Work on sprint items",
                "Track progress",
                "Address blockers",
            ],
            criteria: ["Daily progress tracked", "Blockers addressed"],
        },
        {
            title: "Sprint Review",
            description: "Review completed work with stakeholders.",
            tasks: [
                "Demo completed features",
                "Gather feedback",
                "Update backlog",
                "Document outcomes",
            ],
            criteria: ["Demo completed", "Feedback gathered", "Backlog updated"],
        },
        {
            title: "Sprint Retrospective",
            description: "Reflect on the sprint and identify improvements.",
            tasks: [
                "What went well",
                "What could improve",
                "Action items",
                "Update processes",
            ],
            criteria: [
                "Retrospective completed",
                "Improvements identified",
                "Action items assigned",
            ],
        },
    ],
};
