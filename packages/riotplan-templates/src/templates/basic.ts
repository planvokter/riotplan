/**
 * Basic Plan Template
 *
 * A simple, general-purpose plan template with minimal structure.
 * Good for quick plans or when other templates don't fit.
 */

import type { PlanTemplate } from "../registry.js";

export const BasicTemplate: PlanTemplate = {
    id: "basic",
    name: "Basic Plan",
    description:
    "A simple plan template with minimal structure. Good for quick tasks or custom workflows.",
    category: "general",
    tags: ["basic", "simple", "quick"],
    steps: [
        {
            title: "Define Objectives",
            description: "Clearly define what this plan will accomplish.",
            tasks: [
                "Identify the primary goal",
                "List key success criteria",
                "Define scope and boundaries",
            ],
            criteria: [
                "Objectives are clearly documented",
                "Success criteria are measurable",
            ],
        },
        {
            title: "Execute",
            description: "Carry out the planned work.",
            tasks: [
                "Perform the main tasks",
                "Track progress",
                "Document any issues",
            ],
            criteria: ["All tasks completed", "Issues documented and addressed"],
        },
        {
            title: "Review and Complete",
            description: "Review the results and finalize the plan.",
            tasks: [
                "Review work against objectives",
                "Document outcomes",
                "Note lessons learned",
            ],
            criteria: ["Objectives met", "Documentation complete"],
        },
    ],
};
